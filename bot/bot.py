"""
GameArena — Telegram Bot
Python 3.11+ | aiogram 3.x | Render-ready
"""

import asyncio
import logging
import os

import aiohttp
from aiogram import Bot, Dispatcher, F, Router
from aiogram.filters import Command, CommandStart
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    BotCommand,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    InlineQuery,
    InlineQueryResultArticle,
    InputTextMessageContent,
    Message,
    WebAppInfo,
)
from dotenv import load_dotenv

load_dotenv()

# ── Config ─────────────────────────────────────────────────────────────────────
BOT_TOKEN    = os.getenv("BOT_TOKEN",    "")
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://your-frontend.vercel.app")
API_URL      = os.getenv("API_URL",      "http://localhost:3001")
# How often (seconds) the bot pings the backend to prevent Render sleep
KEEPALIVE_INTERVAL = int(os.getenv("KEEPALIVE_INTERVAL", "600"))  # 10 min

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN is not set — check your .env file")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("GameArena")

# ── Keep-alive: ping backend every N seconds ───────────────────────────────────
async def keepalive_loop() -> None:
    """Prevents the Render free-tier backend from sleeping."""
    await asyncio.sleep(30)          # wait for bot to fully start first
    while True:
        try:
            async with aiohttp.ClientSession() as s:
                async with s.get(f"{API_URL}/health", timeout=aiohttp.ClientTimeout(total=10)) as r:
                    if r.status == 200:
                        log.debug("Keep-alive ping OK")
                    else:
                        log.warning("Keep-alive ping returned %d", r.status)
        except Exception as exc:
            log.warning("Keep-alive ping failed: %s", exc)
        await asyncio.sleep(KEEPALIVE_INTERVAL)

# ── API helpers ────────────────────────────────────────────────────────────────
async def api_get(path: str) -> dict | list | None:
    try:
        async with aiohttp.ClientSession() as s:
            async with s.get(
                f"{API_URL}/api{path}",
                timeout=aiohttp.ClientTimeout(total=8),
            ) as r:
                if r.status == 200:
                    return await r.json()
                log.warning("API GET %s → %d", path, r.status)
    except Exception as exc:
        log.warning("API GET %s failed: %s", path, exc)
    return None


async def api_post(path: str, data: dict) -> dict | None:
    try:
        async with aiohttp.ClientSession() as s:
            async with s.post(
                f"{API_URL}/api{path}",
                json=data,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as r:
                if r.status == 200:
                    return await r.json()
                log.warning("API POST %s → %d", path, r.status)
    except Exception as exc:
        log.warning("API POST %s failed: %s", path, exc)
    return None


async def register_user(bot: Bot, tg_user) -> dict | None:
    """Upsert Telegram user in the backend DB, including profile photo."""
    photo_url = None
    try:
        photos = await bot.get_user_profile_photos(tg_user.id, limit=1)
        if photos.total_count > 0:
            file_id = photos.photos[0][-1].file_id
            file    = await bot.get_file(file_id)
            photo_url = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file.file_path}"
    except Exception as exc:
        log.debug("Could not fetch profile photo for %d: %s", tg_user.id, exc)

    result = await api_post("/users/auth", {
        "tg_id":      tg_user.id,
        "username":   tg_user.username,
        "first_name": tg_user.first_name,
        "last_name":  tg_user.last_name,
        "photo_url":  photo_url,
    })
    return result


# ── Keyboard factories ─────────────────────────────────────────────────────────
GAME_META = [
    ("♟ Шахматы",       "chess"),
    ("🔴 Шашки",        "checkers"),
    ("🚢 Морской бой",  "battleship"),
    ("⬤ Пять в ряд",   "gomoku"),
    ("🟡 Четыре в ряд", "connect4"),
]

GAME_LABELS = {g: l for l, g in GAME_META}


def kb_open_app(text: str = "🎮 Открыть GameArena") -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=text, web_app=WebAppInfo(url=MINI_APP_URL))
    ]])


def kb_main() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🎮 Играть",           web_app=WebAppInfo(url=MINI_APP_URL))],
        [
            InlineKeyboardButton(text="📊 Статистика",    callback_data="stats"),
            InlineKeyboardButton(text="🏆 Рейтинг",       callback_data="leaderboard_menu"),
        ],
        [
            InlineKeyboardButton(text="👥 Друзья",        callback_data="friends"),
            InlineKeyboardButton(text="📖 Помощь",        callback_data="help"),
        ],
    ])


def kb_games() -> InlineKeyboardMarkup:
    rows = []
    for i in range(0, len(GAME_META), 2):
        row = [
            InlineKeyboardButton(text=label, web_app=WebAppInfo(url=MINI_APP_URL))
            for label, _ in GAME_META[i:i + 2]
        ]
        rows.append(row)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def kb_leaderboard_select() -> InlineKeyboardMarkup:
    rows = []
    for i in range(0, len(GAME_META), 2):
        row = [
            InlineKeyboardButton(text=label, callback_data=f"lb:{gid}")
            for label, gid in GAME_META[i:i + 2]
        ]
        rows.append(row)
    return InlineKeyboardMarkup(inline_keyboard=rows)


# ── Level / XP helpers ─────────────────────────────────────────────────────────
def xp_for_level(level: int) -> int:
    return int(100 * (1.4 ** (level - 1)))


def xp_bar(xp: int, level: int, width: int = 10) -> str:
    needed = xp_for_level(level)
    filled = round((xp / needed) * width) if needed else 0
    filled = max(0, min(width, filled))
    return "█" * filled + "░" * (width - filled)


def level_title(level: int) -> str:
    if level < 3:   return "🥉 Новичок"
    if level < 6:   return "🥈 Игрок"
    if level < 10:  return "🥇 Ветеран"
    if level < 15:  return "💎 Мастер"
    return "👑 Легенда"


# ── Router ─────────────────────────────────────────────────────────────────────
router = Router()


# /start ───────────────────────────────────────────────────────────────────────
@router.message(CommandStart())
async def cmd_start(message: Message, bot: Bot) -> None:
    u = message.from_user
    await register_user(bot, u)

    await message.answer(
        f"👋 Привет, <b>{u.first_name}</b>!\n\n"
        "Добро пожаловать в <b>GameArena</b> — игровой клуб прямо в Telegram.\n\n"
        "<b>Игры:</b>\n"
        "  ♟  Шахматы — классика, полные правила, рокировка, мат\n"
        "  🔴 Шашки — русские правила, дамки, обязательное взятие\n"
        "  🚢 Морской бой — расставь флот и топи врагов\n"
        "  ⬤  Пять в ряд — доска 15×15, быстрые партии\n"
        "  🟡 Четыре в ряд — гравитация, стратегия\n\n"
        "<b>Фичи:</b>\n"
        "  📈 Уровни и XP отдельно для каждой игры\n"
        "  🏆 Глобальный рейтинг по каждой из 5 игр\n"
        "  👥 Система друзей с поиском по нику\n"
        "  🎭 Аватарки и имена напрямую из Telegram\n\n"
        "Нажми <b>Играть</b> и вперёд! 🚀",
        parse_mode="HTML",
        reply_markup=kb_main(),
    )


# /play ────────────────────────────────────────────────────────────────────────
@router.message(Command("play"))
async def cmd_play(message: Message) -> None:
    await message.answer(
        "🎮 <b>Выберите игру:</b>\n"
        "<i>Откроется Mini App прямо в Telegram</i>",
        parse_mode="HTML",
        reply_markup=kb_games(),
    )


# /stats ───────────────────────────────────────────────────────────────────────
@router.message(Command("stats"))
async def cmd_stats(message: Message, bot: Bot) -> None:
    u = message.from_user

    wait = await message.answer("⏳ Загружаем статистику…")

    auth = await register_user(bot, u)
    if not auth:
        await wait.edit_text("❌ Сервер недоступен. Попробуйте позже.")
        return

    uid   = auth["user"]["id"]
    stats = await api_get(f"/users/{uid}/stats")

    if not stats:
        await wait.edit_text(
            "📊 Вы ещё не сыграли ни одной игры!\n\n"
            "Откройте GameArena и сыграйте первую партию. 👇",
            reply_markup=kb_open_app("🎮 Начать играть"),
        )
        return

    total_wins = total_games = 0
    lines = [f"📊 <b>Статистика {u.first_name}</b>\n"]

    for s in stats:
        gt     = s["game_type"]
        label  = GAME_LABELS.get(gt, gt)
        lvl    = s["level"]
        xp     = s["xp"]
        wins   = s["wins"]
        losses = s["losses"]
        draws  = s["draws"]
        games  = wins + losses + draws
        total_wins  += wins
        total_games += games

        bar   = xp_bar(xp, lvl)
        title = level_title(lvl)
        wr    = f"{round(wins / games * 100)}%" if games else "—"

        lines.append(
            f"<b>{label}</b>   {title} • Ур.<b>{lvl}</b>\n"
            f"  [{bar}] {xp}/{xp_for_level(lvl)} XP\n"
            f"  🏆 {wins}П   💀 {losses}Пр   🤝 {draws}Н   WR: <b>{wr}</b>\n"
        )

    overall_wr = f"{round(total_wins / total_games * 100)}%" if total_games else "—"
    lines.append(
        f"─────────────────\n"
        f"🎯 Всего игр: <b>{total_games}</b>   Общий WR: <b>{overall_wr}</b>"
    )

    await wait.edit_text(
        "\n".join(lines),
        parse_mode="HTML",
        reply_markup=kb_open_app("🎮 Открыть GameArena"),
    )


# /leaderboard ─────────────────────────────────────────────────────────────────
@router.message(Command("leaderboard"))
async def cmd_leaderboard(message: Message) -> None:
    await message.answer(
        "🏆 <b>Таблица лидеров</b>\n<i>Выберите игру:</i>",
        parse_mode="HTML",
        reply_markup=kb_leaderboard_select(),
    )


@router.callback_query(F.data.startswith("lb:"))
async def cb_leaderboard(call: CallbackQuery) -> None:
    game_type = call.data.split(":", 1)[1]
    label     = GAME_LABELS.get(game_type, game_type)

    await call.answer()
    board = await api_get(f"/games/leaderboard/{game_type}")

    if not board:
        await call.message.edit_text(
            f"🏆 <b>{label}</b>\n\nДанных пока нет. Станьте первым!",
            parse_mode="HTML",
            reply_markup=kb_open_app("🎮 Играть"),
        )
        return

    medals = ["🥇", "🥈", "🥉"]
    lines  = [f"🏆 <b>Рейтинг — {label}</b>\n"]

    for i, e in enumerate(board[:10]):
        pos    = medals[i] if i < 3 else f"<b>{i + 1}.</b>"
        name   = e["first_name"]
        uname  = f" @{e['username']}" if e.get("username") else ""
        lvl    = e["level"]
        wins   = e["wins"]
        losses = e["losses"]
        title  = level_title(lvl)
        lines.append(f"{pos} {name}{uname}  •  {title} Ур.{lvl}  •  {wins}П/{losses}Пр")

    # Back-button to game select
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="← Другая игра", callback_data="leaderboard_menu")],
        [InlineKeyboardButton(text="🎮 Играть", web_app=WebAppInfo(url=MINI_APP_URL))],
    ])
    await call.message.edit_text("\n".join(lines), parse_mode="HTML", reply_markup=kb)


@router.callback_query(F.data == "leaderboard_menu")
async def cb_lb_menu(call: CallbackQuery) -> None:
    await call.answer()
    await call.message.edit_text(
        "🏆 <b>Таблица лидеров</b>\n<i>Выберите игру:</i>",
        parse_mode="HTML",
        reply_markup=kb_leaderboard_select(),
    )


# /friends ─────────────────────────────────────────────────────────────────────
@router.message(Command("friends"))
async def cmd_friends(message: Message, bot: Bot) -> None:
    u    = message.from_user
    wait = await message.answer("⏳ Загружаем список друзей…")

    auth = await register_user(bot, u)
    if not auth:
        await wait.edit_text("❌ Сервер недоступен. Попробуйте позже.")
        return

    uid  = auth["user"]["id"]
    data = await api_get(f"/friends/{uid}")

    if not data:
        await wait.edit_text(
            "👥 Не удалось загрузить список друзей.",
            reply_markup=kb_open_app(),
        )
        return

    friends  = data.get("friends",  [])
    incoming = data.get("incoming", [])
    outgoing = data.get("outgoing", [])
    lines    = [f"👥 <b>Друзья {u.first_name}</b>\n"]

    if friends:
        lines.append(f"<b>Друзья ({len(friends)}):</b>")
        for f in friends[:15]:
            un = f" @{f['username']}" if f.get("username") else ""
            lines.append(f"  ✅ {f['first_name']}{un}")
    else:
        lines.append("Пока нет друзей. Найдите игроков в приложении!")

    if incoming:
        lines.append(f"\n<b>Входящие запросы ({len(incoming)}):</b>")
        for f in incoming[:5]:
            un = f" @{f['username']}" if f.get("username") else ""
            lines.append(f"  ⏳ {f['first_name']}{un}")
        lines.append("\n<i>Принять/отклонить — в приложении</i>")

    if outgoing:
        lines.append(f"\n<b>Исходящие запросы ({len(outgoing)}):</b>")
        for f in outgoing[:5]:
            un = f" @{f['username']}" if f.get("username") else ""
            lines.append(f"  📤 {f['first_name']}{un}")

    await wait.edit_text(
        "\n".join(lines),
        parse_mode="HTML",
        reply_markup=kb_open_app("👥 Управление друзьями"),
    )


# /help ────────────────────────────────────────────────────────────────────────
@router.message(Command("help"))
async def cmd_help(message: Message) -> None:
    await message.answer(
        "📖 <b>Команды GameArena</b>\n\n"
        "/start         — главное меню\n"
        "/play          — выбрать игру\n"
        "/stats         — моя статистика по всем 5 играм\n"
        "/leaderboard   — таблица лидеров (выбор игры)\n"
        "/friends       — список друзей и запросы\n"
        "/help          — это сообщение\n\n"
        "🎮 <b>Как играть?</b>\n"
        "Нажмите <b>Играть</b> → откроется Mini App → выберите игру → "
        "создайте или войдите в существующее лобби → играйте в реальном времени!\n\n"
        "📈 <b>Система уровней</b>\n"
        "  Победа: +50 XP  •  Ничья: +15 XP  •  Поражение: +5 XP\n"
        "  Уровень считается отдельно для каждой игры.\n\n"
        "💡 <i>Отправьте </i><code>@ваш_бот</code><i> в любой чат, "
        "чтобы поделиться приглашением в GameArena.</i>",
        parse_mode="HTML",
        reply_markup=kb_open_app(),
    )


# ── Callback shortcuts from main menu ─────────────────────────────────────────
@router.callback_query(F.data == "stats")
async def cb_stats(call: CallbackQuery, bot: Bot) -> None:
    await call.answer()
    await cmd_stats(call.message, bot)


@router.callback_query(F.data == "friends")
async def cb_friends(call: CallbackQuery, bot: Bot) -> None:
    await call.answer()
    await cmd_friends(call.message, bot)


@router.callback_query(F.data == "help")
async def cb_help(call: CallbackQuery) -> None:
    await call.answer()
    await cmd_help(call.message)


# ── Inline query — share invite link ──────────────────────────────────────────
@router.inline_query()
async def inline_invite(query: InlineQuery) -> None:
    results = [
        InlineQueryResultArticle(
            id="invite",
            title="🎮 Пригласить в GameArena",
            description="Отправить приглашение друзьям",
            input_message_content=InputTextMessageContent(
                message_text=(
                    "🎮 Привет! Сыграем в <b>GameArena</b>?\n\n"
                    "Шахматы, шашки, морской бой, пять в ряд, четыре в ряд — "
                    "всё в одном месте прямо в Telegram.\n"
                    "Уровни, рейтинги, система друзей.\n\n"
                    "👇 Открывай и играем вместе!"
                ),
                parse_mode="HTML",
            ),
            reply_markup=kb_open_app("🎮 Открыть GameArena"),
        )
    ]
    await query.answer(results, cache_time=60, is_personal=False)


# ── Fallback ───────────────────────────────────────────────────────────────────
@router.message()
async def fallback(message: Message) -> None:
    await message.answer(
        "Не понял 🤔 Воспользуйтесь командами или просто нажмите кнопку ниже:",
        reply_markup=kb_open_app(),
    )


# ── Bot commands menu ──────────────────────────────────────────────────────────
async def set_commands(bot: Bot) -> None:
    await bot.set_my_commands([
        BotCommand(command="start",       description="🎮 Главное меню"),
        BotCommand(command="play",        description="▶️ Выбрать игру"),
        BotCommand(command="stats",       description="📊 Моя статистика"),
        BotCommand(command="leaderboard", description="🏆 Таблица лидеров"),
        BotCommand(command="friends",     description="👥 Мои друзья"),
        BotCommand(command="help",        description="📖 Помощь"),
    ])
    log.info("Commands registered with Telegram")


# ── Lifecycle ──────────────────────────────────────────────────────────────────
async def on_startup(bot: Bot) -> None:
    await set_commands(bot)
    me = await bot.get_me()
    log.info("✅ Bot @%s started (id=%d)", me.username, me.id)
    log.info("   Mini App URL : %s", MINI_APP_URL)
    log.info("   API URL      : %s", API_URL)
    log.info("   Keep-alive   : every %ds", KEEPALIVE_INTERVAL)


async def on_shutdown(bot: Bot) -> None:
    log.info("Bot shutting down…")
    await bot.session.close()


# ── Entry point ────────────────────────────────────────────────────────────────
async def main() -> None:
    bot = Bot(token=BOT_TOKEN)
    dp  = Dispatcher(storage=MemoryStorage())

    dp.include_router(router)
    dp.startup.register(on_startup)
    dp.shutdown.register(on_shutdown)

    # Start keep-alive background task
    loop = asyncio.get_event_loop()
    loop.create_task(keepalive_loop())

    log.info("Starting polling…")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())

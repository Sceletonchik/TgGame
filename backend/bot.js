require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { dbHelpers } = require('./database');

const token     = process.env.BOT_TOKEN;
const miniAppUrl= process.env.MINI_APP_URL || 'https://your-domain.com';

if (!token) {
  console.warn('⚠️  BOT_TOKEN not set — bot disabled');
  module.exports = null;
  return;
}

const bot = new TelegramBot(token, { polling: true });

// ─── Commands ────────────────────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const user = msg.from;
  dbHelpers.upsertUser({
    id:         user.id,
    username:   user.username,
    first_name: user.first_name,
    last_name:  user.last_name,
    photo_url:  null,
  });

  await bot.sendMessage(msg.chat.id,
    `🎮 *Добро пожаловать в GameArena!*\n\nЗдесь тебя ждут:\n♟ Шахматы\n🔴 Шашки\n🚢 Морской бой\n⬤ Пять в ряд\n🟡 Четыре в ряд\n\nИгра с друзьями, рейтинги, уровни — всё в одном месте!`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{
          text: '🎮 Открыть игры',
          web_app: { url: miniAppUrl }
        }]]
      }
    }
  );
});

bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `*GameArena — помощь*\n\n/start — главное меню\n/play — открыть игры\n/stats — ваша статистика\n/friends — список друзей\n/leaderboard — таблица лидеров`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/play/, async (msg) => {
  await bot.sendMessage(msg.chat.id, '🎮 Нажмите кнопку ниже для игры:', {
    reply_markup: {
      inline_keyboard: [[{
        text: '🎮 Открыть GameArena',
        web_app: { url: miniAppUrl }
      }]]
    }
  });
});

bot.onText(/\/stats/, async (msg) => {
  const dbUser = dbHelpers.getUserByTgId(msg.from.id);
  if (!dbUser) {
    return bot.sendMessage(msg.chat.id, 'Сначала запустите /start');
  }

  const stats = dbHelpers.getAllStats(dbUser.id);
  if (!stats.length) {
    return bot.sendMessage(msg.chat.id, 'Вы ещё не сыграли ни одной игры!');
  }

  const GAME_NAMES = {
    chess:      '♟ Шахматы',
    checkers:   '🔴 Шашки',
    battleship: '🚢 Морской бой',
    gomoku:     '⬤ Пять в ряд',
    connect4:   '🟡 Четыре в ряд',
  };

  let text = `📊 *Статистика ${dbUser.first_name}*\n\n`;
  for (const s of stats) {
    text += `${GAME_NAMES[s.game_type] || s.game_type}\n`;
    text += `  Уровень: ${s.level} | XP: ${s.xp}\n`;
    text += `  Победы: ${s.wins} | Поражения: ${s.losses} | Ничьи: ${s.draws}\n\n`;
  }

  bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
});

// Handle inline button callbacks
bot.on('callback_query', async (query) => {
  await bot.answerCallbackQuery(query.id);
});

// Register bot commands with Telegram
bot.setMyCommands([
  { command: 'start',       description: 'Главное меню' },
  { command: 'play',        description: 'Открыть игры' },
  { command: 'stats',       description: 'Моя статистика' },
  { command: 'help',        description: 'Помощь' },
]).catch(console.error);

console.log('🤖 Telegram bot started');
module.exports = bot;

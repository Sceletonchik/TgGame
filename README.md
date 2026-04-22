# 🎮 GameArena — Telegram Mini App

Все три части проекта хостятся **целиком на Render** — Node.js не нужен локально,
ничего собирать руками не нужно.

```
gamearena-backend   → Render Web Service     (Node.js, Express + Socket.io)
gamearena-frontend  → Render Static Site     (React + Vite, собирается на Render)
gamearena-bot       → Render Background Worker (Python, aiogram 3)
```

---

## 🚀 Деплой: шаг за шагом

### Шаг 1 — Создать бота в Telegram

1. Открыть [@BotFather](https://t.me/BotFather)
2. Написать `/newbot`
3. Задать имя (например `GameArena`) и юзернейм (например `gamearena_my_bot`)
4. Сохранить токен вида `1234567890:ABCDefgh...` — понадобится на шаге 4

---

### Шаг 2 — Загрузить проект на GitHub

> ⚠️ Git нужен только чтобы загрузить файлы. Если нет — используйте [GitHub Desktop](https://desktop.github.com/) или загрузите ZIP прямо через браузер.

**Через браузер (без Git):**
1. Перейти на [github.com](https://github.com) → войти / зарегистрироваться
2. Нажать **"+"** → **New repository**
3. Назвать `gamearena` → **Create repository**
4. На странице репо нажать **"uploading an existing file"**
5. Перетащить **все файлы и папки** из архива (кроме `node_modules` и `.venv`)
6. Нажать **Commit changes**

---

### Шаг 3 — Задеплоить на Render через Blueprint

1. Перейти на [render.com](https://render.com) → войти / зарегистрироваться (бесплатно)
2. Нажать **New +** → **Blueprint**
3. Нажать **Connect account** → выбрать GitHub → разрешить доступ
4. Выбрать репозиторий `gamearena`
5. Render автоматически найдёт файл `render.yaml` и покажет 3 сервиса:
   ```
   ✓ gamearena-backend    (Web Service)
   ✓ gamearena-frontend   (Static Site)
   ✓ gamearena-bot        (Background Worker)
   ```

---

### Шаг 4 — Заполнить переменную BOT_TOKEN

После того как Render покажет список сервисов, он попросит заполнить секреты.
Найдите поле `BOT_TOKEN` (у сервиса `gamearena-bot`) и вставьте токен из шага 1.

> Все остальные переменные (`MINI_APP_URL`, `API_URL`, `VITE_API_URL`, `VITE_SOCKET_URL`)
> заполнятся **автоматически** через `fromService` в `render.yaml` — трогать не нужно.

Нажать **Apply** — Render запустит сборку и деплой всех трёх сервисов.

Сборка займёт 3–7 минут. Следите за логами в разделе **Logs** каждого сервиса.

---

### Шаг 5 — Подключить Mini App к боту

После успешного деплоя:

1. Скопировать URL фронтенда из Render Dashboard:
   ```
   https://gamearena-frontend.onrender.com
   ```
2. Открыть [@BotFather](https://t.me/BotFather)
3. Написать `/mybots` → выбрать своего бота → **Bot Settings** → **Menu Button** → **Configure menu button**
4. Вставить URL фронтенда
5. Также `/newapp`:
   - Выбрать бота
   - Придумать короткое имя для app (например `play`)
   - Вставить тот же URL фронтенда
6. Написать боту `/start` — появится кнопка **🎮 Играть** → нажать → откроется Mini App

---

## Переменные окружения

Все они **проставляются автоматически** через `render.yaml`. Для справки:

| Переменная         | Сервис             | Значение                                      |
|--------------------|--------------------|-----------------------------------------------|
| `BOT_TOKEN`        | bot                | Токен от BotFather — **вписать вручную**      |
| `MINI_APP_URL`     | backend, bot       | Авто: URL `gamearena-frontend`                |
| `API_URL`          | bot                | Авто: URL `gamearena-backend`                 |
| `VITE_API_URL`     | frontend (build)   | Авто: URL `gamearena-backend`                 |
| `VITE_SOCKET_URL`  | frontend (build)   | Авто: URL `gamearena-backend`                 |
| `NODE_ENV`         | backend            | `production`                                  |
| `KEEPALIVE_INTERVAL`| bot               | `600` (пинг каждые 10 мин)                   |

---

## Структура проекта

```
telegram-game-app/
├── render.yaml              ← Blueprint: 3 сервиса одной кнопкой
│
├── bot/                     ← 🐍 Python Telegram бот
│   ├── bot.py               ← aiogram 3, все команды, keep-alive
│   ├── requirements.txt     ← aiogram, aiohttp, python-dotenv
│   └── runtime.txt          ← Python 3.11.9
│
├── backend/                 ← ⚙️ Node.js API + Socket.io
│   ├── server.js            ← Express + Socket.io
│   ├── database.js          ← lowdb (JSON файл, без SQL)
│   ├── Procfile             ← web: node server.js
│   ├── routes/
│   │   ├── users.js         ← Auth, профиль, поиск, лидерборд
│   │   ├── friends.js       ← Друзья: запросы, принятие, удаление
│   │   └── games.js         ← Сессии и лобби
│   └── socket/
│       └── gameHandler.js   ← Real-time ходы, XP начисление
│
└── frontend/                ← ⚛️ React + Vite (Mini App)
    ├── vite.config.js       ← Автопрокси локально, env на Render
    └── src/
        ├── App.jsx
        ├── api.js           ← Берёт VITE_API_URL из env
        ├── components/
        │   ├── GameLobby.jsx    ← Выбор игры, лобби, матчмейкинг
        │   ├── Profile.jsx      ← Уровни + XP-бары по каждой игре
        │   ├── Friends.jsx      ← Поиск, добавление, управление
        │   ├── Leaderboard.jsx  ← Топ-20 с подиумом 🥇🥈🥉
        │   └── games/
        │       ├── Chess.jsx        ← ♟ Шахматы (рокировка, мат, пат)
        │       ├── Checkers.jsx     ← 🔴 Шашки (дамки, цепочки взятий)
        │       ├── Battleship.jsx   ← 🚢 Морской бой (расстановка + бой)
        │       ├── Gomoku.jsx       ← ⬤ Пять в ряд (15×15)
        │       └── Connect4.jsx     ← 🟡 Четыре в ряд с гравитацией
        └── hooks/
            └── useTelegram.js   ← Telegram WebApp SDK + дев-фоллбэк
```

---

## Команды бота

| Команда        | Что делает                                            |
|----------------|-------------------------------------------------------|
| `/start`       | Приветствие + главное меню с кнопкой Mini App         |
| `/play`        | Сетка всех 5 игр — нажать → сразу открывается игра   |
| `/stats`       | Статистика: XP-бары, уровни, W/L/D по каждой игре    |
| `/leaderboard` | Топ-10 игроков → выбор игры через inline-кнопки       |
| `/friends`     | Список друзей, входящие и исходящие запросы           |
| `/help`        | Список команд и объяснение системы уровней            |
| `@бот`         | Inline: отправить приглашение в любой чат             |

---

## Система уровней и XP

| Результат   | XP     |
|-------------|--------|
| Победа      | +50 XP |
| Ничья       | +15 XP |
| Поражение   | +5 XP  |

**Формула следующего уровня:** `floor(100 × 1.4 ^ (уровень − 1))`

| Уровень | Звание     |
|---------|------------|
| 1–2     | 🥉 Новичок |
| 3–5     | 🥈 Игрок   |
| 6–9     | 🥇 Ветеран |
| 10–14   | 💎 Мастер  |
| 15+     | 👑 Легенда |

---

## ⚠️ Особенности Render Free Plan

| Сервис     | Тип     | Поведение                                                |
|------------|---------|----------------------------------------------------------|
| backend    | Web     | Засыпает через 15 мин без запросов, просыпается ~30 сек |
| frontend   | Static  | **Не засыпает** — CDN, всегда быстрый                   |
| bot        | Worker  | **Не засыпает** — фоновый процесс                       |

**Решение для backend:** бот сам пингует `/health` каждые 10 минут (`KEEPALIVE_INTERVAL=600`).
Это предотвращает засыпание пока хотя бы один пользователь запускал бота за последние 10 минут.

**Данные:** хранятся в `game.db.json` на диске Render. При **redeploy сервиса** файл сбрасывается.
Для сохранения данных между деплоями — подключите **Render Disk** ($7/мес) или используйте
[MongoDB Atlas](https://www.mongodb.com/atlas) (free 512MB).

---

## Локальная разработка (если установить Node.js)

```powershell
# Установить Node.js: https://nodejs.org → LTS версия → скачать .msi → установить

# Backend
cd backend
copy .env.example .env
npm install
npm run dev          # http://localhost:3001

# Frontend (в новом окне PowerShell)
cd frontend
npm install
npm run dev          # http://localhost:5173

# Bot (в третьем окне)
cd bot
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # вписать BOT_TOKEN
python bot.py
```

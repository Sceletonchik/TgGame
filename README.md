# 🎮 GameArena — Telegram Mini App

Полноценный игровой Telegram бот с Mini App на React. Шахматы, Шашки, Морской бой, Пять в ряд, Четыре в ряд — всё с рейтингами, уровнями и системой друзей.

---

## Архитектура

```
telegram-game-app/
├── backend/               # Node.js + Express + Socket.io + SQLite
│   ├── server.js          # HTTP + WebSocket сервер
│   ├── bot.js             # Telegram бот
│   ├── database.js        # SQLite + все хелперы
│   ├── routes/
│   │   ├── users.js       # Auth, профиль, статистика, лидерборд
│   │   ├── friends.js     # Друзья, запросы
│   │   └── games.js       # Сессии, лобби
│   └── socket/
│       └── gameHandler.js # Real-time ходы, результаты, XP
└── frontend/              # React + Vite Telegram Mini App
    └── src/
        ├── App.jsx
        ├── api.js
        ├── hooks/useTelegram.js
        └── components/
            ├── Navigation.jsx
            ├── Profile.jsx       # Статистика и уровни по каждой игре
            ├── Friends.jsx       # Поиск, добавление, управление друзьями
            ├── Leaderboard.jsx   # Рейтинг по каждой игре
            ├── GameLobby.jsx     # Выбор игры, лобби, матчмейкинг
            └── games/
                ├── Chess.jsx      # ♟ Шахматы (полные правила)
                ├── Checkers.jsx   # 🔴 Русские шашки с дамками
                ├── Battleship.jsx # 🚢 Морской бой (расстановка + бой)
                ├── Gomoku.jsx     # ⬤ Пять в ряд (15×15)
                └── Connect4.jsx   # 🟡 Четыре в ряд с гравитацией
```

---

## Быстрый старт

### 1. Создайте бота

1. Напишите [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → получите `BOT_TOKEN`
3. `/newapp` → создайте Mini App, укажите URL вашего фронтенда

### 2. Бэкенд

```bash
cd backend
cp .env .env
# Заполните .env:
#   BOT_TOKEN=ваш_токен
#   MINI_APP_URL=https://ваш-домен.com
#   PORT=3001

npm install
npm start
```

### 3. Фронтенд

```bash
cd frontend
npm install

# Для разработки (с проксированием на localhost:3001)
npm run dev

# Для продакшена
npm run build
# Содержимое dist/ разместите на вебхостинге (Vercel, Nginx и т.д.)
```

### 4. Переменные окружения (фронтенд)

Создайте `frontend/.env`:
```
VITE_API_URL=https://ваш-бэкенд.com
VITE_SOCKET_URL=https://ваш-бэкенд.com
```

---

## База данных (SQLite)

| Таблица          | Назначение                              |
|------------------|-----------------------------------------|
| `users`          | Telegram пользователи (id, ник, фото)   |
| `player_stats`   | Уровень и XP по каждой из 5 игр         |
| `friends`        | Дружба (pending / accepted)             |
| `game_sessions`  | Активные и завершённые игровые сессии   |
| `chat_messages`  | Игровой чат                             |

### Система уровней и XP

| Результат | XP     |
|-----------|--------|
| Победа    | +50 XP |
| Ничья     | +15 XP |
| Поражение | +5 XP  |

**Формула уровня:** `XP для следующего = floor(100 × 1.4^(уровень−1))`

---

## API Endpoints

### Пользователи
| Метод | URL                              | Описание               |
|-------|----------------------------------|------------------------|
| POST  | `/api/users/auth`                | Вход / регистрация     |
| GET   | `/api/users/:id/stats`           | Статистика игрока      |
| GET   | `/api/users/:id/profile`         | Полный профиль         |
| GET   | `/api/users/search?q=…`          | Поиск пользователей    |
| GET   | `/api/users/leaderboard/:game`   | Рейтинг по игре        |

### Друзья
| Метод  | URL                          | Описание              |
|--------|------------------------------|-----------------------|
| GET    | `/api/friends/:userId`       | Список друзей         |
| POST   | `/api/friends/request`       | Отправить запрос      |
| POST   | `/api/friends/accept`        | Принять запрос        |
| POST   | `/api/friends/reject`        | Отклонить запрос      |
| DELETE | `/api/friends/:id/:friendId` | Удалить из друзей     |

### Игры
| Метод | URL                            | Описание                |
|-------|--------------------------------|-------------------------|
| GET   | `/api/games/sessions/:type`    | Открытые лобби          |
| POST  | `/api/games/sessions`          | Создать сессию          |
| GET   | `/api/games/leaderboard/:type` | Топ по игре             |

---

## Socket.io события

| Событие (клиент→сервер) | Описание                    |
|-------------------------|-----------------------------|
| `join_session`          | Войти в комнату             |
| `create_session`        | Создать игровую комнату     |
| `game_move`             | Отправить ход               |
| `game_over`             | Завершить игру              |
| `resign`                | Сдаться                     |
| `offer_draw`            | Предложить ничью            |
| `accept_draw`           | Принять ничью               |
| `chat_message`          | Сообщение в чат             |

| Событие (сервер→клиент) | Описание                    |
|-------------------------|-----------------------------|
| `session_start`         | Оба игрока в лобби          |
| `opponent_move`         | Ход противника              |
| `game_finished`         | Игра завершена              |
| `draw_offered`          | Предложение ничьей          |
| `opponent_disconnected` | Противник отключился        |

---

## Деплой (рекомендуется)

### Бэкенд: Railway / Render / VPS
```bash
# Переменные окружения на сервере:
BOT_TOKEN=...
MINI_APP_URL=https://your-frontend.vercel.app
PORT=3001
NODE_ENV=production
```

### Фронтенд: Vercel
```bash
cd frontend
npm run build
# Деплой папки dist/ на Vercel
# Установите переменные:
# VITE_API_URL=https://your-backend.railway.app
# VITE_SOCKET_URL=https://your-backend.railway.app
```

---

## Функции

- ♟ **Шахматы** — полные правила: рокировка, взятие на проходе, превращение пешки, проверка шаха и мата
- 🔴 **Русские шашки** — дамки, обязательное взятие, цепочка взятий
- 🚢 **Морской бой** — расстановка флота, авторасстановка, ручное и авто
- ⬤ **Пять в ряд** — доска 15×15, подсветка победной линии
- 🟡 **Четыре в ряд** — доска 7×6 с гравитацией, hover-preview
- 👥 **Друзья** — поиск, запросы, принятие/отклонение
- 📊 **Уровни** — отдельный уровень и XP для каждой из 5 игр
- 🏆 **Рейтинг** — топ-20 по каждой игре с подиумом
- 👤 **Профиль** — аватарка и ник из Telegram, полная статистика
- ⚡ **Реальное время** — Socket.io для мгновенного обмена ходами
#   T g G a m e  
 
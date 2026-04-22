# 🎮 GameArena — Инструкция по настройке на Render

---

## 📋 Что уже сделано
- ✅ Бот `@ArtemMiniGamesBot` задеплоен и запущен
- ✅ Бэкенд задеплоен на `https://tggame-hdss.onrender.com`
- ❌ Фронтенд (Static Site) не создан
- ❌ `MINI_APP_URL` не прописан нигде
- ❌ Бот задеплоен как Web Service — нужно исправить на Worker

---

## 🔧 Шаг 1 — Задеплоить фронтенд

В Render Dashboard:

1. Нажать **New +** → **Static Site**
2. Выбрать ваш репозиторий `TgGame`
3. Заполнить поля:

   | Поле | Значение |
   |------|----------|
   | **Name** | `gamearena-frontend` |
   | **Root Directory** | `frontend` |
   | **Build Command** | `npm install && npm run build` |
   | **Publish Directory** | `dist` |

4. Перед нажатием **Create Static Site** добавить переменные окружения:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://tggame-hdss.onrender.com` |
   | `VITE_SOCKET_URL` | `https://tggame-hdss.onrender.com` |

5. Нажать **Create Static Site**
6. Дождаться сборки (~3–5 мин)
7. Скопировать URL фронтенда — вида `https://gamearena-frontend.onrender.com`

---

## 🔧 Шаг 2 — Прописать MINI_APP_URL в бот

В Render Dashboard → сервис **gamearena-bot** (или как он называется) → **Environment**:

| Key | Value |
|-----|-------|
| `MINI_APP_URL` | `https://gamearena-frontend.onrender.com` ← URL из шага 1 |
| `API_URL` | `https://tggame-hdss.onrender.com` ← URL вашего бэкенда |

Нажать **Save Changes** → бот автоматически перезапустится.

---

## 🔧 Шаг 3 — Прописать MINI_APP_URL в бэкенд

В Render Dashboard → сервис **tggame** (бэкенд) → **Environment**:

| Key | Value |
|-----|-------|
| `MINI_APP_URL` | `https://gamearena-frontend.onrender.com` |

Нажать **Save Changes**.

---

## 🔧 Шаг 4 — Исправить тип бот-сервиса (Worker вместо Web)

Текущая проблема в логах:
```
==> No open ports detected, continuing to scan...
```
Это значит бот задеплоен как **Web Service**, а должен быть **Background Worker**.

**Как исправить:**

**Вариант A (через Blueprint, рекомендуется):**
1. Удалить все текущие сервисы в Render Dashboard
2. Загрузить обновлённые файлы на GitHub (этот архив)
3. Render → **New +** → **Blueprint** → выбрать репо
4. Render создаст правильные типы сервисов из `render.yaml`
5. Вписать переменные вручную (см. шаги 2–3)

**Вариант B (оставить как есть):**
Бот всё равно работает даже с предупреждением про порты. Это просто предупреждение, не ошибка. Можно игнорировать.

---

## 🔧 Шаг 5 — Подключить Mini App к боту в BotFather

1. Открыть [@BotFather](https://t.me/BotFather)
2. Написать `/mybots`
3. Выбрать `@ArtemMiniGamesBot`
4. **Bot Settings** → **Menu Button** → **Configure menu button**
5. Вставить URL: `https://gamearena-frontend.onrender.com`
6. Потом: **Bot Settings** → **Edit Bot** → найти раздел **Mini App**
   - Если нет Mini App: `/newapp` → выбрать бота → задать короткое имя → вставить URL
7. Написать боту `/start` → должна появиться кнопка **🎮 Играть**
8. Нажать кнопку → откроется Mini App с играми

---

## ✅ Как проверить что всё работает

После всех шагов:

```
Бот:      @ArtemMiniGamesBot → /start → кнопка "Играть" → Mini App с играми
Бэкенд:   https://tggame-hdss.onrender.com/health → {"ok":true}
Фронтенд: https://gamearena-frontend.onrender.com → страница приложения
```

---

## ⚠️ Бэкенд засыпает (free plan)

Первые запросы после простоя идут ~30 сек. Бот пингует бэкенд каждые 10 минут
через `keepalive_loop` — если хоть один пользователь взаимодействует с ботом в день,
бэкенд не будет засыпать.

Если бэкенд всё равно засыпает — добавьте в Render бесплатный **Cron Job**:
- Schedule: `*/10 * * * *`
- Command: `curl https://tggame-hdss.onrender.com/health`

---

## 🗂 Структура на Render после полной настройки

```
Render Dashboard:
├── gamearena-backend   Web Service   (Node.js)   https://tggame-hdss.onrender.com
├── gamearena-frontend  Static Site   (React)     https://gamearena-frontend.onrender.com
└── gamearena-bot       Worker        (Python)     — (без URL, фоновый процесс)
```

---

## Переменные окружения (итоговая таблица)

### gamearena-bot (Worker)
| Переменная | Значение |
|------------|----------|
| `BOT_TOKEN` | токен от BotFather |
| `MINI_APP_URL` | `https://gamearena-frontend.onrender.com` |
| `API_URL` | `https://tggame-hdss.onrender.com` |
| `KEEPALIVE_INTERVAL` | `600` |

### gamearena-backend (Web Service)
| Переменная | Значение |
|------------|----------|
| `NODE_ENV` | `production` |
| `MINI_APP_URL` | `https://gamearena-frontend.onrender.com` |

### gamearena-frontend (Static Site)
| Переменная | Значение |
|------------|----------|
| `VITE_API_URL` | `https://tggame-hdss.onrender.com` |
| `VITE_SOCKET_URL` | `https://tggame-hdss.onrender.com` |

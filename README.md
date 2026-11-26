# АгроМаркет API

![CI](https://github.com/ЛОГИН/agromarket-api/actions/workflows/ci.yml/badge.svg)

Backend интернет-магазина фермерских продуктов: Node.js + Express 5 + PostgreSQL.
Frontend — в соседней папке/репозитории `agromarket-react`.

**Живые ссылки:** API — `https://agromarket-api-ЛОГИН.onrender.com/api/health`, сайт — `https://agromarket-ЛОГИН.vercel.app`.

## Структура

```
agromarket-api/
├── server.js                 ← точка входа: проверка env, listen, SIGTERM
├── app.js                    ← сборка приложения и middleware (импортируют тесты)
├── routes/                   ← auth, products, orders, categories
├── middleware/               ← logger, auth, rateLimit, validate, idParam, errorHandler
├── validation/schemas.js     ← схемы zod
├── db/
│   ├── pool.js               ← пул соединений
│   ├── schema.sql            ← таблицы (CREATE ... IF NOT EXISTS)
│   ├── bootstrap.js          ← схема + товары + админ
│   ├── seed.js               ← npm run db:init  — полный сброс (только локально)
│   └── migrate.js            ← npm run db:migrate — безопасная миграция
├── data/db.json              ← начальные товары
├── tests/                    ← Vitest + Supertest
├── postman/                  ← коллекция Postman
├── scripts/smoke.js          ← smoke-тест продакшена
├── requests.http             ← запросы для REST Client
├── Dockerfile, docker-compose.yml, render.yaml
├── ANSWERS.md                ← ответы на вопросы защиты ЛР 1–12
└── .github/workflows/ci.yml  ← test → deploy → smoke
```

Конвейер middleware: `helmet → cors → express.json → logger → [rateLimit → validate → requireAuth → requireRole] → маршрут → 404 → errorHandler`.

## Запуск

```bash
cp .env.example .env              # заполнить DATABASE_URL, JWT_SECRET, ADMIN_*
npm install                       # создаст package-lock.json — закоммитьте его
npm run db:init                   # таблицы, товары из data/db.json, админ
npm run dev                       # http://localhost:3001
```

| Скрипт | Назначение |
|---|---|
| `npm run dev` / `npm start` | разработка (`node --watch`) / продакшен |
| `npm run db:init` | полный сброс базы. На нелокальной базе нужен `--force` |
| `npm run db:migrate` | идемпотентная миграция: недостающие таблицы, товары в пустую базу, админ |
| `npm test` / `npm run coverage` | автотесты / отчёт о покрытии |
| `npm run smoke` | smoke-тест продакшена (`API_URL`, `FRONTEND_URL`) |

### Тестирование

1. Создайте базу `agromarket_test` (в имени обязательно слово `test` — иначе тесты не запустятся).
2. `cp .env.test.example .env.test` и проверьте строку подключения.
3. `npm test`.

### Docker (весь стек)

Папки `agromarket-api` и `agromarket-react` должны лежать рядом. Из папки `agromarket-api`:

```bash
docker compose up -d --build      # сайт: http://localhost:8080
docker compose logs -f api
docker compose down               # данные в volume pgdata сохраняются
docker compose down -v            # удалить и базу
```

Админ: `admin@agromarket.kz` / `Admin12345` (переменные `ADMIN_*`).

## Переменные окружения

| Переменная | Где задана | Секрет |
|---|---|---|
| `DATABASE_URL` | `.env` / Render | да |
| `JWT_SECRET` | `.env` / Render (от 32 символов в продакшене) | да |
| `JWT_EXPIRES_IN` | `.env` / Render | нет |
| `CORS_ORIGIN` | `.env` / Render (через запятую, без `/` в конце) | нет |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `.env` / Docker | пароль — да |
| `RENDER_DEPLOY_HOOK_URL` | GitHub Secrets | да |
| `API_URL`, `FRONTEND_URL` | GitHub Variables | нет |

## Эндпоинты

| Метод | Путь | Доступ | Ответы |
|---|---|---|---|
| GET | `/api/health` | все | 200, 503 |
| GET | `/api/products?search=&category=&maxPrice=&sort=` | все | 200 |
| GET | `/api/products/:id` | все | 200, 400, 404 |
| POST | `/api/products` | farmer, admin | 201, 400, 401, 403 |
| PUT | `/api/products/:id` | farmer, admin | 200, 400, 401, 403, 404 |
| PATCH | `/api/products/:id` | farmer, admin | 200, 400, 401, 403, 404 |
| DELETE | `/api/products/:id` | farmer, admin | 204, 401, 403, 404 |
| GET | `/api/categories` | все | 200 |
| POST | `/api/auth/register` | все | 201, 400, 409, 429 |
| POST | `/api/auth/login` | все | 200, 400, 401, 429 |
| GET | `/api/auth/me` | токен | 200, 401 |
| PATCH | `/api/auth/password` | токен | 200, 400, 401 |
| POST | `/api/orders` | все (токен необязателен) | 201, 400 |
| GET | `/api/orders` | admin | 200, 401, 403 |
| GET | `/api/orders/my` | токен | 200, 401 |
| PATCH | `/api/orders/:id` | admin | 200, 400, 401, 403, 404 |

Сортировка: `sort=price` / `price_asc`, `sort=-price` / `price_desc`, `sort=name`.
Заявка: `{ name, email, phone?, comment? }` плюс либо `quantity` (от 10 кг, опт), либо `items: [{ productId, quantity }]` (корзина).

## Таблицы БД

```
users ──1:N── orders ──1:N── order_items ──N:1── products
```

- `users` (id, name, email UNIQUE, password_hash, role, created_at)
- `products` (id, name, price, unit, category, image, stock, description, created_at)
- `orders` (id, user_id, name, email, phone, quantity, date, comment, status, total, created_at)
- `order_items` (id, order_id, product_id, name, price, quantity)

## Безопасность

- `helmet`, CORS-белый список, `trust proxy` для Render
- rate limit на вход и регистрацию: 10 неудачных попыток за 15 минут
- валидация `zod` (лишние поля вроде `role` отбрасываются), `:id` — только положительное целое
- тело запроса — до 100 КБ, пароль — 8–72 символа, хэши bcrypt
- в продакшене ошибки 500 без деталей, SQL — только параметризованные запросы

## Деплой

1. **Neon** (Frankfurt): один раз `node --env-file=.env.neon db/seed.js --force`.
2. **Render:** Build `npm ci --omit=dev`, Start `npm run db:migrate && npm start`, Health Check `/api/health`, Auto-Deploy `Off`. Настройки — в `render.yaml`.
3. **GitHub Actions:** секрет `RENDER_DEPLOY_HOOK_URL`, переменные `API_URL`, `FRONTEND_URL`.
4. **Релиз:** `git tag -a v1.0.0 -m "АгроМаркет 1.0"` → `git push origin v1.0.0`.

## Правила работы с Git

- Ветка `main` защищена: изменения — только через Pull Request с ревью и зелёным CI.

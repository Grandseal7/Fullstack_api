// app.js — сборка Express-приложения (без listen — его импортируют тесты Supertest)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { pool } from './db/pool.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';
import categoriesRouter from './routes/categories.js';

const app = express();

// Версия = первые 7 символов коммита. Render сам кладёт SHA в RENDER_GIT_COMMIT
const VERSION = (process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || 'local').slice(0, 7);

// За прокси-балансировщиком (Render, Nginx) настоящий IP приходит в X-Forwarded-For.
// Без этой строки rate limit считал бы всех пользователей одним IP
app.set('trust proxy', 1);

// ===== Конвейер middleware: helmet → cors → json → logger → маршруты → 404 → ошибки =====
app.use(helmet()); // заголовки безопасности, убирает X-Powered-By

// CORS_ORIGIN — несколько адресов через запятую
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Запросы без Origin (curl, Postman, Supertest, Nginx-прокси) пропускаем:
    // CORS защищает браузер пользователя, а не сервер
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false); // чужой сайт не получит Access-Control-Allow-Origin
  },
}));

app.use(express.json({ limit: '100kb' })); // тело запроса → req.body, не больше 100 КБ

if (process.env.NODE_ENV !== 'test') {
  app.use(logger);
}

// ===== Маршруты =====
app.get('/', (req, res) => {
  res.send('АгроМаркет API работает');
});

// Health-check: «ок» только если отвечает и база
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'ok', version: VERSION, time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'unavailable', version: VERSION });
  }
});

app.get('/api/about', (req, res) => {
  res.json({ name: 'АгроМаркет', version: '1.0.0', author: 'ФИО студента' });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/categories', categoriesRouter);

// Сюда доходят только запросы, которые не обработал ни один маршрут
app.use((req, res) => {
  res.status(404).json({ error: `Маршрут ${req.method} ${req.originalUrl} не найден` });
});

// Централизованный обработчик ошибок — ровно 4 параметра
app.use(errorHandler);

export default app;

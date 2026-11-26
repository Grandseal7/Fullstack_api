// db/pool.js — пул соединений с PostgreSQL
import 'dotenv/config';
import pg from 'pg';

// NUMERIC (цены) по умолчанию приходит строкой — превращаем в число
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

export const pool = new pg.Pool({
  // Локально и в Docker — без SSL; для Neon SSL включается параметром ?sslmode=require
  // в самой строке. DB_SSL=true — запасной вариант для провайдеров без sslmode в строке.
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Облачная база может сама разорвать простаивающее соединение.
// Без этого обработчика такая ошибка завершила бы весь процесс
pool.on('error', (err) => {
  console.error('PostgreSQL: соединение потеряно —', err.message);
});

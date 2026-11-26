// server.js — точка входа: проверка окружения, запуск сервера, корректное завершение
import 'dotenv/config';
import app from './app.js';
import { pool } from './db/pool.js';

// Без этих переменных запускаться бессмысленно — падаем сразу и с понятным текстом
const required = ['DATABASE_URL', 'JWT_SECRET', 'CORS_ORIGIN'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error('Не заданы переменные окружения:', missing.join(', '));
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET слишком короткий для продакшена (нужно от 32 символов)');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`АгроМаркет API: порт ${PORT}, режим ${process.env.NODE_ENV || 'development'}`);
});

// Хостинг (Render, Docker) останавливает старую версию сигналом SIGTERM.
// Даём текущим запросам завершиться и аккуратно закрываем соединения с базой
function shutdown(signal) {
  console.log(`${signal}: завершаем работу...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

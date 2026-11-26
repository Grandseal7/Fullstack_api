// db/migrate.js (npm run db:migrate) — безопасная миграция, запускается при каждом старте сервера.
// НЕ удаляет данные: создаёт только недостающее. Повторный запуск = тот же результат
import 'dotenv/config';
import { pool } from './pool.js';
import { applySchema, seedProductsIfEmpty, ensureAdmin } from './bootstrap.js';

try {
  await applySchema(pool);
  const added = await seedProductsIfEmpty(pool); // пустая база (Docker, новый Neon) получит товары
  await ensureAdmin(pool);
  console.log(`Миграция выполнена${added ? `, товаров добавлено — ${added}` : ''}`);
} catch (err) {
  console.error('Миграция не удалась:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

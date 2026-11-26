// db/seed.js (npm run db:init) — ПОЛНАЯ переинициализация базы: DROP + CREATE + товары + админ.
// Для локальной разработки, тестов и CI. На облачной базе — один раз и только с --force
import 'dotenv/config';

// --- Предохранитель: db:init УДАЛЯЕТ ВСЕ ТАБЛИЦЫ ---
const target = process.env.DATABASE_URL || process.env.PGHOST || '';
const isLocal = /localhost|127\.0\.0\.1|@db:/.test(target);
if (!isLocal && !process.argv.includes('--force')) {
  console.error('Отказ: db:init запущен НЕ на локальной базе — все данные будут удалены.');
  console.error('Если база пустая и вы уверены: node db/seed.js --force');
  process.exit(1);
}

const { pool } = await import('./pool.js');
const { applySchema, seedProductsIfEmpty, ensureAdmin } = await import('./bootstrap.js');

try {
  // Порядок DROP: сначала те, кто ссылается на других
  await pool.query(`
    DROP TABLE IF EXISTS order_items;
    DROP TABLE IF EXISTS orders;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS users;
  `);
  await applySchema(pool);
  const count = await seedProductsIfEmpty(pool);
  await ensureAdmin(pool);
  console.log(`Готово: товаров — ${count}, админ — ${process.env.ADMIN_EMAIL || 'не задан'}`);
} catch (err) {
  console.error('db:init не удался:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

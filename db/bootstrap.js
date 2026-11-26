// db/bootstrap.js — общие шаги для seed.js и migrate.js: схема, товары, администратор
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf-8');

// Создаёт недостающие таблицы (schema.sql целиком из CREATE ... IF NOT EXISTS)
export async function applySchema(pool) {
  await pool.query(read('./schema.sql'));
}

// Переносит товары из data/db.json, только если каталог пуст.
// Повторный запуск ничего не дублирует (идемпотентность)
export async function seedProductsIfEmpty(pool) {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n > 0) return 0;

  const { products } = JSON.parse(read('../data/db.json'));
  for (const p of products) {
    await pool.query(
      `INSERT INTO products (name, price, unit, category, stock, description, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        p.name,
        Number(p.price),
        p.unit ?? 'кг',
        p.category ?? 'Разное',
        p.stock ?? 0,
        p.description ?? null,
        p.image ?? 'https://placehold.co/300x200',
      ],
    );
  }
  return products.length;
}

// Через регистрацию можно стать только покупателем (buyer).
// Администратора создаём здесь: email и пароль из .env, в базу — только хэш
export async function ensureAdmin(pool) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return false;

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Администратор', $1, $2, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_EMAIL.trim().toLowerCase(), hash],
  );
  return true;
}

// routes/orders.js — оптовые заявки и заказы из корзины
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../middleware/idParam.js';
import { orderSchema, orderStatusSchema } from '../validation/schemas.js';

const router = Router();
const adminOnly = [requireAuth, requireRole('admin')];

async function attachItems(orders) {
  if (orders.length === 0) return orders;
  const ids = orders.map((o) => o.id);
  const { rows } = await pool.query(
    'SELECT order_id, product_id, name, price, quantity FROM order_items WHERE order_id = ANY($1)',
    [ids],
  );
  return orders.map((o) => ({ ...o, items: rows.filter((i) => i.order_id === o.id) }));
}

// POST /api/orders — оставить заявку может любой посетитель (токен необязателен)
router.post('/', optionalAuth, validate(orderSchema), async (req, res, next) => {
  const { name, email, phone, quantity, date, comment, items = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Цены берём из базы, а не от клиента: сервер никогда не доверяет клиенту
    let total = 0;
    const lines = [];
    for (const item of items) {
      const { rows } = await client.query('SELECT id, name, price FROM products WHERE id = $1', [item.productId]);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Товар с id ${item.productId} не найден` });
      }
      const product = rows[0];
      total += product.price * item.quantity;
      lines.push({ ...product, quantity: item.quantity });
    }

    const { rows } = await client.query(
      `INSERT INTO orders (user_id, name, email, phone, quantity, date, comment, total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user?.id ?? null, name, email, phone ?? null, quantity ?? null, date ?? null, comment ?? null, total],
    );
    const order = rows[0];

    for (const line of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, line.id, line.name, line.price, line.quantity],
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ ...order, items: lines });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/orders — все заявки (персональные данные клиентов → только admin)
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(await attachItems(rows));
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/my — заявки текущего пользователя. Объявлен ДО /:id
router.get('/my', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id],
    );
    res.json(await attachItems(rows));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id  { status } — смена статуса заявки
router.patch('/:id', adminOnly, idParam, validate(orderStatusSchema), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [req.body.status, req.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;

// routes/products.js — каталог: полный CRUD
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../middleware/idParam.js';
import { productSchema, productUpdateSchema } from '../validation/schemas.js';

const router = Router();

// Менять каталог могут фермер и администратор
const canEdit = [requireAuth, requireRole('farmer', 'admin')];

const FIELDS = ['name', 'price', 'category', 'unit', 'stock', 'image', 'description'];

const SORTS = {
  price: 'price ASC',
  price_asc: 'price ASC',
  '-price': 'price DESC',
  price_desc: 'price DESC',
  name: 'name ASC',
};

// GET /api/products?search=мёд&category=Овощи&maxPrice=5000&sort=-price
router.get('/', async (req, res, next) => {
  try {
    const { search, category, maxPrice, sort } = req.query;
    const where = [];
    const params = [];

    // Только параметризованные запросы ($1, $2...) — защита от SQL-инъекций
    if (search) {
      params.push(`%${String(search)}%`);
      where.push(`name ILIKE $${params.length}`);
    }
    if (category) {
      params.push(String(category));
      where.push(`LOWER(category) = LOWER($${params.length})`);
    }
    if (maxPrice !== undefined && maxPrice !== '' && !Number.isNaN(Number(maxPrice))) {
      params.push(Number(maxPrice));
      where.push(`price <= $${params.length}`);
    }

    // Сортировка — только из белого списка, никакой подстановки строки клиента в SQL
    const orderBy = SORTS[sort] || 'id ASC';
    const sql = `SELECT * FROM products
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY ${orderBy}`;

    const { rows } = await pool.query(sql, params);
    res.set('Cache-Control', 'public, max-age=30');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get('/:id', idParam, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/products → 201
router.post('/', canEdit, validate(productSchema), async (req, res, next) => {
  try {
    const p = req.body;
    const { rows } = await pool.query(
      `INSERT INTO products (name, price, category, unit, stock, image, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [p.name, p.price, p.category, p.unit, p.stock, p.image, p.description ?? null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/products/:id — полное обновление (поля как в POST)
router.put('/:id', canEdit, idParam, validate(productSchema), async (req, res, next) => {
  try {
    const p = req.body;
    const { rows } = await pool.query(
      `UPDATE products
          SET name = $1, price = $2, category = $3, unit = $4, stock = $5, image = $6, description = $7
        WHERE id = $8
        RETURNING *`,
      [p.name, p.price, p.category, p.unit, p.stock, p.image, p.description ?? null, req.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/products/:id — частичное обновление
router.patch('/:id', canEdit, idParam, validate(productUpdateSchema), async (req, res, next) => {
  try {
    const sets = [];
    const params = [];
    for (const field of FIELDS) {
      if (req.body[field] !== undefined) {
        params.push(req.body[field]);
        sets.push(`${field} = $${params.length}`);
      }
    }
    params.push(req.id);
    const { rows } = await pool.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/products/:id → 204
router.delete('/:id', canEdit, idParam, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [req.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Товар не найден' });
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

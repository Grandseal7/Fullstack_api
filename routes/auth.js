// routes/auth.js — регистрация, вход, «кто я», смена пароля
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { registerSchema, loginSchema, passwordChangeSchema } from '../validation/schemas.js';

const router = Router();
const SALT_ROUNDS = 10;

// Токен: внутри только id и роль (payload не зашифрован — секретов не кладём),
// подпись — секретным ключом JWT_SECRET
function createToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' },
  );
}

// POST /api/auth/register  { name, email, password } → 201 { user, token }
router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    // validate() уже отбросил лишние поля: role из тела сюда не попадёт (mass assignment)
    const { name, email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // role не передаём — база поставит DEFAULT 'buyer'.
    // RETURNING без password_hash: хэш никогда не уходит клиенту
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name, email, passwordHash],
    );
    const user = rows[0];
    res.status(201).json({ user, token: createToken(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }
    next(err);
  }
});

// POST /api/auth/login  { email, password } → 200 { user, token }
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { rows } = await pool.query(
      'SELECT id, name, email, role, password_hash, created_at FROM users WHERE email = $1',
      [email],
    );
    const user = rows[0];

    // Одинаковый ответ при неверном email и неверном пароле —
    // иначе перебором можно узнать, какие адреса зарегистрированы
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const { password_hash: _hash, ...safeUser } = user;
    res.json({ user: safeUser, token: createToken(safeUser) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — данные текущего пользователя по токену
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/auth/password  { oldPassword, newPassword }
router.patch('/password', requireAuth, validate(passwordChangeSchema), async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (rows.length === 0 || !(await bcrypt.compare(oldPassword, rows[0].password_hash))) {
      return res.status(400).json({ error: 'Старый пароль неверный' });
    }
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ message: 'Пароль изменён' });
  } catch (err) {
    next(err);
  }
});

export default router;

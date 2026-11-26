// tests/helpers.js — получение токенов для тестов
import request from 'supertest';
import app from '../app.js';
import { pool } from '../db/pool.js';

export async function getAdminToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
  return res.body.token;
}

export async function getBuyerToken() {
  const email = `buyer${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.kz`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Покупатель', email, password: 'qwerty123' });
  return res.body.token;
}

// Фермер: регистрируемся покупателем и повышаем роль прямо в базе
export async function getFarmerToken() {
  const email = `farmer${Date.now()}${Math.random().toString(36).slice(2, 6)}@test.kz`;
  await request(app).post('/api/auth/register').send({ name: 'Фермер', email, password: 'qwerty123' });
  await pool.query(`UPDATE users SET role = 'farmer' WHERE email = $1`, [email]);
  const res = await request(app).post('/api/auth/login').send({ email, password: 'qwerty123' });
  return res.body.token;
}

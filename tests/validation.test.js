import request from 'supertest';
import app from '../app.js';
import { pool } from '../db/pool.js';
import { getFarmerToken } from './helpers.js';

describe('Валидация', () => {
  let farmer;
  beforeAll(async () => {
    farmer = await getFarmerToken();
  });

  it('регистрация с некорректным e-mail → 400 и поле email в details', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Тест', email: 'не-почта', password: '12345678' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toContain('email');
  });

  it('нельзя зарегистрироваться админом через поле role (mass assignment)', async () => {
    const email = `role${Date.now()}@test.kz`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Хакер', email, password: '12345678', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('buyer');
    const { rows } = await pool.query('SELECT role FROM users WHERE email = $1', [email]);
    expect(rows[0].role).toBe('buyer');
  });

  it('пароль из 7 символов → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Тест', email: `p${Date.now()}@test.kz`, password: '1234567' });
    expect(res.status).toBe(400);
  });

  it('фермер может создать товар; цена строкой "3500" приводится к числу', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmer}`)
      .send({ name: 'Мёд гречишный', price: '3500', category: 'Пчеловодство' });
    expect(res.status).toBe(201);
    expect(res.body.price).toBe(3500);
  });

  it('товар с отрицательной ценой → 400', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${farmer}`)
      .send({ name: 'Мёд', price: -500, category: 'Мёд' });
    expect(res.status).toBe(400);
  });

  it('PATCH товара с пустым телом {} → 400', async () => {
    const res = await request(app)
      .patch('/api/products/1')
      .set('Authorization', `Bearer ${farmer}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('GET /api/products/abc → 400, а не 500', async () => {
    expect((await request(app).get('/api/products/abc')).status).toBe(400);
    expect((await request(app).get('/api/products/-1')).status).toBe(400);
  });

  it('тело больше 100 КБ → 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@a.kz', password: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
});

describe('Заявки', () => {
  it('оптовая заявка → 201', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ name: 'ТОО Агро', email: 'agro@mail.kz', phone: '+7 701 000 00 00', quantity: '50', date: '2026-12-01' });
    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(50);
  });

  it('объём меньше 10 кг → 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ name: 'Тест', email: 't@t.kz', quantity: 5 });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toMatch(/10 кг/);
  });

  it('заказ из корзины: цена берётся из базы', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ name: 'Покупатель', email: 'b@b.kz', items: [{ productId: 1, quantity: 2 }] });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(res.body.items[0].price * 2);
  });
});

import request from 'supertest';
import app from '../app.js';
import { getAdminToken, getBuyerToken } from './helpers.js';

describe('Аутентификация и роли', () => {
  const email = `Aigerim${Date.now()}@Mail.kz`;

  it('регистрация → 201, email в нижнем регистре, без password_hash', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Айгерим', email, password: 'qwerty123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email.toLowerCase());
    expect(res.body.user.role).toBe('buyer');
    expect(res.body.user).not.toHaveProperty('password_hash');
    expect(res.body.token).toBeTruthy();
  });

  it('повторная регистрация с тем же email → 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Айгерим', email, password: 'qwerty123' });
    expect(res.status).toBe(409);
  });

  it('неверный пароль и несуществующий email — одинаковый ответ 401', async () => {
    const a = await request(app).post('/api/auth/login').send({ email, password: 'wrong-pass' });
    const b = await request(app).post('/api/auth/login').send({ email: 'nobody@test.kz', password: 'wrong-pass' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('GET /api/auth/me без токена → 401, с токеном → 200', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const token = await getBuyerToken();
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('buyer');
  });

  it('подделанный токен → 401', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('товар: без токена 401, покупатель 403, админ 201', async () => {
    const body = { name: 'Сыр домашний, 500 г', price: 2200, category: 'Молочное' };
    expect((await request(app).post('/api/products').send(body)).status).toBe(401);

    const buyer = await getBuyerToken();
    expect((await request(app).post('/api/products').set('Authorization', `Bearer ${buyer}`).send(body)).status).toBe(403);

    const admin = await getAdminToken();
    const res = await request(app).post('/api/products').set('Authorization', `Bearer ${admin}`).send(body);
    expect(res.status).toBe(201);
    expect(res.body.price).toBe(2200);
  });

  it('заявки видит только админ', async () => {
    const buyer = await getBuyerToken();
    expect((await request(app).get('/api/orders').set('Authorization', `Bearer ${buyer}`)).status).toBe(403);
    const admin = await getAdminToken();
    expect((await request(app).get('/api/orders').set('Authorization', `Bearer ${admin}`)).status).toBe(200);
  });
});

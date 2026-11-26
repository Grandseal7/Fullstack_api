import request from 'supertest';
import app from '../app.js';
import { getAdminToken } from './helpers.js';

describe('Каталог: CRUD', () => {
  let token;
  let createdId;

  beforeAll(async () => {
    token = await getAdminToken();
  });

  it('GET /api/products — непустой список', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('?search=мол — только товары со словом «мол»', async () => {
    const res = await request(app).get('/api/products').query({ search: 'мол' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    for (const p of res.body) expect(p.name.toLowerCase()).toContain('мол');
  });

  it('?category=Овощи и ?maxPrice=500', async () => {
    const res = await request(app).get('/api/products').query({ category: 'овощи', maxPrice: 500 });
    for (const p of res.body) {
      expect(p.category).toBe('Овощи');
      expect(p.price).toBeLessThanOrEqual(500);
    }
  });

  it('?sort=-price — по убыванию цены', async () => {
    const res = await request(app).get('/api/products').query({ sort: '-price' });
    const prices = res.body.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => b - a));
  });

  it('GET /api/products/999999 → 404', async () => {
    expect((await request(app).get('/api/products/999999')).status).toBe(404);
  });

  it('POST → PUT → PATCH → DELETE', async () => {
    const auth = { Authorization: `Bearer ${token}` };

    const created = await request(app).post('/api/products').set(auth)
      .send({ name: 'Кумыс, 1 л', price: 1200, category: 'Молочное', unit: 'л' });
    expect(created.status).toBe(201);
    createdId = created.body.id;

    const put = await request(app).put(`/api/products/${createdId}`).set(auth)
      .send({ name: 'Кумыс свежий, 1 л', price: 1300, category: 'Молочное', unit: 'л' });
    expect(put.status).toBe(200);
    expect(put.body.name).toBe('Кумыс свежий, 1 л');

    const patch = await request(app).patch(`/api/products/${createdId}`).set(auth).send({ price: 1400 });
    expect(patch.status).toBe(200);
    expect(patch.body.price).toBe(1400);
    expect(patch.body.name).toBe('Кумыс свежий, 1 л');

    expect((await request(app).delete(`/api/products/${createdId}`).set(auth)).status).toBe(204);
    expect((await request(app).get(`/api/products/${createdId}`)).status).toBe(404);
  });
});

describe('GET /api/categories', () => {
  it('категории с количеством; сумма равна длине каталога', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(typeof res.body[0].count).toBe('number');
    const products = await request(app).get('/api/products');
    const sum = res.body.reduce((s, c) => s + c.count, 0);
    expect(sum).toBe(products.body.length);
  });
});

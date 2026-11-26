import request from 'supertest';
import app from '../app.js';

describe('Health и CORS', () => {
  it('GET /api/health — база доступна, версия local', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(res.body.version).toBe('local');
  });

  it('неизвестный маршрут → 404 в JSON', async () => {
    const res = await request(app).get('/abc');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/не найден/);
  });

  it('helmet убирает X-Powered-By', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('CORS: разрешённый адрес получает заголовок', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('CORS: чужой адрес заголовка не получает', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('битый JSON → 400, а не 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@a.kz",');
    expect(res.status).toBe(400);
  });
});

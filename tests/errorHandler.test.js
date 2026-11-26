import { afterEach } from 'vitest';
import { errorHandler } from '../middleware/errorHandler.js';

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('errorHandler', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('в продакшене скрывает текст ошибки 500', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = mockRes();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(new Error('connect ECONNREFUSED 10.0.0.5:5432'), { method: 'GET', originalUrl: '/x' }, res, vi.fn());
    spy.mockRestore();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error).toBe('Внутренняя ошибка сервера');
  });

  it('ошибка 400 даже в продакшене отдаёт свой текст', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = mockRes();
    const err = Object.assign(new Error('Плохие данные'), { status: 400 });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorHandler(err, { method: 'POST', originalUrl: '/x' }, res, vi.fn());
    spy.mockRestore();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('Плохие данные');
  });

  it('нарушение UNIQUE (23505) → 409', () => {
    const res = mockRes();
    errorHandler({ code: '23505' }, { method: 'POST', originalUrl: '/x' }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// middleware/errorHandler.js — централизованная обработка ошибок
// Express узнаёт обработчик ошибок по ровно четырём параметрам
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Ошибки express.json(): битый JSON и слишком большое тело
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Слишком большой запрос' });
  }

  // Ошибки PostgreSQL
  if (err.code === '23505') {
    // нарушение UNIQUE: такая запись уже есть
    return res.status(409).json({ error: 'Такая запись уже существует' });
  }
  if (err.code === '23503') {
    // нарушение FOREIGN KEY
    return res.status(400).json({ error: 'Ссылка на несуществующую запись' });
  }
  if (err.code === '22P02' || err.code === '23514') {
    // неверный формат значения / нарушение CHECK
    return res.status(400).json({ error: 'Некорректные данные' });
  }

  const status = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV !== 'test' || status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err); // в лог — всё
  }

  // Наружу: для 5xx в продакшене — только общая фраза, без деталей устройства сервера
  const isProd = process.env.NODE_ENV === 'production';
  res.status(status).json({
    error: status >= 500 && isProd ? 'Внутренняя ошибка сервера' : err.message || 'Внутренняя ошибка сервера',
  });
}

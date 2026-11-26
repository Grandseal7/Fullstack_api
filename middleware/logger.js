// middleware/logger.js — логирование каждого запроса
export function logger(req, res, next) {
  const start = Date.now();
  // 'finish' наступает, когда ответ уже отправлен клиенту
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms} мс) ip=${req.ip}`,
    );
  });
  next(); // без next() запрос «зависнет»
}

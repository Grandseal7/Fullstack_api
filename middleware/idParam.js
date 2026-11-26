// middleware/idParam.js
// Параметр :id — только положительное целое. /api/products/abc → 400, а не 500
export const idParam = (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Некорректный id' });
  }
  req.id = id;
  next();
};

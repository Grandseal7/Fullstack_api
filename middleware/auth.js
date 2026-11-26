// middleware/auth.js — аутентификация (кто вы?) и авторизация (что вам можно?)
import jwt from 'jsonwebtoken';

function readToken(req) {
  // Заголовок: Authorization: Bearer eyJhbGciOi...
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  return type === 'Bearer' && token ? token : null;
}

function toUser(payload) {
  return { id: Number(payload.sub), role: payload.role };
}

// Пропускает дальше только запросы с действительным токеном → 401
export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Требуется вход в систему' });
  }
  try {
    // verify проверяет подпись и срок действия; при ошибке — исключение
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = toUser(payload);
    next();
  } catch (err) {
    const error = err.name === 'TokenExpiredError'
      ? 'Срок действия токена истёк, войдите снова'
      : 'Недействительный токен';
    return res.status(401).json({ error });
  }
}

// Пропускает дальше только пользователей с одной из ролей → 403.
// Используется ПОСЛЕ requireAuth: [requireAuth, requireRole('admin')]
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    next();
  };
}

// Токен необязателен: если он есть и валиден — заполняем req.user, иначе просто дальше
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try {
      req.user = toUser(jwt.verify(token, process.env.JWT_SECRET));
    } catch {
      // недействительный токен при необязательной авторизации игнорируем
    }
  }
  next();
}

// middleware/rateLimit.js — защита входа и регистрации от перебора паролей
import { rateLimit } from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,      // окно 15 минут
  limit: 10,                     // не больше 10 неудачных попыток с одного IP
  skipSuccessfulRequests: true,  // успешные входы не считаем
  standardHeaders: 'draft-7',    // заголовки RateLimit-* и Retry-After
  legacyHeaders: false,
  message: { error: 'Слишком много попыток. Попробуйте через 15 минут' },
  skip: () => process.env.NODE_ENV === 'test', // автотесты не должны упираться в лимит
});

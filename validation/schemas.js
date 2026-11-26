// validation/schemas.js — схемы входных данных (zod)
import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Некорректный e-mail').max(200);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Имя — минимум 2 символа').max(100),
  email,
  // bcrypt учитывает только первые 72 байта; без верхней границы огромный пароль «положит» сервер
  password: z.string().min(8, 'Пароль — минимум 8 символов').max(72, 'Пароль — максимум 72 символа'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Введите пароль').max(72),
});

export const passwordChangeSchema = z.object({
  oldPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8, 'Пароль — минимум 8 символов').max(72),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Название — минимум 2 символа').max(200),
  price: z.coerce.number().positive('Цена должна быть больше 0').max(10_000_000),
  category: z.string().trim().min(1).max(50).default('Разное'),
  unit: z.string().trim().min(1).max(20).default('кг'),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
  image: z.string().trim().url('Некорректный адрес картинки').max(500)
    .default('https://placehold.co/300x200'),
  description: z.string().trim().max(2000).optional(),
});

// PATCH: все поля необязательны, но хотя бы одно должно быть.
// Строим из «сырых» полей, чтобы default() не подставлял значения в частичное обновление
export const productUpdateSchema = z.object({
  name: productSchema.shape.name.optional(),
  price: z.coerce.number().positive('Цена должна быть больше 0').max(10_000_000).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
  image: z.string().trim().url().max(500).optional(),
  description: z.string().trim().max(2000).optional(),
}).refine((d) => Object.values(d).some((v) => v !== undefined), 'Нет полей для обновления');

// Пустые поля HTML-формы приходят как '' — считаем их незаполненными
const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);

const orderItem = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().max(10_000),
});

// Заявка: либо оптовая (quantity от 10 кг), либо заказ из корзины (items)
export const orderSchema = z.object({
  name: z.string().trim().min(2, 'Имя — минимум 2 символа').max(100),
  email,
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(30).optional()),
  quantity: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(10, 'Минимальный объём заказа — 10 кг').max(1_000_000).optional(),
  ),
  date: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД').optional(),
  ),
  comment: z.string().trim().max(1000).optional(),
  items: z.array(orderItem).max(50).optional(),
}).refine(
  (d) => d.quantity !== undefined || (d.items && d.items.length > 0),
  { message: 'Укажите объём заказа (от 10 кг) или товары из корзины', path: ['quantity'] },
);

export const orderStatusSchema = z.object({
  status: z.enum(['new', 'processing', 'done', 'cancelled']),
});

-- db/schema.sql — схема базы «АгроМаркет»
-- Все CREATE — с IF NOT EXISTS: файл идемпотентен, его безопасно выполнять повторно
-- (его выполняют npm run db:init и npm run db:migrate через db/bootstrap.js).
-- Порядок важен: таблица со ссылкой REFERENCES идёт после той, на которую ссылается.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                    -- только хэш bcrypt, никогда не пароль
  role          VARCHAR(20) NOT NULL DEFAULT 'buyer'
                CHECK (role IN ('buyer', 'farmer', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  price       NUMERIC(12, 2) NOT NULL CHECK (price > 0),
  unit        VARCHAR(20) NOT NULL DEFAULT 'кг',
  category    VARCHAR(50) NOT NULL DEFAULT 'Разное',
  image       TEXT NOT NULL DEFAULT 'https://placehold.co/300x200',
  stock       INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- если заказ сделал вошедший пользователь
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(200) NOT NULL,
  phone      VARCHAR(30),
  quantity   INTEGER CHECK (quantity IS NULL OR quantity >= 10), -- оптовая заявка, кг
  date       DATE,                                              -- желаемая дата доставки
  comment    TEXT,
  status     VARCHAR(20) NOT NULL DEFAULT 'new'
             CHECK (status IN ('new', 'processing', 'done', 'cancelled')),
  total      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_items (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name       VARCHAR(200) NOT NULL,          -- копия названия на момент заказа
  price      NUMERIC(12, 2) NOT NULL,        -- копия цены на момент заказа
  quantity   INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);

# agromarket-api/Dockerfile
FROM node:20-alpine

WORKDIR /app

# 1. Сначала только манифесты — слой npm ci берётся из кеша, пока не менялись зависимости
COPY package*.json ./
# npm ci — строго по package-lock.json (если lock-файла ещё нет — npm install)
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# 2. Затем исходный код
COPY . .

ENV NODE_ENV=production
EXPOSE 3001

# Непривилегированный пользователь из официального образа Node
USER node

# Миграция идемпотентна: создаёт недостающие таблицы и админа, данные не трогает
CMD ["sh", "-c", "node db/migrate.js && node server.js"]

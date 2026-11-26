// tests/globalSetup.js — один раз перед всеми тестами
import { execSync } from 'node:child_process';

export default function setup() {
  // Защита от катастрофы: db:init удаляет все таблицы!
  // Работаем, только если в настройках подключения есть слово test
  const target = process.env.DATABASE_URL || process.env.PGDATABASE || '';
  if (!target.includes('test')) {
    throw new Error('Тесты должны работать с тестовой базой! Проверьте .env.test');
  }
  execSync('npm run db:init', { stdio: 'inherit' });    // чистая база
  execSync('npm run db:migrate', { stdio: 'inherit' }); // повторная миграция ничего не ломает
}

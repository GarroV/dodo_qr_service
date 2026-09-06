// Настройка drizzle-kit: схема и миграции живут внутри блока data — единственного,
// кто ходит в базу. `npm run db:generate` пишет SQL, `npm run db:migrate` его накатывает.
import { defineConfig } from "drizzle-kit";

try {
  // Node 24 читает .env сам; без файла работают переменные окружения снаружи.
  process.loadEnvFile();
} catch {
  // .env отсутствует — это нормально на площадке с внешними переменными.
}

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined || databaseUrl === "") {
  throw new Error("Нет DATABASE_URL: скопируйте .env.example в .env");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/blocks/data/schema.ts",
  out: "./src/blocks/data/migrations",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});

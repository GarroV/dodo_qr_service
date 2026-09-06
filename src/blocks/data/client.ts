// Единственное подключение продукта к базе. Все блоки ходят в данные через слой data,
// а слой data — через этот пул: одно место, где живут строка подключения и её проверка.
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// Next в режиме разработки перезагружает модули на каждую правку. Без общего хранилища
// каждая перезагрузка открывала бы новый пул, и соединения кончились бы за день работы.
interface PoolHolder {
  dodoQrPool?: Pool;
}
const holder = globalThis as PoolHolder;

let database: Database | undefined;

function connectionString(): string {
  const url = process.env["DATABASE_URL"];
  if (url === undefined || url === "") {
    throw new Error("Нет DATABASE_URL: скопируйте .env.example в .env");
  }
  return url;
}

export function getDb(): Database {
  if (database === undefined) {
    holder.dodoQrPool ??= new Pool({ connectionString: connectionString() });
    database = drizzle(holder.dodoQrPool, { schema });
  }
  return database;
}

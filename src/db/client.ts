import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL ??
  (process.env.NODE_ENV === "production" ? undefined : "postgres://postgres:postgres@localhost:5432/taskflow");

if (!connectionString) {
  throw new Error("DATABASE_URL precisa estar configurada em produção.");
}

export const sql = postgres(connectionString, {
  max: 10,
  prepare: false,
});

export const db = drizzle(sql, { schema });

import { drizzle } from "drizzle-orm/d1";
import { schema } from "./schema";
import * as authSchema from "./auth-schema";

const fullSchema = { ...schema, ...authSchema };

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema: fullSchema });
}

export type Database = ReturnType<typeof createDb>;

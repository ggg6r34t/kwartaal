import { z } from "zod";

/** Money fields validate as integer cents at the API boundary. */
export const centsSchema = z.number().int();

/** Calendar dates (deadline date, invoice date, tax year) as ISO YYYY-MM-DD strings at the boundary. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected ISO date YYYY-MM-DD");

export const roleSchema = z.enum(["owner", "bookkeeper"]);

export const legalFormSchema = z.enum(["eenmanszaak", "vof", "bv", "other"]);

export const vatRateSchema = z.union([
  z.literal(21),
  z.literal(9),
  z.literal(0),
  z.literal("exempt"),
]);

export const quarterStatusSchema = z.enum([
  "open",
  "in_progress",
  "filed",
  "paid",
  "handled_elsewhere",
]);

export const importSourceSchema = z.enum([
  "manual",
  "moneybird",
  "declair",
  "eboekhouden",
  "generic_csv",
]);

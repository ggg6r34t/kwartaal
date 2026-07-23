import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  setAsideCalculatorRequestSchema,
  setAsideCalculatorResponseSchema,
  splitInvoice,
} from "@kwartaal/core";
import type { AppEnv } from "../bindings";

export const calculator = new Hono<AppEnv>();

/**
 * Public, unauthenticated — the marketing site's set-aside teaser and any
 * other caller that wants a server-validated split. No DB access; this is
 * the same pure `splitInvoice` the web app calls directly for instant
 * client-side previews (see apps/web's SetAsideCalculator), with the API's
 * result being the one a persisted computation would treat as authoritative.
 */
calculator.post(
  "/set-aside",
  zValidator("json", setAsideCalculatorRequestSchema),
  (c) => {
    const { totalCents, vatRate, reserveRateBps } = c.req.valid("json");
    const split = splitInvoice(totalCents, vatRate, reserveRateBps);
    return c.json(setAsideCalculatorResponseSchema.parse(split));
  },
);

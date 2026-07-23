import { z } from "zod";

const bracketSchema = z.object({
  uptoCents: z.number().int().nullable(),
  rateBps: z.number().int(),
});

const arbeidskortingBandSchema = z.object({
  fromCents: z.number().int(),
  toCents: z.number().int().nullable(),
  rateBps: z.number().int(),
});

export const taxFiguresSchema = z.object({
  year: z.number().int(),
  brackets: z.array(bracketSchema),
  zelfstandigenaftrekCents: z.number().int(),
  startersaftrekCents: z.number().int(),
  mkbVrijstellingBps: z.number().int(),
  zvwBps: z.number().int(),
  korLimitCents: z.number().int(),
  algemeneHeffingskortingMaxCents: z.number().int(),
  arbeidskortingTable: z.array(arbeidskortingBandSchema),
});
export type TaxFiguresRow = z.infer<typeof taxFiguresSchema>;

export const glossaryTermSchema = z.object({
  slug: z.string().min(1),
  nlTerm: z.string().min(1),
  enGloss: z.string().min(1),
  plainExplanation: z.string().min(1),
  whereYoullSeeIt: z.string().min(1),
  depth: z.enum(["full", "stub"]),
});
export type GlossaryTermRow = z.infer<typeof glossaryTermSchema>;

import { z } from "zod";

/** Days a person waits before answering the satisfaction survey again. */
export const npsIntervalDays = 30;

export const npsInput = z.object({
  score: z.number().int().min(0).max(10),
  comment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((comment) => comment || undefined),
});
export type NpsInput = z.output<typeof npsInput>;

export const npsPeriodInput = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((days) => [30, 90, 365].includes(days))
    .default(90),
});

export type NpsSummary = {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number | null;
};
export type NpsStatus = { due: boolean };
export type NpsResponseRecord = {
  id: string;
  companyName: string;
  role: "ADMIN" | "ATTENDANT";
  score: number;
  comment: string | null;
  createdAt: string;
};
export type NpsReport = NpsSummary & {
  days: number;
  responses: NpsResponseRecord[];
};

export function npsSummary(scores: readonly number[]): NpsSummary {
  const promoters = scores.filter((score) => score >= 9).length;
  const detractors = scores.filter((score) => score <= 6).length;
  const total = scores.length;
  return {
    total,
    promoters,
    passives: total - promoters - detractors,
    detractors,
    score: total ? Math.round(((promoters - detractors) / total) * 100) : null,
  };
}

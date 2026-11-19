import { z } from "zod";
import { idSchema } from "./admin.js";

export const reportInput = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    serviceId: idSchema.optional(),
    userId: idSchema.optional(),
  })
  .refine(
    ({ from, to }) => {
      const difference = new Date(to).getTime() - new Date(from).getTime();
      return difference >= 0 && difference < 93 * 86_400_000;
    },
    { path: ["to"], message: "Selecione até 93 dias." },
  );

export type ReportInput = z.infer<typeof reportInput>;
export type ReportMetrics = {
  completed: number;
  noShows: number;
  waitSeconds: number;
  serviceSeconds: number;
  noShowRate: number;
};
export type ReportRow = ReportMetrics & { service: string; attendant: string };
export type Report = {
  metrics: ReportMetrics;
  rows: ReportRow[];
  hours: number[];
};
export type ReportOptions = {
  services: { id: string; name: string }[];
  attendants: { id: string; name: string }[];
};

export function localDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function nextDay(day: string) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function dayStartUtc(day: string, timeZone: string) {
  const anchor = new Date(day + "T00:00:00Z").getTime();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  let left = anchor - 24 * 3_600_000;
  let right = anchor + 26 * 3_600_000;
  while (left < right) {
    const pivot = Math.floor((left + right) / 2);
    if (formatter.format(new Date(pivot)) < day) left = pivot + 1;
    else right = pivot;
  }
  return new Date(left);
}

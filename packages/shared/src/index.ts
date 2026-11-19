import { z } from "zod";

export const healthSchema = z.object({ status: z.literal("ok") });
export * from "./admin.js";
export * from "./queue.js";
export * from "./attendant.js";
export * from "./devices.js";
export * from "./panel.js";
export * from "./tracking.js";
export * from "./reports.js";
export * from "./theme.js";
export * from "./platform.js";

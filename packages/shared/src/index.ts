import { z } from "zod";

export const healthSchema = z.object({ status: z.literal("ok") });
export * from "./admin.js";
export * from "./queue.js";
export * from "./attendant.js";

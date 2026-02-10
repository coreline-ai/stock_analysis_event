import { z } from "zod";

export const DecisionOutputSchema = z.object({
  verdict: z.enum(["BUY_NOW", "WATCH", "AVOID"]),
  confidence: z.number().min(0).max(1),
  time_horizon: z.enum(["intraday", "swing", "long_term"]),
  thesis_summary: z.string().min(1),
  entry_trigger: z.string().min(1),
  invalidation: z.string().min(1),
  risk_notes: z.array(z.string()),
  bull_case: z.array(z.string()),
  bear_case: z.array(z.string()),
  red_flags: z.array(z.string()),
  catalysts: z.array(z.string())
});

export type DecisionOutput = z.infer<typeof DecisionOutputSchema>;

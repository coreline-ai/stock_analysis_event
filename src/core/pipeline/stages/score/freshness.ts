import { SOURCE_CONFIG } from "@/config/source_config";

export function calculateFreshness(publishedAt?: string | null): number {
  if (!publishedAt) return 0.5;
  const ageMs = Date.now() - new Date(publishedAt).getTime();
  const ageMinutes = ageMs / 60000;
  const halfLife = SOURCE_CONFIG.decayHalfLifeMinutes;
  const decay = 0.5 ** (ageMinutes / halfLife);
  return Math.max(0.2, Math.min(1.0, decay));
}

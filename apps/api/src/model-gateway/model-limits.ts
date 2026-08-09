export const MAX_CONCURRENT_MODEL_GENERATIONS = 2;

export function estimateTokens(text: string): number {
  return Math.ceil(text.trim().length / 2);
}

export function sanitizeTokenCount(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

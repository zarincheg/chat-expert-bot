const DEFAULT_PATTERNS = [
  "\\?$",
  "^how\\s",
  "^what\\s",
  "^where\\s",
  "^when\\s",
  "^why\\s",
  "^can\\s+(i|we|you)\\s",
  "^is\\s+there\\s",
  "^does\\s+",
];

export function looksLikeQuestion(text: string, extraPatterns: string[] = []): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.length < 8) return false;

  const patterns = [...DEFAULT_PATTERNS, ...extraPatterns];
  return patterns.some((p) => {
    try {
      return new RegExp(p, "i").test(normalized);
    } catch {
      return false;
    }
  });
}
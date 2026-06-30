import type { KnowledgeSource } from "../ai-client/types.js";

export function formatSourcesFooter(sources: KnowledgeSource[]): string {
  if (sources.length === 0) return "";

  const labels = sources.map((s) => {
    if (s.sourceType === "community" && s.citedUsername) {
      return `@${s.citedUsername}`;
    }
    return s.title ?? "source";
  });

  return `\n\n—\nSources: ${[...new Set(labels)].join(", ")}`;
}
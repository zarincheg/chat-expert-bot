import type { AiClient, AiResponse, ChatMessageInput, RagContext } from "./types.js";

export class MockAiClient implements AiClient {
  async chat(messages: ChatMessageInput[], context: RagContext): Promise<AiResponse> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const question = lastUserMessage?.content ?? "your question";

    const sourceSummary =
      context.sources.length > 0
        ? context.sources
            .map((s) => s.title ?? s.content.slice(0, 60))
            .join("; ")
        : "general knowledge";

    const styleNote =
      context.responseStyle === "detailed"
        ? "Here is a detailed explanation"
        : "Short answer";

    const persona = context.expertPersona ? `Persona: ${context.expertPersona.slice(0, 80)}` : "";
    const topic = context.topic ? `Topic: ${context.topic}` : "";

    const answer = [
      `[Mock AI] ${styleNote} for: "${question}"`,
      "",
      `Based on ${context.sources.length} knowledge chunk(s): ${sourceSummary}.`,
      `Conversation context: ${context.history.length} message(s) from this chat.`,
      persona,
      topic,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      answer,
      model: "mock-rag-v1",
      tokensUsed: Math.ceil(answer.length / 4),
    };
  }
}

export const mockAiClient = new MockAiClient();
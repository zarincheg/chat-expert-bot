import { env } from "../../config/env.js";

export interface TrustScoreRequest {
  botInstanceId: string;
  chatId: string;
  userId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  joinedAt: string;
}

export interface TrustScoreResponse {
  score: number;
  labels: string[];
  action: "allow" | "restrict" | "ban";
  raw?: unknown;
}

export interface TrustScoreClient {
  check(request: TrustScoreRequest): Promise<TrustScoreResponse>;
}

export class MockTrustScoreClient implements TrustScoreClient {
  async check(request: TrustScoreRequest): Promise<TrustScoreResponse> {
    const seed = `${request.userId}:${request.username ?? ""}:${request.firstName ?? ""}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100;

    const labels: string[] = [];
    if (!request.username) labels.push("no_username");
    if (request.firstName?.toLowerCase().includes("spam")) labels.push("suspicious_name");
    if (hash > 70) labels.push("mock_high_risk");

    const score = request.firstName?.toLowerCase().includes("spam") ? 95 : hash;
    const action = score >= 80 ? "ban" : score >= 50 ? "restrict" : "allow";

    console.info(`[trust:mock] user=${request.userId} score=${score} action=${action}`);

    return { score, labels, action, raw: { mode: "mock" } };
  }
}

export class HttpTrustScoreClient implements TrustScoreClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async check(request: TrustScoreRequest): Promise<TrustScoreResponse> {
    const response = await fetch(`${this.baseUrl}/check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      throw new Error(`Trust score API failed (${response.status})`);
    }
    return (await response.json()) as TrustScoreResponse;
  }
}

export function createTrustScoreClient(): TrustScoreClient {
  const url = env.TRUST_SCORE_URL?.trim();
  if (url) return new HttpTrustScoreClient(url, env.TRUST_SCORE_API_KEY);
  return new MockTrustScoreClient();
}
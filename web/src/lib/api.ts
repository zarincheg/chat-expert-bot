const API_BASE = "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  publicConfig: () => request<{ botUsername: string | null }>("/api/public/config"),
  session: () => request<{ user?: { id: string; name?: string } }>("/auth/session"),
  stats: (days = 7) => request<Record<string, unknown>>(`/api/stats/overview?days=${days}`),
  groups: () => request<Array<{ id: string; chatId: string; title: string | null; isActive: boolean }>>("/api/groups"),
  moderation: (chatId: string) => request<Record<string, unknown>>(`/api/groups/${chatId}/moderation`),
  updateModeration: (chatId: string, body: unknown) =>
    request(`/api/groups/${chatId}/moderation`, { method: "PATCH", body: JSON.stringify(body) }),
  welcome: (chatId: string) => request<Record<string, unknown> | null>(`/api/groups/${chatId}/welcome`),
  updateWelcome: (chatId: string, body: unknown) =>
    request(`/api/groups/${chatId}/welcome`, { method: "PUT", body: JSON.stringify(body) }),
  rules: (chatId?: string) =>
    request<Array<Record<string, unknown>>>(`/api/rules${chatId ? `?chatId=${chatId}` : ""}`),
  createRule: (body: unknown) =>
    request("/api/rules", { method: "POST", body: JSON.stringify(body) }),
  deleteRule: (id: string) => request(`/api/rules/${id}`, { method: "DELETE" }),
  accessLists: (type?: string, chatId?: string) => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (chatId) params.set("chatId", chatId);
    const q = params.toString();
    return request<Array<Record<string, unknown>>>(`/api/access-lists${q ? `?${q}` : ""}`);
  },
  addAccessList: (body: unknown) =>
    request("/api/access-lists", { method: "POST", body: JSON.stringify(body) }),
  deleteAccessList: (id: string) => request(`/api/access-lists/${id}`, { method: "DELETE" }),
  logs: (params?: { chatId?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.chatId) q.set("chatId", params.chatId);
    if (params?.limit) q.set("limit", String(params.limit));
    const s = q.toString();
    return request<Array<Record<string, unknown>>>(`/api/moderation/logs${s ? `?${s}` : ""}`);
  },
  signInTelegram: (user: Record<string, unknown>) => {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(user)) {
      if (v !== undefined) body.set(k, String(v));
    }
    return fetch("/auth/callback/telegram", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  },
};
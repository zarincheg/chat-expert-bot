import type { ExpressAuthConfig } from "@auth/express";
import Credentials from "@auth/core/providers/credentials";
import { env } from "../config/env.js";
import { validateTelegramSession, type TelegramAuthPayload } from "./telegram-auth.js";

export const authConfig: ExpressAuthConfig = {
  providers: [
    Credentials({
      id: "telegram",
      name: "Telegram",
      credentials: {
        id: { label: "ID", type: "text" },
        first_name: { label: "First name", type: "text" },
        last_name: { label: "Last name", type: "text" },
        username: { label: "Username", type: "text" },
        photo_url: { label: "Photo", type: "text" },
        auth_date: { label: "Auth date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const payload: TelegramAuthPayload = {
          id: Number(credentials.id),
          first_name: String(credentials.first_name ?? ""),
          last_name: credentials.last_name ? String(credentials.last_name) : undefined,
          username: credentials.username ? String(credentials.username) : undefined,
          photo_url: credentials.photo_url ? String(credentials.photo_url) : undefined,
          auth_date: Number(credentials.auth_date),
          hash: String(credentials.hash ?? ""),
        };

        return validateTelegramSession(payload);
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: env.AUTH_SECRET,
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.name = token.name;
        session.user.image = token.picture as string | undefined;
      }
      return session;
    },
  },
};
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "pg";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://yardscore:yardscore@localhost:5432/yardscore",
});

export const authConfig: NextAuthConfig = {
  adapter: PostgresAdapter(pool),
  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "YardScore <noreply@drewhenry.com>",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login/error",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;

      try {
        const r = await fetch(
          `${API.startsWith("/") ? "http://localhost:8000" : API}/auth/check-allowlist`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: user.email }),
          }
        );
        if (r.ok) {
          const data = await r.json();
          return data.allowed === true;
        }
      } catch {
        // If API is down, deny
      }
      return false;
    },
    async session({ session }) {
      if (session.user?.email) {
        try {
          const r = await fetch(
            `${API.startsWith("/") ? "http://localhost:8000" : API}/auth/profile?email=${encodeURIComponent(session.user.email)}`
          );
          if (r.ok) {
            const profile = await r.json();
            (session.user as any).id = profile.id;
            (session.user as any).role = profile.role;
            (session.user as any).displayName = profile.display_name;
          }
        } catch {
          // Profile fetch failed
        }
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const authConfig: NextAuthConfig = {
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
      // Check allowlist — only invited users can sign in
      if (!user.email) return false;

      try {
        const r = await fetch(`${API}/auth/check-allowlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: user.email }),
        });
        if (r.ok) {
          const data = await r.json();
          return data.allowed === true;
        }
      } catch {
        // If API is down, deny access
      }
      return false;
    },
    async session({ session, token }) {
      // Add user profile data to session
      if (session.user?.email) {
        try {
          const r = await fetch(`${API}/auth/profile?email=${encodeURIComponent(session.user.email)}`);
          if (r.ok) {
            const profile = await r.json();
            (session.user as any).id = profile.id;
            (session.user as any).role = profile.role;
            (session.user as any).displayName = profile.display_name;
          }
        } catch {
          // Profile fetch failed — session still works with email
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

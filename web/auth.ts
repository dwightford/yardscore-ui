import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Server-side API URL: inside Docker use service name, outside use localhost
const API_INTERNAL = process.env.API_INTERNAL_URL ?? "http://api:8000";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      id: "magic-link",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const token = credentials?.token as string;
        if (!email || !token) return null;

        // Verify the magic link token via API
        try {
          const r = await fetch(`${API_INTERNAL}/auth/verify-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, token }),
          });
          if (r.ok) {
            const data = await r.json();
            if (data.valid) {
              return { id: data.user_id, email, name: data.display_name };
            }
          }
        } catch {}
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.email) {
        (session.user as any).id = token.id;
        (session.user as any).email = token.email;
        (session.user as any).name = token.name;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = ["/dashboard", "/scan", "/capture", "/map", "/identify", "/debug"].some(
        (r) => nextUrl.pathname === r || nextUrl.pathname.startsWith(r + "/")
      );

      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies: false,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

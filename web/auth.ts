import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";

// Server-side API URL: inside Docker use service name, outside use localhost
const API_INTERNAL = process.env.API_INTERNAL_URL ?? "http://api:8000";

async function createApiToken(userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

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
        // Create a plain HS256 JWT for API calls
        token.apiToken = await createApiToken(user.id as string, user.email as string);
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.email) {
        (session.user as any).id = token.id;
        (session.user as any).email = token.email;
        (session.user as any).name = token.name;
        (session as any).apiToken = token.apiToken;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isProtected = ["/dashboard", "/scan", "/capture", "/map", "/identify", "/debug", "/plant", "/admin", "/report", "/upgrade"].some(
        (r) => nextUrl.pathname === r || nextUrl.pathname.startsWith(r + "/")
      );

      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
  basePath: "/auth",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },  // 30 days
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies: false,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

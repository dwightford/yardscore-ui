import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
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

/** Ensure the user exists in the API backend (auto-creates if needed). */
async function ensureApiUser(email: string, name?: string | null): Promise<{ id: string; email: string; display_name: string }> {
  const r = await fetch(`${API_INTERNAL}/auth/profile?email=${encodeURIComponent(email)}`);
  if (r.ok) return r.json();
  throw new Error("Could not resolve API user");
}

export const authConfig: NextAuthConfig = {
  providers: [
    // Google OAuth — persistent sessions, no email codes
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    // Magic-link email fallback
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
    async jwt({ token, user, account }) {
      if (user) {
        if (account?.provider === "google") {
          // Google OAuth: resolve the API user (auto-creates if needed)
          try {
            const apiUser = await ensureApiUser(user.email!, user.name);
            token.id = apiUser.id;
            token.email = apiUser.email;
            token.name = apiUser.display_name;
            token.apiToken = await createApiToken(apiUser.id, apiUser.email);
          } catch {
            // Fallback: use Google profile directly (API calls will fail gracefully)
            token.id = user.id;
            token.email = user.email;
            token.name = user.name;
          }
        } else {
          // Magic-link: user already resolved from API in authorize()
          token.id = user.id;
          token.email = user.email;
          token.name = user.name;
          token.apiToken = await createApiToken(user.id as string, user.email as string);
        }
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
      const isProtected = ["/dashboard", "/scan", "/capture", "/map", "/identify", "/debug", "/plant", "/admin", "/report", "/upgrade", "/property", "/observe", "/profile", "/field", "/walk"].some(
        (r) => nextUrl.pathname === r || nextUrl.pathname.startsWith(r + "/")
      );

      if (isProtected && !isLoggedIn) return false;
      return true;
    },
  },
  basePath: "/auth",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },  // 30 days JWT expiry
  // Explicit cookie config — ensures the browser cookie itself has a max-age so it
  // survives iOS Safari backgrounding / session end (not just a session cookie).
  cookies: {
    sessionToken: {
      name: "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: false,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  useSecureCookies: false,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

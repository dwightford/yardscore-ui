/**
 * Authenticated fetch wrapper for API calls.
 *
 * Usage in components:
 *   import { useSession } from "next-auth/react";
 *   import { apiFetch } from "@/lib/api";
 *
 *   const { data: session } = useSession();
 *   const token = (session as any)?.apiToken;
 *   const res = await apiFetch(token, `${API}/land_units`);
 */

export function apiFetch(
  token: string | undefined,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export function apiHeaders(token: string | undefined): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

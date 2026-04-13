"use client";

/**
 * /dashboard — legacy route. Redirects only. Not a destination.
 *
 * Canon: `/property/[id]` is the real property home. Dashboard existed as
 * a router waypoint and a picker; both are dead wood per the auth-first
 * entry & dead-flow pruning sprint.
 *
 * Behavior:
 *   - Not authed → /
 *   - Authed, has properties → /property/<first>
 *   - Authed, no properties → /onboard
 */

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DashboardRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as any)?.apiToken as string | undefined;

  useEffect(() => {
    if (status === "loading") return;
    if (!token) {
      router.replace("/");
      return;
    }
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        const units = Array.isArray(data) ? data : data.land_units ?? [];
        if (units.length === 0) {
          router.replace("/onboard");
        } else {
          router.replace(`/property/${units[0].id}`);
        }
      })
      .catch(() => router.replace("/"));
  }, [status, token, router]);

  return (
    <div className="min-h-screen bg-forest-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest-300/30 border-t-forest-300 rounded-full animate-spin" />
    </div>
  );
}

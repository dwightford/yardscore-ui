"use client";

/**
 * /walk — guided walk flow (Observe).
 *
 * Hard-gated: requires auth + a resolved property the user has access to.
 * No anonymous demo mode — anonymous users never reach real-yard actions.
 *
 * Property selection:
 *   1. `?property=<id>` query param (from /property/[id] observe CTA)
 *   2. Single property on the account → auto-select
 *   3. Multiple properties → show picker
 *   4. No properties → bounce to /onboard
 *
 * Desktop visitors redirect to /property/[id] (mobile observes, web interprets).
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Sprout } from "lucide-react";
import GuidedWalkFlow from "../components/field/GuidedWalkFlow";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LandUnit {
  id: string;
  name: string;
  address?: string | null;
}

export default function WalkPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token: string | undefined = (session as any)?.apiToken;
  const propertyQuery = searchParams.get("property");

  // Hard auth gate (middleware also protects this, but redirect explicitly
  // so anonymous users get a clear next step).
  useEffect(() => {
    if (status === "loading") return;
    if (!token) {
      const next = `/walk${propertyQuery ? `?property=${propertyQuery}` : ""}`;
      router.replace(`/login?mode=signin&next=${encodeURIComponent(next)}`);
    }
  }, [status, token, propertyQuery, router]);

  // Desktop redirect.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (!mobile && propertyQuery) {
      router.replace(`/property/${propertyQuery}`);
    } else if (!mobile) {
      router.replace("/dashboard");
    }
  }, [propertyQuery, router]);

  const [landUnits, setLandUnits] = useState<LandUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(propertyQuery);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        const units: LandUnit[] = Array.isArray(data) ? data : data.land_units ?? [];
        setLandUnits(units);
        if (propertyQuery && units.some((u) => u.id === propertyQuery)) {
          setSelectedId(propertyQuery);
        } else if (units.length === 1) {
          setSelectedId(units[0].id);
        } else if (units.length === 0) {
          router.replace("/onboard");
          return;
        }
      })
      .catch(() => {})
      .finally(() => setResolved(true));
  }, [token, propertyQuery, router]);

  const selectedUnit = landUnits.find((u) => u.id === selectedId) ?? null;
  const propertyLabel = selectedUnit?.name || selectedUnit?.address || "Your Property";

  const handleViewProperty = useCallback(() => {
    if (selectedId) router.push(`/property/${selectedId}`);
  }, [selectedId, router]);

  if (status === "loading" || !token || !resolved) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-300/30 border-t-forest-300" />
      </div>
    );
  }

  if (landUnits.length > 1 && !selectedId) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-forest-950 px-6">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-forest-300/20 bg-forest-300/10">
          <Sprout className="h-6 w-6 text-forest-300" />
        </div>
        <h1 className="mb-6 font-display text-xl font-bold text-white">Which yard?</h1>
        <div className="flex w-full max-w-xs flex-col gap-2">
          {landUnits.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedId(u.id)}
              className="card text-left transition-all hover:!border-forest-600/30"
            >
              <p className="text-sm font-medium text-white">
                {u.name || u.address || u.id}
              </p>
              {u.address && u.name && (
                <p className="mt-0.5 text-xs text-zinc-500">{u.address}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selectedId) {
    return (
      <GuidedWalkFlow
        token={token}
        landUnitId={selectedId}
        propertyLabel={propertyLabel}
        onViewProperty={handleViewProperty}
      />
    );
  }

  // Fallback: no selection resolved (shouldn't happen with the redirects above).
  return (
    <div className="flex h-[100dvh] items-center justify-center bg-black">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-300/30 border-t-forest-300" />
    </div>
  );
}

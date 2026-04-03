"use client";

/**
 * /walk — Field Mapper entry point
 *
 * Authenticated users: resolves land units and renders FieldMapperShell
 * in live API mode (real walk sessions, GPS, persistence, PlantNet ID).
 * Multi-property: shows a selector when the user has more than one property.
 *
 * Unauthenticated / no land units: renders FieldMapperShell with a
 * mock seed for demo purposes.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import FieldMapperShell from "../components/field/FieldMapperShell";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LandUnit {
  id: string;
  name: string;
  address?: string | null;
}

const DEMO_SEED = {
  walkActive: true,
  walkStartedAt: new Date(Date.now() - 7 * 60 * 1000).toISOString(),
  hasOriginAnchor: true,
  anchorCount: 2,
  areaCount: 1,
  subjectCount: 1,
  initialStripState: "light_suggested" as const,
};

export default function WalkPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token: string | undefined = (session as any)?.apiToken;

  const [landUnits, setLandUnits] = useState<LandUnit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!token) {
      setResolved(true);
      return;
    }
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        const units: LandUnit[] = Array.isArray(data) ? data : data.land_units ?? [];
        setLandUnits(units);
        if (units.length > 0) setSelectedId(units[0].id);
      })
      .catch(() => {})
      .finally(() => setResolved(true));
  }, [token]);

  const selectedUnit = landUnits.find((u) => u.id === selectedId) ?? null;
  const propertyLabel = selectedUnit?.name || selectedUnit?.address || "Your Property";

  const handleViewProperty = useCallback(() => {
    if (selectedId) router.push(`/property/${selectedId}`);
  }, [selectedId, router]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === "loading" || !resolved) {
    return (
      <div className="h-[100dvh] bg-black flex items-center justify-center">
        <p className="text-stone-600 text-sm tracking-wide">Loading...</p>
      </div>
    );
  }

  // ── Multi-property selector (shown when > 1 property, before entering shell)
  if (token && landUnits.length > 1 && !selectedId) {
    return (
      <div className="h-[100dvh] bg-stone-950 flex flex-col items-center justify-center px-6 gap-4">
        <h1 className="text-white text-lg font-semibold">Which property?</h1>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {landUnits.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelectedId(u.id)}
              className="bg-stone-900 border border-stone-700 hover:border-green-600 rounded-xl px-4 py-3 text-left transition"
            >
              <p className="text-white text-sm font-medium">{u.name || u.address || u.id}</p>
              {u.address && u.name && (
                <p className="text-stone-500 text-xs mt-0.5">{u.address}</p>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Authenticated with a resolved land unit → live mode ───────────────────
  if (token && selectedId) {
    return (
      <div className="relative h-[100dvh]">
        {/* Property switcher (compact, only if multiple) */}
        {landUnits.length > 1 && (
          <div className="absolute top-0 right-0 z-30 p-2">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 focus:outline-none"
            >
              {landUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.address || u.id}
                </option>
              ))}
            </select>
          </div>
        )}
        <FieldMapperShell
          token={token}
          landUnitId={selectedId}
          propertyLabel={propertyLabel}
          onViewProperty={handleViewProperty}
        />
      </div>
    );
  }

  // ── Demo fallback ─────────────────────────────────────────────────────────
  return (
    <FieldMapperShell
      seed={DEMO_SEED}
      propertyLabel="108 Buena Vista Way"
    />
  );
}

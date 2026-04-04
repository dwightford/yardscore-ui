"use client";

/**
 * /walk — Field Mapper entry point
 *
 * Authenticated users: resolves land units, then renders the guided
 * walk flow (origin anchor → begin walk → shell with prompts → review).
 * Multi-property: shows a selector when the user has more than one property.
 *
 * Unauthenticated / no land units: renders the guided walk flow in
 * demo mode with local state only.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
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

  // Desktop: redirect to dashboard — mobile observes, web interprets
  const [deviceChecked, setDeviceChecked] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  useEffect(() => {
    const mobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    setIsMobile(mobile);
    setDeviceChecked(true);
    if (!mobile) router.replace("/dashboard");
  }, [router]);
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
        if (units.length === 1) setSelectedId(units[0].id);
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

  // ── Multi-property selector (shown when > 1 property, before entering flow)
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

  // ── Authenticated with a resolved land unit → guided walk flow ────────────
  if (token && selectedId) {
    return (
      <GuidedWalkFlow
        token={token}
        landUnitId={selectedId}
        propertyLabel={propertyLabel}
        onViewProperty={handleViewProperty}
      />
    );
  }

  // ── Demo fallback → guided walk flow without credentials ──────────────────
  return (
    <GuidedWalkFlow propertyLabel="108 Buena Vista Way" />
  );
}

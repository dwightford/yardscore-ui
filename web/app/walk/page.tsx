"use client";

/**
 * /walk — Field Mapper entry point (Garden Voice edition)
 *
 * Authenticated users: resolves land units, then renders the guided
 * walk flow (origin anchor → begin walk → shell with prompts → review).
 * Multi-property: shows a selector when the user has more than one property.
 *
 * Unauthenticated / no land units: renders the guided walk flow in
 * demo mode with local state only.
 *
 * Canon: Mobile observes, web interprets.
 * Desktop visitors redirect to /dashboard.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
        const units: LandUnit[] = Array.isArray(data)
          ? data
          : (data.land_units ?? []);
        setLandUnits(units);
        if (units.length === 1) setSelectedId(units[0].id);
      })
      .catch(() => {})
      .finally(() => setResolved(true));
  }, [token]);

  const selectedUnit = landUnits.find((u) => u.id === selectedId) ?? null;
  const propertyLabel =
    selectedUnit?.name || selectedUnit?.address || "Your Property";

  const handleViewProperty = useCallback(() => {
    if (selectedId) router.push(`/property/${selectedId}`);
  }, [selectedId, router]);

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (status === "loading" || !resolved) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest-300/30 border-t-forest-300" />
      </div>
    );
  }

  // ── Multi-property selector (Garden Voice styled) ─────────────────────────
  if (token && landUnits.length > 1 && !selectedId) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-forest-950 px-6">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-forest-300/20 bg-forest-300/10">
          <Sprout className="h-6 w-6 text-forest-300" />
        </div>
        <h1 className="mb-6 font-display text-xl font-bold text-white">
          Which yard?
        </h1>
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
  return <GuidedWalkFlow propertyLabel="108 Buena Vista Way" />;
}

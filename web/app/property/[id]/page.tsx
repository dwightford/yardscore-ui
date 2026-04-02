"use client";

/**
 * /property/[id] — v2 Structure Browser
 *
 * The primary product surface. Shows a property's ecosystem structure,
 * signals, readiness, and outcome profiles.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  land_unit_type: string;
  address: string | null;
}

interface LatestScore {
  score_value: number;
  confidence: number;
  coverage: number;
  computed_at: string;
}

interface LayerSummary {
  layer: string;
  entity_count: number;
  species_count: number;
  native_count: number;
  invasive_count: number;
  unresolved_count: number;
  average_confidence: number;
  keystone_count: number;
}

interface LayerEntity {
  id: string;
  label: string;
  species: string | null;
  ecological_layer: string;
  native_status: string | null;
  confidence: number;
  is_keystone: boolean;
  observation_count: number;
}

interface Signal {
  id: string;
  name: string;
  value: number;
  confidence: number;
  tier: number;
  evidence_summary: string | null;
}

interface ReadinessInsight {
  id: string;
  name: string;
  state: "ready" | "close" | "locked" | "stale";
  missing_evidence: string | null;
  recommended_action: string | null;
  unlock_value: number | null;
}

interface NextObservation {
  observation_type: string;
  description: string;
  impact: string;
}

interface OutcomeProfile {
  id: string;
  profile_type: string;
  active: boolean;
}

// ── Layer config ─────────────────────────────────────────────────────────────

const LAYER_ORDER = [
  "canopy",
  "understory",
  "shrub",
  "flowering",
  "ground",
  "root_fungal",
  "unclassified",
] as const;

const LAYER_META: Record<string, { label: string; color: string }> = {
  canopy:        { label: "Canopy",        color: "bg-emerald-500" },
  understory:    { label: "Understory",    color: "bg-green-500" },
  shrub:         { label: "Shrub",         color: "bg-lime-500" },
  flowering:     { label: "Flowering",     color: "bg-amber-400" },
  ground:        { label: "Ground",        color: "bg-teal-500" },
  root_fungal:   { label: "Root / Fungal", color: "bg-orange-500" },
  unclassified:  { label: "Unclassified",  color: "bg-zinc-500" },
};

const TIER_LABELS: Record<number, string> = {
  1: "Ecological Truth",
  2: "Tier 2",
  3: "Tier 3",
  4: "Tier 4",
  5: "Tier 5",
  6: "Observation Readiness",
};

const OUTCOME_PROFILES = [
  { type: "ecological_recovery", label: "Ecological Recovery", icon: "🌿" },
  { type: "visual_design",       label: "Visual Design",       icon: "🎨" },
  { type: "four_season_interest", label: "Four-Season Interest", icon: "🍂" },
  { type: "pollinator_support",  label: "Pollinator Support",  icon: "🐝" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(v: number): string {
  if (v >= 70) return "text-lime-300";
  if (v >= 45) return "text-yellow-400";
  return "text-red-400";
}

function scoreBgRing(v: number): string {
  if (v >= 70) return "border-lime-400/50 bg-lime-400/10";
  if (v >= 45) return "border-yellow-400/50 bg-yellow-400/10";
  return "border-red-400/50 bg-red-400/10";
}

function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stateBadge(state: string) {
  const map: Record<string, { bg: string; text: string }> = {
    ready:  { bg: "bg-lime-400/15 border-lime-400/30",   text: "text-lime-300" },
    close:  { bg: "bg-yellow-400/15 border-yellow-400/30", text: "text-yellow-300" },
    locked: { bg: "bg-zinc-400/15 border-zinc-400/30",   text: "text-zinc-400" },
    stale:  { bg: "bg-red-400/15 border-red-400/30",     text: "text-red-400" },
  };
  const s = map[state] ?? map.locked;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${s.bg} ${s.text}`}>
      {humanize(state)}
    </span>
  );
}

function confidenceDot(c: number) {
  const color = c > 0.7 ? "bg-lime-400" : c > 0.4 ? "bg-yellow-400" : "bg-red-400";
  return <span className={`inline-block w-2 h-2 rounded-full ${color}`} title={`Confidence: ${Math.round(c * 100)}%`} />;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

// ── Layer Card (expandable) ──────────────────────────────────────────────────

function LayerCard({
  layer,
  token,
  landUnitId,
}: {
  layer: LayerSummary;
  token: string | undefined;
  landUnitId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [entities, setEntities] = useState<LayerEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);

  const meta = LAYER_META[layer.layer] ?? { label: humanize(layer.layer), color: "bg-zinc-500" };

  async function loadEntities() {
    if (entities.length > 0) return;
    setEntitiesLoading(true);
    try {
      const res = await apiFetch(token, `${API}/land_units/${landUnitId}/structure/${layer.layer}`);
      if (res.ok) setEntities(await res.json());
    } catch {}
    setEntitiesLoading(false);
  }

  function toggle() {
    if (!expanded) loadEntities();
    setExpanded(!expanded);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.02] transition-colors">
        {/* Color dot */}
        <span className={`w-3 h-3 rounded-full flex-none ${meta.color}`} />

        {/* Layer info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{meta.label}</span>
            {layer.keystone_count > 0 && (
              <span className="text-[10px] text-lime-400 font-medium">
                {layer.keystone_count} keystone{layer.keystone_count > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-zinc-500">{layer.entity_count} plants</span>
            <span className="text-xs text-zinc-500">{layer.species_count} species</span>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-1.5 flex-none">
          {layer.native_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime-400/15 text-lime-300 font-medium">
              {layer.native_count} native
            </span>
          )}
          {layer.invasive_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400 font-medium">
              {layer.invasive_count} invasive
            </span>
          )}
          {layer.unresolved_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-400/15 text-zinc-400 font-medium">
              {layer.unresolved_count} unresolved
            </span>
          )}
        </div>

        {/* Confidence bar */}
        <div className="w-12 flex-none">
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-lime-300/60"
              style={{ width: `${Math.round(layer.average_confidence * 100)}%` }}
            />
          </div>
          <p className="text-[9px] text-zinc-600 text-center mt-0.5">{Math.round(layer.average_confidence * 100)}%</p>
        </div>

        {/* Chevron */}
        <svg
          className={`w-4 h-4 text-zinc-500 flex-none transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3">
          {entitiesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : entities.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-2">No entities in this layer.</p>
          ) : (
            <div className="space-y-1">
              {entities.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                  <div className="flex items-center gap-2 min-w-0">
                    {e.native_status === "native" && <span className="text-lime-400 text-[10px]">●</span>}
                    {e.native_status === "invasive" && <span className="text-red-400 text-[10px]">●</span>}
                    {(!e.native_status || (e.native_status !== "native" && e.native_status !== "invasive")) && (
                      <span className="text-zinc-600 text-[10px]">●</span>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs text-zinc-200 truncate block">{e.label}</span>
                      {e.species && (
                        <span className="text-[10px] text-zinc-500 italic truncate block">{e.species}</span>
                      )}
                    </div>
                    {e.is_keystone && <span className="text-[9px] text-lime-400 ml-1">keystone</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-none">
                    <span className="text-[10px] text-zinc-500">x{e.observation_count}</span>
                    {confidenceDot(e.confidence)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function PropertyPage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const params = useParams();
  const id = params.id as string;

  // ── State ──────────────────────────────────────────────────────────────────

  const [landUnit, setLandUnit] = useState<LandUnit | null>(null);
  const [score, setScore] = useState<LatestScore | null>(null);
  const [luLoading, setLuLoading] = useState(true);

  const [layers, setLayers] = useState<LayerSummary[]>([]);
  const [layersLoading, setLayersLoading] = useState(true);
  const [noLayers, setNoLayers] = useState(false);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);
  const [computingSignals, setComputingSignals] = useState(false);

  const [readiness, setReadiness] = useState<ReadinessInsight[]>([]);
  const [readinessLoading, setReadinessLoading] = useState(true);
  const [computingReadiness, setComputingReadiness] = useState(false);
  const [nextObs, setNextObs] = useState<NextObservation | null>(null);

  const [profiles, setProfiles] = useState<OutcomeProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [togglingProfile, setTogglingProfile] = useState<string | null>(null);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchLandUnit = useCallback(async () => {
    if (!token) return;
    setLuLoading(true);
    try {
      const [luRes, scoreRes] = await Promise.all([
        apiFetch(token, `${API}/land_units/${id}`),
        apiFetch(token, `${API}/yardscore/${id}/latest`),
      ]);
      if (luRes.ok) setLandUnit(await luRes.json());
      if (scoreRes.ok) setScore(await scoreRes.json());
    } catch {}
    setLuLoading(false);
  }, [token, id]);

  const fetchStructure = useCallback(async () => {
    if (!token) return;
    setLayersLoading(true);
    try {
      const res = await apiFetch(token, `${API}/land_units/${id}/structure`);
      if (res.ok) {
        const data: LayerSummary[] = await res.json();
        // Sort by canonical layer order
        const ordered = LAYER_ORDER
          .map((l) => data.find((d) => d.layer === l))
          .filter(Boolean) as LayerSummary[];
        // Add any layers not in our canonical list
        const extra = data.filter((d) => !LAYER_ORDER.includes(d.layer as any));
        const all = [...ordered, ...extra];
        setLayers(all);
        setNoLayers(all.length === 0 || all.every((l) => l.entity_count === 0));
      } else {
        setNoLayers(true);
      }
    } catch {
      setNoLayers(true);
    }
    setLayersLoading(false);
  }, [token, id]);

  const fetchSignals = useCallback(async () => {
    if (!token) return;
    setSignalsLoading(true);
    try {
      const res = await apiFetch(token, `${API}/land_units/${id}/signals`);
      if (res.ok) setSignals(await res.json());
    } catch {}
    setSignalsLoading(false);
  }, [token, id]);

  const fetchReadiness = useCallback(async () => {
    if (!token) return;
    setReadinessLoading(true);
    try {
      const [rRes, nRes] = await Promise.all([
        apiFetch(token, `${API}/land_units/${id}/readiness`),
        apiFetch(token, `${API}/land_units/${id}/readiness/next`),
      ]);
      if (rRes.ok) setReadiness(await rRes.json());
      if (nRes.ok) setNextObs(await nRes.json());
    } catch {}
    setReadinessLoading(false);
  }, [token, id]);

  const fetchProfiles = useCallback(async () => {
    if (!token) return;
    setProfilesLoading(true);
    try {
      const res = await apiFetch(token, `${API}/land_units/${id}/outcome-profiles`);
      if (res.ok) setProfiles(await res.json());
    } catch {}
    setProfilesLoading(false);
  }, [token, id]);

  useEffect(() => {
    fetchLandUnit();
    fetchStructure();
    fetchSignals();
    fetchReadiness();
    fetchProfiles();
  }, [fetchLandUnit, fetchStructure, fetchSignals, fetchReadiness, fetchProfiles]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function computeSignals() {
    if (!token) return;
    setComputingSignals(true);
    try {
      const res = await apiFetch(token, `${API}/land_units/${id}/signals/compute`, { method: "POST" });
      if (res.ok) await fetchSignals();
    } catch {}
    setComputingSignals(false);
  }

  async function computeReadiness() {
    if (!token) return;
    setComputingReadiness(true);
    try {
      const res = await apiFetch(token, `${API}/land_units/${id}/readiness/compute`, { method: "POST" });
      if (res.ok) await fetchReadiness();
    } catch {}
    setComputingReadiness(false);
  }

  async function toggleProfile(profileType: string) {
    if (!token) return;
    setTogglingProfile(profileType);
    const existing = profiles.find((p) => p.profile_type === profileType);
    try {
      if (existing?.active) {
        await apiFetch(token, `${API}/land_units/${id}/outcome-profiles/${existing.id}`, { method: "DELETE" });
      } else {
        await apiFetch(token, `${API}/land_units/${id}/outcome-profiles`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile_type: profileType }),
        });
      }
      await fetchProfiles();
    } catch {}
    setTogglingProfile(null);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const signalsByTier = signals.reduce<Record<number, Signal[]>>((acc, s) => {
    (acc[s.tier] ??= []).push(s);
    return acc;
  }, {});

  const tierOrder = Object.keys(signalsByTier).map(Number).sort((a, b) => a - b);

  const v = score ? Math.round(score.score_value) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#07110c]">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-[#07110c] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <a href="/dashboard" className="text-zinc-500 text-sm hover:text-white transition-colors">
            &larr; Dashboard
          </a>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white">YardScore</span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-8">
        {/* ── 1. Header ───────────────────────────────────────────────────── */}
        {luLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : landUnit ? (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{landUnit.name}</h1>
              {landUnit.address && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {landUnit.address.split(",").slice(0, 2).join(",")}
                </p>
              )}
            </div>
            {v !== null && (
              <div className={`w-14 h-14 rounded-full border-2 ${scoreBgRing(v)} flex items-center justify-center`}>
                <span className={`text-lg font-bold tabular-nums ${scoreColor(v)}`}>{v}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-zinc-400">Property not found.</p>
        )}

        {/* ── 2. Structure Browser ────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Ecosystem Structure
          </h2>

          {layersLoading ? (
            <SectionSkeleton />
          ) : noLayers ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-sm text-zinc-400">
                Plants haven&apos;t been classified by layer yet. They&apos;ll appear here as the system learns more about your yard.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {layers.filter((l) => l.entity_count > 0).map((layer) => (
                <LayerCard key={layer.layer} layer={layer} token={token} landUnitId={id} />
              ))}
            </div>
          )}
        </section>

        {/* ── 3. Signals ──────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Signals
          </h2>

          {signalsLoading ? (
            <SectionSkeleton />
          ) : signals.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-sm text-zinc-400 mb-4">No signals computed yet.</p>
              <button
                onClick={computeSignals}
                disabled={computingSignals}
                className="px-5 py-2.5 bg-lime-300 text-zinc-950 font-semibold rounded-lg text-sm hover:bg-lime-200 transition-colors disabled:opacity-50"
              >
                {computingSignals ? "Computing..." : "Compute Signals"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {tierOrder.map((tier) => (
                <div key={tier}>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">
                    Tier {tier} — {TIER_LABELS[tier] ?? `Tier ${tier}`}
                  </p>
                  <div className="space-y-1.5">
                    {signalsByTier[tier].map((sig) => (
                      <div key={sig.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-200">{humanize(sig.name)}</span>
                            {confidenceDot(sig.confidence)}
                          </div>
                          <span className="text-xs text-zinc-500 tabular-nums">
                            {Math.round(sig.value * 100)}%
                          </span>
                        </div>
                        {/* Value bar */}
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-lime-300 transition-all"
                            style={{ width: `${Math.round(sig.value * 100)}%` }}
                          />
                        </div>
                        {sig.evidence_summary && (
                          <p className="text-[10px] text-zinc-500 mt-1.5">{sig.evidence_summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 4. Readiness ────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Readiness
          </h2>

          {readinessLoading ? (
            <SectionSkeleton />
          ) : readiness.length === 0 && !nextObs ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-sm text-zinc-400 mb-4">No readiness data yet.</p>
              <button
                onClick={computeReadiness}
                disabled={computingReadiness}
                className="px-5 py-2.5 bg-lime-300 text-zinc-950 font-semibold rounded-lg text-sm hover:bg-lime-200 transition-colors disabled:opacity-50"
              >
                {computingReadiness ? "Computing..." : "Compute Readiness"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Next best observation — prominent card */}
              {nextObs && (
                <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-4">
                  <p className="text-[10px] text-lime-400 uppercase tracking-widest mb-1">Next Best Observation</p>
                  <p className="text-sm font-medium text-white">{humanize(nextObs.observation_type)}</p>
                  <p className="text-xs text-zinc-400 mt-1">{nextObs.description}</p>
                  {nextObs.impact && (
                    <p className="text-[10px] text-lime-300/70 mt-1.5">Impact: {nextObs.impact}</p>
                  )}
                </div>
              )}

              {/* Readiness insights */}
              {readiness.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-200">{humanize(r.name)}</span>
                    {stateBadge(r.state)}
                  </div>
                  {r.missing_evidence && (
                    <p className="text-[10px] text-zinc-500 mt-1">Missing: {r.missing_evidence}</p>
                  )}
                  {r.recommended_action && (
                    <p className="text-xs text-zinc-400 mt-1">{r.recommended_action}</p>
                  )}
                  {r.unlock_value != null && r.unlock_value > 0 && (
                    <p className="text-[10px] text-lime-300/60 mt-1">
                      Unlock value: +{Math.round(r.unlock_value * 100)}%
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 5. Outcome Profiles ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            Outcome Profiles
          </h2>

          {profilesLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {OUTCOME_PROFILES.map((op) => {
                const active = profiles.some(
                  (p) => p.profile_type === op.type && p.active,
                );
                const toggling = togglingProfile === op.type;

                return (
                  <button
                    key={op.type}
                    onClick={() => toggleProfile(op.type)}
                    disabled={toggling}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? "border-lime-300/50 bg-lime-300/5 hover:bg-lime-300/10"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
                    } ${toggling ? "opacity-50" : ""}`}
                  >
                    <span className="text-2xl">{op.icon}</span>
                    <p className={`text-sm font-medium mt-2 ${active ? "text-lime-300" : "text-zinc-200"}`}>
                      {op.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {active ? "Active" : "Tap to enable"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 6. Quick Actions ────────────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-4 gap-2">
            <a
              href="/scan"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-lime-300 text-zinc-950 hover:bg-lime-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              <span className="text-[10px] font-semibold">Scan</span>
            </a>
            <a
              href={`/property/${id}/light`}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
              </svg>
              <span className="text-[10px] font-medium">Light</span>
            </a>
            <a
              href="/map"
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
              <span className="text-[10px] font-medium">Map</span>
            </a>
            <a
              href={`/report?id=${id}`}
              className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="text-[10px] font-medium">Report</span>
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="text-center text-[10px] text-zinc-600 py-8">
        YardScore by DrewHenry · Structure → Intelligence
      </footer>
    </div>
  );
}

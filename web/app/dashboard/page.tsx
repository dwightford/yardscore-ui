"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  land_unit_type: string;
  address: string | null;
  created_at: string;
  observation_count?: number;
}

interface LatestScore {
  score_value: number;
  confidence: number;
  coverage: number;
  computed_at: string;
}

interface SessionSummary {
  id: string;
  status: string;
  capture_mode: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface EntitySummary {
  id: string;
  entity_type: string;
  label: string;
  species: string | null;
  observation_count: number;
}

interface PlaceWithData {
  place: LandUnit;
  score: LatestScore | null;
  entityCount: number;
  entities: EntitySummary[];
  hasParcel: boolean;
  sessions: SessionSummary[];
  loading: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function scoreLabel(v: number): string {
  if (v >= 80) return "Excellent";
  if (v >= 60) return "Good";
  if (v >= 40) return "Fair";
  return "Needs Work";
}

function typeLabel(t: string): string {
  return { yard: "Yard", parcel: "Parcel", property: "Property", cluster: "Community" }[t] ?? t;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score, size = "md" }: { score: LatestScore | null | "loading"; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "w-20 h-20" : size === "md" ? "w-14 h-14" : "w-10 h-10";
  const textSize = size === "lg" ? "text-2xl" : size === "md" ? "text-lg" : "text-sm";

  if (score === "loading") {
    return <div className={`${dims} rounded-full bg-white/5 border border-white/10 animate-pulse`} />;
  }
  if (!score) {
    return (
      <div className={`${dims} rounded-full bg-white/5 border border-white/10 flex items-center justify-center`}>
        <span className="text-xs text-zinc-500">&mdash;</span>
      </div>
    );
  }
  const v = Math.round(score.score_value);
  return (
    <div className={`${dims} rounded-full border-2 ${scoreBgRing(v)} flex items-center justify-center`}>
      <span className={`${textSize} font-bold tabular-nums ${scoreColor(v)}`}>{v}</span>
    </div>
  );
}

// ── Property card ─────────────────────────────────────────────────────────────

function PropertyCard({ item }: { item: PlaceWithData }) {
  const { place, score, entityCount, entities, hasParcel, sessions, loading } = item;
  const [expanded, setExpanded] = useState(false);
  const v = score ? Math.round(score.score_value) : null;

  // Census analysis from entities
  const { lookupSpecies, estimateWildlifeSpecies } = require("@/lib/piedmont-nc-species");
  const nativeEntities = entities.filter((e: any) => { const info = lookupSpecies(e.species || e.label); return info?.status === "native"; });
  const invasiveEntities = entities.filter((e: any) => { const info = lookupSpecies(e.species || e.label); return info?.status === "invasive"; });
  const nativePct = entityCount > 0 ? Math.round((nativeEntities.length / entityCount) * 100) : 0;
  const uniqueSpecies = new Set(entities.map((e: any) => e.species || e.label)).size;
  const wildlifeEst = estimateWildlifeSpecies(entities.filter((e: any) => e.species).map((e: any) => e.species));

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-white/20 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        <ScoreBadge score={loading ? "loading" : score} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate">{place.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-zinc-500">{typeLabel(place.land_unit_type)}</span>
            {place.address && (
              <span className="text-xs text-zinc-500 truncate max-w-[250px]">· {place.address.split(",").slice(0, 2).join(",")}</span>
            )}
          </div>
          {v !== null && (
            <p className={`text-xs mt-1 ${scoreColor(v)}`}>{scoreLabel(v)}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-none">
          <div className="text-right">
            <p className="text-xs text-zinc-400">{entityCount} plants</p>
            <p className="text-xs text-zinc-500">{sessions.length} scans</p>
          </div>
          <svg className={`w-4 h-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-5 py-4 space-y-4">
          {/* Quick actions */}
          <div className="flex gap-2">
            <a href="/scan" className="flex-1 py-2 bg-lime-300 text-zinc-950 text-xs font-semibold rounded-lg text-center hover:bg-lime-200 transition-colors">Scan</a>
            <a href="/map" className="flex-1 py-2 bg-white/10 text-white text-xs font-medium rounded-lg text-center hover:bg-white/20 transition-colors">Map</a>
            <a href={`/report?id=${place.id}`} className="flex-1 py-2 bg-white/10 text-white text-xs font-medium rounded-lg text-center hover:bg-white/20 transition-colors">Report</a>
          </div>

          {/* Census summary */}
          {entityCount > 0 && (
            <div className="space-y-3">
              {/* Key stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-lg font-bold text-white">{uniqueSpecies}</p>
                  <p className="text-[10px] text-zinc-500">Species</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className={`text-lg font-bold ${nativePct >= 80 ? "text-lime-300" : nativePct >= 50 ? "text-yellow-300" : "text-red-400"}`}>{nativePct}%</p>
                  <p className="text-[10px] text-zinc-500">Native</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-lg font-bold text-lime-300">{wildlifeEst}</p>
                  <p className="text-[10px] text-zinc-500">Wildlife spp.</p>
                </div>
              </div>

              {/* Invasive alert */}
              {invasiveEntities.length > 0 && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                  <p className="text-[10px] text-red-400 uppercase tracking-wider mb-1">Invasive — Remove</p>
                  {invasiveEntities.map((e: any) => (
                    <p key={e.id} className="text-xs text-red-300">{e.label || e.species} <span className="text-red-400/50">×{e.observation_count}</span></p>
                  ))}
                </div>
              )}

              {/* Top native species */}
              <div>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Top Species</p>
                {entities.slice(0, 6).map((e: any) => {
                  const info = lookupSpecies(e.species || e.label);
                  return (
                    <div key={e.id} className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-1.5">
                        {info?.status === "native" && <span className="text-lime-400 text-[10px]">●</span>}
                        {info?.status === "invasive" && <span className="text-red-400 text-[10px]">●</span>}
                        {!info && <span className="text-zinc-600 text-[10px]">●</span>}
                        <span className="text-xs text-zinc-300">{e.label || e.species}</span>
                      </div>
                      <span className="text-[10px] text-zinc-600">×{e.observation_count}</span>
                    </div>
                  );
                })}
                {entities.length > 6 && (
                  <p className="text-[10px] text-zinc-600 mt-1">+ {entities.length - 6} more species</p>
                )}
              </div>
            </div>
          )}

          {/* Recent scans */}
          {sessions.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Recent Scans</p>
              <div className="space-y-1">
                {sessions.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${s.status === "closed" ? "bg-lime-400" : s.status === "open" ? "bg-yellow-400" : "bg-zinc-500"}`} />
                      <span className="text-xs text-zinc-300">{s.capture_mode || "scan"}</span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{timeAgo(s.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entityCount === 0 && (
            <p className="text-xs text-zinc-500 text-center py-2">No plants identified yet — start a scan to build your census.</p>
          )}

          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>{hasParcel ? "✓ Parcel linked" : "No parcel"}</span>
            <span>Added {timeAgo(place.created_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── New property form ─────────────────────────────────────────────────────────

function NewPropertyForm({ token, onCreated, onCancel }: { token: string | undefined; onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("yard");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(token, `${API}/land_units`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), land_unit_type: type, address: address.trim() || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">New property</h3>
        <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 text-sm">Cancel</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Front yard, Backyard, Client property"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
          autoFocus required
        />
        <select
          value={type} onChange={(e) => setType(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-lime-300/50"
        >
          <option value="yard">Yard</option>
          <option value="parcel">Parcel</option>
          <option value="property">Property</option>
          <option value="cluster">Community</option>
        </select>
        <input
          type="text" value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="Address (optional)"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          type="submit" disabled={loading || !name.trim()}
          className="w-full py-2.5 bg-lime-300 text-zinc-950 font-semibold rounded-lg text-sm hover:bg-lime-200 transition-colors disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create property"}
        </button>
      </form>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  const [places, setPlaces] = useState<PlaceWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadPlaces = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch(token, `${API}/land_units`);
      if (!res.ok) throw new Error();
      const units: LandUnit[] = await res.json();

      setPlaces(units.map((p) => ({
        place: p, score: null, entityCount: 0, entities: [], hasParcel: false, sessions: [], loading: true,
      })));
      setLoading(false);

      const hydrated = await Promise.all(
        units.map(async (p) => {
          try {
            const [sr, er, pr, sesr] = await Promise.all([
              apiFetch(token, `${API}/yardscore/${p.id}/latest`),
              apiFetch(token, `${API}/entities?land_unit_id=${p.id}`),
              apiFetch(token, `${API}/parcels?land_unit_id=${p.id}`),
              apiFetch(token, `${API}/observation_sessions?land_unit_id=${p.id}`),
            ]);
            const entList = er.ok ? await er.json() : [];
            return {
              place: p,
              score: sr.ok ? await sr.json() : null,
              entityCount: entList.length,
              entities: entList,
              hasParcel: pr.ok ? (await pr.json()).length > 0 : false,
              sessions: sesr.ok ? await sesr.json() : [],
              loading: false,
            };
          } catch {
            return { place: p, score: null, entityCount: 0, entities: [], hasParcel: false, sessions: [], loading: false };
          }
        })
      );
      setPlaces(hydrated);
    } catch {
      setLoading(false);
    }
  }, [token, refreshKey]);

  useEffect(() => { loadPlaces(); }, [loadPlaces]);

  const totalPlants = places.reduce((sum, p) => sum + p.entityCount, 0);
  const totalScans = places.reduce((sum, p) => sum + p.sessions.length, 0);
  const avgScore = places.filter(p => p.score).length > 0
    ? Math.round(places.filter(p => p.score).reduce((sum, p) => sum + (p.score?.score_value ?? 0), 0) / places.filter(p => p.score).length)
    : null;

  return (
    <div className="min-h-screen bg-[#07110c]">
      <nav className="border-b border-white/5 bg-[#07110c]">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">YardScore</span>
          </a>
          <div className="flex items-center gap-6 text-xs text-zinc-400">
            <a href="/dashboard" className="text-lime-300 font-medium">Dashboard</a>
            <a href="/map" className="hover:text-white transition-colors">Map</a>
            <a href="/upgrade" className="hover:text-lime-300 transition-colors">Pro</a>
            <a href="/scan" className="hover:text-white transition-colors">Scan →</a>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-zinc-500">Properties</p>
            <p className="text-2xl font-bold text-white">{places.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-zinc-500">Total Scans</p>
            <p className="text-2xl font-bold text-white">{totalScans}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-zinc-500">Plants Found</p>
            <p className="text-2xl font-bold text-white">{totalPlants}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs text-zinc-500">Avg Score</p>
            <p className={`text-2xl font-bold ${avgScore ? scoreColor(avgScore) : "text-zinc-500"}`}>
              {avgScore ?? "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Your Properties</h1>
          <div className="flex items-center gap-2">
            <a href="/scan" className="px-4 py-2 bg-lime-300 text-zinc-950 text-xs font-semibold rounded-lg hover:bg-lime-200 transition-colors">Start Scan</a>
            <button
              onClick={() => setShowNewPlace(true)}
              className="px-4 py-2 bg-white/10 text-white text-xs font-medium rounded-lg hover:bg-white/20 transition-colors"
            >+ Add Property</button>
          </div>
        </div>

        {showNewPlace && (
          <div className="mb-6 max-w-md">
            <NewPropertyForm
              token={token}
              onCreated={() => { setShowNewPlace(false); setRefreshKey((k) => k + 1); }}
              onCancel={() => setShowNewPlace(false)}
            />
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : places.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.02]">
            <div className="w-16 h-16 rounded-2xl bg-lime-300/10 border border-lime-300/20 flex items-center justify-center mx-auto mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-1">No properties yet</h2>
            <p className="text-sm text-zinc-400 mb-6">Start a scan to create your first property automatically from GPS.</p>
            <a href="/scan" className="inline-flex px-6 py-3 bg-lime-300 text-zinc-950 font-semibold rounded-xl text-sm hover:bg-lime-200 transition-colors">Start Your First Scan</a>
          </div>
        ) : (
          <div className="space-y-3">
            {places.map((item) => (
              <PropertyCard key={item.place.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <footer className="text-center text-[10px] text-zinc-600 py-8">
        YardScore by DrewHenry · Observation → Intelligence
      </footer>
    </div>
  );
}

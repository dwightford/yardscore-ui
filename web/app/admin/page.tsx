"use client";

/**
 * /admin — Cross-account admin dashboard
 *
 * Only accessible by admin users (role='admin' in users table).
 * Shows all users' properties, scans, entities, and scores.
 * Mirrors the dashboard layout but aggregates across all accounts.
 */

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface User {
  id: string;
  email: string;
  display_name: string;
  role: string;
}

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

interface Entity {
  id: string;
  entity_type: string;
  label: string;
  species: string | null;
  estimated_lat: number | null;
  estimated_lng: number | null;
  observation_count: number;
}

interface SessionSummary {
  id: string;
  status: string;
  capture_mode: string;
  started_at: string;
  created_at: string;
}

interface PropertyData {
  place: LandUnit;
  score: LatestScore | null;
  entities: Entity[];
  sessions: SessionSummary[];
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function scoreColor(v: number): string {
  if (v >= 70) return "text-lime-300";
  if (v >= 45) return "text-yellow-400";
  return "text-red-400";
}

export default function AdminPage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [properties, setProperties] = useState<PropertyData[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/me`)
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.role === "admin") {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => setAuthorized(false));
  }, [token]);

  // Load all data (admin sees everything)
  const loadData = useCallback(async () => {
    if (!token || !authorized) return;
    setLoading(true);

    try {
      // Admin gets all land units
      const luRes = await apiFetch(token, `${API}/land_units?limit=200`);
      if (!luRes.ok) throw new Error("Failed to load");
      const landUnits: LandUnit[] = await luRes.json();

      // Hydrate each property
      const hydrated = await Promise.all(
        landUnits.map(async (lu) => {
          const [scoreRes, entityRes, sessRes] = await Promise.all([
            apiFetch(token, `${API}/yardscore/${lu.id}/latest`).catch(() => null),
            apiFetch(token, `${API}/entities?land_unit_id=${lu.id}`).catch(() => null),
            apiFetch(token, `${API}/observation_sessions?land_unit_id=${lu.id}`).catch(() => null),
          ]);

          return {
            place: lu,
            score: scoreRes?.ok ? await scoreRes.json() : null,
            entities: entityRes?.ok ? await entityRes.json() : [],
            sessions: sessRes?.ok ? await sessRes.json() : [],
          };
        })
      );

      setProperties(hydrated);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, authorized]);

  useEffect(() => { loadData(); }, [loadData]);

  // Aggregate stats
  const totalProperties = properties.length;
  const totalScans = properties.reduce((s, p) => s + p.sessions.length, 0);
  const totalEntities = properties.reduce((s, p) => s + p.entities.length, 0);
  const totalSpecies = new Set(
    properties.flatMap((p) => p.entities.filter((e) => e.species).map((e) => e.species))
  ).size;
  const avgScore = properties.filter((p) => p.score).length > 0
    ? Math.round(
        properties.filter((p) => p.score).reduce((s, p) => s + (p.score?.score_value ?? 0), 0) /
        properties.filter((p) => p.score).length
      )
    : null;

  const selected = selectedProperty
    ? properties.find((p) => p.place.id === selectedProperty)
    : null;

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg font-bold">Access Denied</p>
          <p className="text-zinc-500 text-sm mt-2">Admin access required.</p>
          <a href="/dashboard" className="text-lime-300 text-sm mt-4 block">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07110c]">
      {/* Header */}
      <nav className="border-b border-white/5 bg-[#07110c]">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center">
              <span className="text-xs font-bold text-red-400">A</span>
            </div>
            <div>
              <span className="text-sm font-semibold text-white">Admin Console</span>
              <span className="text-xs text-zinc-500 ml-2">All accounts</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-400">
            <a href="/dashboard" className="hover:text-white">My Dashboard</a>
            <a href="/admin/map" className="hover:text-white">Admin Map</a>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-5 py-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            ["Properties", totalProperties],
            ["Scans", totalScans],
            ["Entities", totalEntities],
            ["Species", totalSpecies],
            ["Avg Score", avgScore ?? "—"],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</p>
              <p className="text-xl font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        {/* Properties list */}
        {loading ? (
          <div className="text-center py-10">
            <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-white/10 bg-white/[0.02]">
            <p className="text-zinc-400">No properties found across any account.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {properties.map((p) => {
              const v = p.score ? Math.round(p.score.score_value) : null;
              const isSelected = selectedProperty === p.place.id;

              return (
                <div key={p.place.id}>
                  <button
                    onClick={() => setSelectedProperty(isSelected ? null : p.place.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:border-white/20 text-left transition-colors"
                  >
                    {/* Score badge */}
                    <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${
                      v ? (v >= 70 ? "border-lime-400/50 bg-lime-400/10" : v >= 45 ? "border-yellow-400/50 bg-yellow-400/10" : "border-red-400/50 bg-red-400/10") : "border-white/10 bg-white/5"
                    }`}>
                      <span className={`text-lg font-bold ${v ? scoreColor(v) : "text-zinc-500"}`}>
                        {v ?? "—"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{p.place.name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {p.place.address?.split(",").slice(0, 2).join(",") || "No address"}
                      </p>
                    </div>

                    <div className="text-right flex-none">
                      <p className="text-xs text-zinc-400">{p.entities.length} plants</p>
                      <p className="text-xs text-zinc-500">{p.sessions.length} scans</p>
                      <p className="text-[10px] text-zinc-600">{timeAgo(p.place.created_at)}</p>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="mt-1 ml-4 mr-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-4">
                      {/* Entities */}
                      {p.entities.length > 0 && (
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Identified Plants</p>
                          <div className="grid grid-cols-2 gap-1">
                            {p.entities.map((e) => (
                              <div key={e.id} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-1.5">
                                <div>
                                  <span className="text-xs text-zinc-300">{e.label || e.species || "Unknown"}</span>
                                  <span className="text-[10px] text-zinc-600 ml-1">{e.entity_type}</span>
                                </div>
                                <span className="text-[10px] text-zinc-500">×{e.observation_count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sessions */}
                      {p.sessions.length > 0 && (
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Scan Sessions</p>
                          {p.sessions.slice(0, 5).map((s) => (
                            <div key={s.id} className="flex items-center justify-between py-0.5">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${s.status === "closed" ? "bg-lime-400" : "bg-yellow-400"}`} />
                                <span className="text-xs text-zinc-400">{s.capture_mode}</span>
                              </div>
                              <span className="text-[10px] text-zinc-600">{timeAgo(s.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Score breakdown */}
                      {p.score && (
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Score</p>
                          <p className="text-xs text-zinc-400">
                            {Math.round(p.score.score_value)} · Coverage {(p.score.coverage * 100).toFixed(0)}% · Confidence {(p.score.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

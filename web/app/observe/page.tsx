"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

interface LandUnit {
  id: string;
  name: string;
  land_unit_type: string;
  address: string | null;
}

interface CoverageData {
  plantCount: number;
  lightCount: number;
  structureStatus: string;
}

// ── SVG Glyphs ───────────────────────────────────────────────────────────────

function SeedlingGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {/* stem */}
      <line x1="24" y1="38" x2="24" y2="22" stroke="#4ade80" />
      {/* left leaf */}
      <path d="M24 26 C20 22, 14 20, 12 24 C10 28, 16 30, 24 26Z" stroke="#22c55e" fill="#22c55e20" />
      {/* right leaf */}
      <path d="M24 22 C28 18, 34 16, 36 20 C38 24, 32 26, 24 22Z" stroke="#4ade80" fill="#4ade8020" />
      {/* roots */}
      <path d="M24 38 C22 42, 20 44, 18 45" stroke="#4ade8060" />
      <path d="M24 38 C26 42, 28 44, 30 45" stroke="#4ade8060" />
    </svg>
  );
}

function SunGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {/* center */}
      <circle cx="24" cy="24" r="7" stroke="#fbbf24" fill="#fbbf2410" />
      {/* rays */}
      <line x1="24" y1="5" x2="24" y2="11" stroke="#fbbf24" />
      <line x1="24" y1="37" x2="24" y2="43" stroke="#fbbf24" />
      <line x1="5" y1="24" x2="11" y2="24" stroke="#fbbf24" />
      <line x1="37" y1="24" x2="43" y2="24" stroke="#fbbf24" />
      <line x1="10.4" y1="10.4" x2="14.6" y2="14.6" stroke="#fcd34d" />
      <line x1="33.4" y1="33.4" x2="37.6" y2="37.6" stroke="#fcd34d" />
      <line x1="37.6" y1="10.4" x2="33.4" y2="14.6" stroke="#fcd34d" />
      <line x1="14.6" y1="33.4" x2="10.4" y2="37.6" stroke="#fcd34d" />
    </svg>
  );
}

function TerrainGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {/* ground layer */}
      <path d="M6 38 Q14 36, 24 38 Q34 40, 42 38" stroke="#a3e635" />
      {/* mid layer */}
      <path d="M6 30 Q14 28, 24 30 Q34 32, 42 30" stroke="#65a30d" />
      {/* canopy layer */}
      <path d="M6 22 Q14 20, 24 22 Q34 24, 42 22" stroke="#166534" />
      {/* small tree on canopy */}
      <line x1="16" y1="22" x2="16" y2="14" stroke="#22c55e" />
      <path d="M12 16 Q14 10, 16 12 Q18 10, 20 16" stroke="#22c55e" fill="#22c55e15" />
    </svg>
  );
}

// ── Mode Card ────────────────────────────────────────────────────────────────

interface ModeCardProps {
  glyph: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  timeEstimate: string;
  builds: string;
  borderClass: string;
  onClick: () => void;
}

function ModeCard({ glyph, title, subtitle, description, timeEstimate, builds, borderClass, onClick }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border ${borderClass} bg-white/[0.03] p-5 hover:bg-white/[0.06] active:bg-white/[0.08] transition-colors`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-none mt-1">{glyph}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="text-sm text-lime-300/80 mt-0.5">{subtitle}</p>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="8" cy="8" r="6" />
                <polyline points="8,5 8,8 10.5,9.5" />
              </svg>
              {timeEstimate}
            </span>
            <span className="text-xs text-zinc-500">{builds}</span>
          </div>
        </div>
        <svg className="w-5 h-5 text-zinc-600 flex-none mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

// ── Coverage Indicator ───────────────────────────────────────────────────────

function CoverageRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ObservePage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const router = useRouter();

  const [properties, setProperties] = useState<LandUnit[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  // ── Load properties ────────────────────────────────────────────────────────

  const loadProperties = useCallback(async () => {
    if (!token) return;
    setLoadingProperties(true);
    try {
      const res = await apiFetch(token, `${API}/land_units`);
      if (!res.ok) throw new Error();
      const units: LandUnit[] = await res.json();
      setProperties(units);
      if (units.length > 0) {
        setSelectedPropertyId(units[0].id);
      }
    } catch {
      // silent
    } finally {
      setLoadingProperties(false);
    }
  }, [token]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  // ── Load coverage for selected property ────────────────────────────────────

  const loadCoverage = useCallback(async () => {
    if (!token || !selectedPropertyId) return;
    setLoadingCoverage(true);
    try {
      const [entRes, lightRes] = await Promise.all([
        apiFetch(token, `${API}/entities?land_unit_id=${selectedPropertyId}`),
        apiFetch(token, `${API}/observations?land_unit_id=${selectedPropertyId}&category=light`),
      ]);
      const entities = entRes.ok ? await entRes.json() : [];
      const lights = lightRes.ok ? await lightRes.json() : [];
      setCoverage({
        plantCount: entities.length,
        lightCount: lights.length,
        structureStatus: "Not started",
      });
    } catch {
      setCoverage(null);
    } finally {
      setLoadingCoverage(false);
    }
  }, [token, selectedPropertyId]);

  useEffect(() => {
    loadCoverage();
  }, [loadCoverage]);

  // ── Navigation handlers ────────────────────────────────────────────────────

  function handlePlantScan() {
    router.push("/scan");
  }

  function handleLightReading() {
    if (properties.length === 1) {
      router.push(`/property/${properties[0].id}/light-walk`);
    } else if (selectedPropertyId) {
      router.push(`/property/${selectedPropertyId}/light-walk`);
    } else {
      router.push("/scan");
    }
  }

  function handleStructurePass() {
    router.push("/scan?mode=structure");
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#07110c]">
      {/* Header */}
      <nav className="border-b border-white/5 bg-[#07110c]">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center gap-3">
          <a href="/dashboard" className="text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Dashboard
          </a>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-5 py-6">
        <h1 className="text-xl font-bold text-white mb-6">New Observation</h1>

        {/* Property selector (multiple properties) */}
        {properties.length > 1 && (
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {properties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPropertyId(p.id)}
                  className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedPropertyId === p.id
                      ? "bg-lime-300 text-zinc-950"
                      : "bg-white/10 text-zinc-300 hover:bg-white/20"
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode cards */}
        <div className="space-y-4">
          <ModeCard
            glyph={<SeedlingGlyph />}
            title="Plant Scan"
            subtitle="Identify species, build your census"
            description="Walk your yard slowly. Point your phone at each plant. Tap to identify. YardScore counts species, classifies native vs invasive, and maps everything."
            timeEstimate="15-30 minutes"
            builds="Species census, entity map, ecological signals"
            borderClass="border-lime-300/30"
            onClick={handlePlantScan}
          />

          <ModeCard
            glyph={<SunGlyph />}
            title="Light Reading"
            subtitle="Record sun and shade conditions"
            description="Stand in each area of your yard. Note whether it's full sun, dappled shade, or full shade right now. Takes 10 seconds per spot."
            timeEstimate="2-5 minutes"
            builds="Light coverage map, planting suitability, time-of-day patterns"
            borderClass="border-amber-300/30"
            onClick={handleLightReading}
          />

          <ModeCard
            glyph={<TerrainGlyph />}
            title="Structure Pass"
            subtitle="Map your yard's ecological layers"
            description="Walk the perimeter. Capture broad photos showing the shape of your landscape — where the tall canopy is, where understory fills in, where ground is open."
            timeEstimate="10-15 minutes"
            builds="Layer classification, structural diversity score, canopy coverage"
            borderClass="border-emerald-300/30"
            onClick={handleStructurePass}
          />
        </div>

        {/* Coverage summary */}
        {properties.length > 0 && (
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Coverage</h2>
              {properties.length > 1 && selectedPropertyId && (
                <span className="text-xs text-zinc-500">
                  {properties.find((p) => p.id === selectedPropertyId)?.name}
                </span>
              )}
            </div>
            {loadingCoverage || loadingProperties ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-5 rounded bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : coverage ? (
              <div className="divide-y divide-white/5">
                <CoverageRow
                  label="Plants"
                  value={coverage.plantCount > 0 ? `${coverage.plantCount} plants identified` : "No plants yet"}
                  color={coverage.plantCount > 0 ? "text-lime-300" : "text-zinc-600"}
                />
                <CoverageRow
                  label="Light"
                  value={coverage.lightCount > 0 ? `${coverage.lightCount} light readings` : "No readings yet"}
                  color={coverage.lightCount > 0 ? "text-amber-300" : "text-zinc-600"}
                />
                <CoverageRow
                  label="Structure"
                  value={coverage.structureStatus}
                  color="text-zinc-600"
                />
              </div>
            ) : (
              <p className="text-xs text-zinc-500">Unable to load coverage data.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

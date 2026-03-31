"use client";

/**
 * /share?id=<land_unit_id> — Public shareable property census report
 *
 * NO AUTH REQUIRED. Anyone with the link can view the census data.
 * Uses /public/report endpoint that returns read-only census data.
 *
 * This is what gets texted to friends, posted in garden clubs,
 * shared on social media. The growth engine.
 */

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { lookupSpecies, estimateWildlifeSpecies } from "@/lib/piedmont-nc-species";
import { generateCensusReport, type CensusReport } from "@/lib/census-report";

interface Entity {
  id: string;
  entity_type: string;
  label: string;
  species: string | null;
  observation_count: number;
}

interface PropertyData {
  property: { id: string; name: string; address: string | null };
  entities: Entity[];
  score: { score_value: number; confidence: number; coverage: number } | null;
  entity_count: number;
}

function scoreColor(v: number): string {
  if (v >= 70) return "text-lime-300";
  if (v >= 45) return "text-yellow-400";
  return "text-red-400";
}

function scoreLabel(v: number): string {
  if (v >= 80) return "Excellent";
  if (v >= 60) return "Good";
  if (v >= 40) return "Fair";
  return "Needs Work";
}

function ShareContent() {
  const searchParams = useSearchParams();
  const landUnitId = searchParams.get("id");

  const [data, setData] = useState<PropertyData | null>(null);
  const [report, setReport] = useState<CensusReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!landUnitId) return;
    // Use the backend API directly (public endpoint, no auth)
    fetch(`/api/public/report/${landUnitId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && !d.error) {
          setData(d);
          if (d.entities.length > 0) {
            const expanded = d.entities.flatMap((e: Entity) =>
              Array(e.observation_count).fill(null).map(() => ({
                species: e.species,
                label: e.label,
                category: e.entity_type,
                confidence: 0.8,
                lat: null,
                lng: null,
              }))
            );
            setReport(generateCensusReport(expanded));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [landUnitId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !report) {
    return (
      <div className="min-h-screen bg-[#07110c] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-zinc-400">Report not found or no census data yet.</p>
        <a href="/" className="text-lime-300 text-sm">Learn about YardScore →</a>
      </div>
    );
  }

  const v = data.score ? Math.round(data.score.score_value) : null;
  const statusEmoji: Record<string, string> = { strong: "✓", moderate: "○", weak: "△", absent: "✗" };
  const statusColorMap: Record<string, string> = { strong: "text-lime-300", moderate: "text-yellow-300", weak: "text-orange-400", absent: "text-red-400" };

  return (
    <div className="min-h-screen bg-[#07110c]">
      <div className="max-w-lg mx-auto px-5 py-10">
        {/* YardScore branding */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-bold text-white">YardScore</p>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Property Ecological Census</p>
          </div>
        </div>

        {/* Property name */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white">{data.property.name}</h1>
          {data.property.address && (
            <p className="text-xs text-zinc-500 mt-1">{data.property.address.split(",").slice(0, 2).join(",")}</p>
          )}
        </div>

        {/* Score + headline */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-4">
          <div className="flex items-center justify-between">
            <div>
              {v !== null && (
                <>
                  <p className="text-xs text-zinc-400 uppercase tracking-widest mb-1">YardScore</p>
                  <p className={`text-5xl font-bold ${scoreColor(v)}`}>{v}</p>
                  <p className="text-sm text-zinc-400">{scoreLabel(v)}</p>
                </>
              )}
            </div>
            <div className="text-right space-y-1">
              <p className="text-2xl font-bold text-white">{report.totalSpecies}</p>
              <p className="text-xs text-zinc-500">species</p>
              <p className={`text-lg font-bold ${report.nativePercent >= 80 ? "text-lime-300" : report.nativePercent >= 50 ? "text-yellow-300" : "text-red-400"}`}>
                {report.nativePercent}% native
              </p>
            </div>
          </div>
        </div>

        {/* Prose */}
        <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-4 mb-4">
          <p className="text-sm text-zinc-200 leading-relaxed">{report.summaryProse}</p>
        </div>

        {/* Wildlife */}
        {report.wildlifeSpeciesEstimate > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4 text-center">
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Wildlife Supported</p>
            <p className="text-4xl font-bold text-lime-300">{report.wildlifeSpeciesEstimate}</p>
            <p className="text-xs text-zinc-400 mt-1">moth & butterfly species hosted by native plants</p>
          </div>
        )}

        {/* Layers */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Ecosystem Layers</h3>
            <span className="text-xs text-zinc-500">{report.layerCompleteness}/4</span>
          </div>
          {(["canopy", "understory", "shrub", "ground_cover"] as const).map((layer) => {
            const l = report.layers[layer];
            const names: Record<string, string> = { canopy: "Canopy", understory: "Understory", shrub: "Shrub", ground_cover: "Ground Cover" };
            return (
              <div key={layer} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${statusColorMap[l.status]}`}>{statusEmoji[l.status]}</span>
                  <span className="text-sm text-zinc-300">{names[layer]}</span>
                </div>
                <span className="text-xs text-zinc-500">{l.count} plants · {l.species} species</span>
              </div>
            );
          })}
        </div>

        {/* Species list */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Species Census</h3>

          {report.invasiveList.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1.5">Invasive</p>
              {report.invasiveList.map((s: any) => (
                <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-red-500/50">
                  <span className="text-xs text-red-300">{s.commonName} <span className="text-red-400/60 italic">{s.scientificName}</span></span>
                  <span className="text-xs text-red-400">×{s.count}</span>
                </div>
              ))}
            </div>
          )}

          {report.nativeList.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-lime-400 uppercase tracking-widest mb-1.5">Native</p>
              {report.nativeList.map((s: any) => (
                <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-lime-500/30">
                  <span className="text-xs text-zinc-300">{s.commonName} <span className="text-zinc-500 italic">{s.scientificName}</span>{s.wildlifeValue > 50 && <span className="text-lime-400 ml-1">★</span>}</span>
                  <span className="text-xs text-zinc-400">×{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-6 text-center mb-6">
          <p className="text-white font-semibold mb-2">Want to know your yard's ecological score?</p>
          <p className="text-xs text-zinc-400 mb-4">Walk your yard with YardScore. Identify plants. Get your census.</p>
          <a href="/" className="inline-block px-6 py-3 bg-lime-300 text-zinc-950 font-bold rounded-xl text-sm">
            Try YardScore Free
          </a>
        </div>

        {/* Attribution */}
        <p className="text-center text-[9px] text-zinc-700">
          YardScore by DrewHenry · Powered by Pl@ntNet · Wildlife data from Doug Tallamy
        </p>
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ShareContent />
    </Suspense>
  );
}

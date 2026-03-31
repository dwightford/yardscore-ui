"use client";

/**
 * /report?id=<land_unit_id> — Property Ecological Census Report
 *
 * The shareable, screenshot-friendly census of a property.
 * Shows everything: score, species list, native/invasive breakdown,
 * layer analysis, wildlife estimate, recommendations.
 *
 * This is THE product — the thing people screenshot and share.
 */

import { Suspense, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { lookupSpecies, estimateWildlifeSpecies } from "@/lib/piedmont-nc-species";
import { generateCensusReport, type CensusReport } from "@/lib/census-report";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Entity {
  id: string;
  entity_type: string;
  label: string;
  species: string | null;
  observation_count: number;
}

interface LatestScore {
  score_value: number;
  confidence: number;
  coverage: number;
}

interface LandUnit {
  id: string;
  name: string;
  address: string | null;
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

function ReportContent() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const searchParams = useSearchParams();
  const landUnitId = searchParams.get("id");

  const [landUnit, setLandUnit] = useState<LandUnit | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [score, setScore] = useState<LatestScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<CensusReport | null>(null);

  useEffect(() => {
    if (!token || !landUnitId) return;
    setLoading(true);

    Promise.all([
      apiFetch(token, `${API}/land_units/${landUnitId}`).then((r) => r.ok ? r.json() : null),
      apiFetch(token, `${API}/entities?land_unit_id=${landUnitId}`).then((r) => r.ok ? r.json() : []),
      apiFetch(token, `${API}/yardscore/${landUnitId}/latest`).then((r) => r.ok ? r.json() : null),
    ]).then(([lu, ents, sc]) => {
      setLandUnit(lu);
      setEntities(ents);
      setScore(sc);

      // Generate census report from entities
      if (ents.length > 0) {
        const observations = ents.map((e: Entity) => ({
          species: e.species,
          label: e.label,
          category: e.entity_type,
          confidence: 0.8,
          lat: null,
          lng: null,
        }));
        // Expand by observation_count
        const expanded = ents.flatMap((e: Entity) =>
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

      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token, landUnitId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!landUnit || !report) {
    return (
      <div className="min-h-screen bg-[#07110c] flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">No census data available yet.</p>
        <a href="/scan" className="text-lime-300 text-sm">Start a scan →</a>
      </div>
    );
  }

  const v = score ? Math.round(score.score_value) : null;
  const statusEmoji: Record<string, string> = { strong: "✓", moderate: "○", weak: "△", absent: "✗" };
  const statusColor: Record<string, string> = { strong: "text-lime-300", moderate: "text-yellow-300", weak: "text-orange-400", absent: "text-red-400" };

  return (
    <div className="min-h-screen bg-[#07110c]">
      {/* Nav */}
      <div className="px-5 pt-14 pb-2 flex items-center justify-between">
        <a href="/dashboard" className="text-zinc-500 text-sm hover:text-white">← Dashboard</a>
        <a href="/map" className="text-zinc-500 text-sm hover:text-white">Map</a>
      </div>

      <div className="px-5 pb-10">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Property Ecological Census</p>
          <h1 className="text-xl font-bold text-white">{landUnit.name}</h1>
          {landUnit.address && (
            <p className="text-xs text-zinc-500 mt-1">{landUnit.address.split(",").slice(0, 2).join(",")}</p>
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

        {/* Prose summary */}
        <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-4 mb-4">
          <p className="text-sm text-zinc-200 leading-relaxed">{report.summaryProse}</p>
        </div>

        {/* Wildlife + layers row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {report.wildlifeSpeciesEstimate > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
              <p className="text-3xl font-bold text-lime-300">{report.wildlifeSpeciesEstimate}</p>
              <p className="text-[10px] text-zinc-500 mt-1">wildlife species supported</p>
            </div>
          )}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-3xl font-bold text-white">{report.layerCompleteness}<span className="text-lg text-zinc-500">/4</span></p>
            <p className="text-[10px] text-zinc-500 mt-1">ecosystem layers</p>
          </div>
        </div>

        {/* Layer analysis */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Ecosystem Structure</h3>
          {(["canopy", "understory", "shrub", "ground_cover"] as const).map((layer) => {
            const l = report.layers[layer];
            const names: Record<string, string> = { canopy: "Canopy", understory: "Understory", shrub: "Shrub", ground_cover: "Ground Cover" };
            return (
              <div key={layer} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${statusColor[l.status]}`}>{statusEmoji[l.status]}</span>
                  <span className="text-sm text-zinc-300">{names[layer]}</span>
                </div>
                <span className="text-xs text-zinc-500">{l.count} plants · {l.species} species</span>
              </div>
            );
          })}
        </div>

        {/* Species census */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Species Census ({report.totalSpecies} species)</h3>

          {report.invasiveList.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1.5">Invasive — Remove</p>
              {report.invasiveList.map((s: any) => (
                <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-red-500/50">
                  <div>
                    <span className="text-xs text-red-300">{s.commonName}</span>
                    <span className="text-[10px] text-red-400/60 ml-1 italic">{s.scientificName}</span>
                  </div>
                  <span className="text-xs text-red-400 font-bold">×{s.count}</span>
                </div>
              ))}
            </div>
          )}

          {report.nativeList.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] text-lime-400 uppercase tracking-widest mb-1.5">Native</p>
              {report.nativeList.map((s: any) => (
                <div key={s.scientificName} className="flex items-center justify-between py-1 pl-2 border-l-2 border-lime-500/30">
                  <div>
                    <span className="text-xs text-zinc-300">{s.commonName}</span>
                    <span className="text-[10px] text-zinc-500 ml-1 italic">{s.scientificName}</span>
                    {s.wildlifeValue > 50 && <span className="text-[9px] text-lime-400 ml-1">★ keystone</span>}
                  </div>
                  <span className="text-xs text-zinc-400">×{s.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-3">Recommendations</h3>
            {report.recommendations.map((rec: any, i: number) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex items-start gap-2">
                  <span className={`text-xs mt-0.5 ${rec.priority === "high" ? "text-red-400" : "text-yellow-400"}`}>
                    {rec.priority === "high" ? "▲" : "●"}
                  </span>
                  <div>
                    <p className="text-xs text-zinc-200">{rec.action}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{rec.reason}</p>
                    {rec.species_suggestions && (
                      <div className="mt-1.5 space-y-1">
                        {rec.species_suggestions.map((sp: string, j: number) => {
                          const name = sp.split(" (")[0];
                          const searchQuery = encodeURIComponent(name + " native plant");
                          return (
                            <div key={j} className="flex items-center gap-2">
                              <span className="text-[10px] text-lime-400">{sp}</span>
                              <a
                                href={`https://www.etsy.com/search?q=${searchQuery}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-zinc-500 underline hover:text-lime-300"
                              >
                                Etsy
                              </a>
                              <a
                                href={`https://www.naturehills.com/search?q=${encodeURIComponent(name)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-zinc-500 underline hover:text-lime-300"
                              >
                                Nature Hills
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <a href="/scan" className="block w-full py-3.5 bg-lime-300 text-zinc-950 font-bold rounded-2xl text-sm text-center">
            Scan Again to Update Census
          </a>
          <a href="/map" className="block w-full py-3.5 bg-white/10 border border-white/10 text-white font-medium rounded-2xl text-sm text-center">
            View on Map
          </a>
        </div>

        {/* Attribution */}
        <p className="text-center text-[9px] text-zinc-700 mt-6">
          YardScore by DrewHenry · Powered by Pl@ntNet · Wildlife data from Doug Tallamy
        </p>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}

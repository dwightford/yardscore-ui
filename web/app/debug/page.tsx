"use client";

/**
 * /debug — Admin debug view showing scan sessions, frames, and classification results.
 * Desktop-only. Not linked in mobile nav.
 */

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LandUnit {
  id: string;
  name: string;
  address: string | null;
}

interface Session {
  id: string;
  land_unit_id: string;
  status: string;
  capture_mode: string;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  frames?: Frame[];
}

interface Frame {
  id: string;
  session_id: string;
  frame_index: number;
  asset_url: string | null;
  asset_key: string | null;
  captured_at: string;
  heading_degrees: number | null;
  device_lat: number | null;
  device_lng: number | null;
}

export default function DebugPage() {
  const { data: session } = useSession();
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => { tokenRef.current = (session as any)?.apiToken; }, [session]);

  const [landUnits, setLandUnits] = useState<LandUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [classifyResult, setClassifyResult] = useState<Record<string, any> | null>(null);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [testImageUrl, setTestImageUrl] = useState("");
  const [apiLogs, setApiLogs] = useState<string[]>([]);

  function log(msg: string) {
    setApiLogs((prev) => [...prev.slice(-49), `${new Date().toLocaleTimeString()} ${msg}`]);
  }

  // Load land units
  useEffect(() => {
    apiFetch(tokenRef.current, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        setLandUnits(data);
        log(`Loaded ${data.length} land units`);
      })
      .catch((e) => log(`Error loading land units: ${e}`));
  }, []);

  // Load sessions when a unit is selected
  useEffect(() => {
    if (!selectedUnit) return;
    apiFetch(tokenRef.current, `${API}/observation_sessions?land_unit_id=${selectedUnit}`)
      .then((r) => r.json())
      .then((data) => {
        setSessions(data);
        log(`Loaded ${data.length} sessions for ${selectedUnit}`);
      })
      .catch((e) => log(`Error loading sessions: ${e}`));
  }, [selectedUnit]);

  // Load session detail with frames
  async function loadSessionDetail(sessionId: string) {
    log(`Loading session ${sessionId}...`);
    try {
      const r = await apiFetch(tokenRef.current, `${API}/observation_sessions/${sessionId}`);
      const data = await r.json();
      setSelectedSession(data);
      log(`Session ${sessionId}: ${data.frames?.length ?? 0} frames`);
    } catch (e) {
      log(`Error: ${e}`);
    }
  }

  // Test classify with a frame
  async function classifyFrame(frameUrl: string) {
    setClassifyLoading(true);
    setClassifyResult(null);
    log(`Classifying frame: ${frameUrl}`);

    try {
      // Fetch the image from the uploads URL
      const imgResp = await apiFetch(tokenRef.current, `${API}${frameUrl}`);
      const blob = await imgResp.blob();

      const fd = new FormData();
      fd.append("file", blob, "frame.jpg");

      const r = await apiFetch(tokenRef.current, `${API}/vision/classify`, {
        method: "POST",
        body: fd,
      });
      const data = await r.json();
      setClassifyResult(data);
      log(`Classification complete: ${data.observations?.length ?? 0} observations, ${data.inference_ms}ms`);
      if (data.raw_response) {
        log(`Raw response: ${data.raw_response.substring(0, 150)}`);
      }
    } catch (e) {
      log(`Classification error: ${e}`);
      setClassifyResult({ error: String(e) });
    } finally {
      setClassifyLoading(false);
    }
  }

  // Test classify with a URL
  async function classifyUrl() {
    if (!testImageUrl) return;
    setClassifyLoading(true);
    setClassifyResult(null);
    log(`Classifying URL: ${testImageUrl}`);

    try {
      const imgResp = await fetch(testImageUrl);
      const blob = await imgResp.blob();

      const fd = new FormData();
      fd.append("file", blob, "test.jpg");

      const r = await apiFetch(tokenRef.current, `${API}/vision/classify`, {
        method: "POST",
        body: fd,
      });
      const data = await r.json();
      setClassifyResult(data);
      log(`Classification complete: ${data.observations?.length ?? 0} observations, ${data.inference_ms}ms`);
    } catch (e) {
      log(`Error: ${e}`);
      setClassifyResult({ error: String(e) });
    } finally {
      setClassifyLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07110c] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm text-zinc-400 hover:text-white">← Dashboard</a>
          <h1 className="text-sm font-bold text-lime-300">Debug Console</h1>
        </div>
        <span className="text-[10px] text-zinc-600">Admin only</span>
      </nav>

      <div className="max-w-7xl mx-auto px-5 py-6 grid grid-cols-3 gap-6">
        {/* Left: Properties + Sessions */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Properties</h2>
          <div className="space-y-1">
            {landUnits.map((lu) => (
              <button
                key={lu.id}
                onClick={() => { setSelectedUnit(lu.id); setSelectedSession(null); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedUnit === lu.id ? "bg-lime-300/10 text-lime-300 border border-lime-300/20" : "bg-white/[0.03] text-zinc-300 border border-white/5 hover:bg-white/[0.06]"
                }`}
              >
                <p className="font-medium truncate">{lu.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{lu.id.slice(0, 8)}... {lu.address || ""}</p>
              </button>
            ))}
          </div>

          {selectedUnit && (
            <>
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mt-6">Sessions</h2>
              <div className="space-y-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSessionDetail(s.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedSession?.id === s.id ? "bg-lime-300/10 text-lime-300 border border-lime-300/20" : "bg-white/[0.03] text-zinc-300 border border-white/5 hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs">{s.capture_mode || "scan"}</span>
                      <div className={`w-2 h-2 rounded-full ${s.status === "closed" ? "bg-lime-400" : "bg-yellow-400"}`} />
                    </div>
                    <p className="text-[10px] text-zinc-500">{new Date(s.created_at).toLocaleString()}</p>
                  </button>
                ))}
                {sessions.length === 0 && <p className="text-xs text-zinc-500">No sessions for this property</p>}
              </div>
            </>
          )}
        </div>

        {/* Center: Frames + Classification */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
            Frames {selectedSession ? `(${selectedSession.frames?.length ?? 0})` : ""}
          </h2>

          {selectedSession?.frames?.map((f) => (
            <div key={f.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400">Frame #{f.frame_index}</span>
                <span className="text-[10px] text-zinc-500">{new Date(f.captured_at).toLocaleTimeString()}</span>
              </div>
              {f.asset_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API}${f.asset_url}`}
                  alt={`Frame ${f.frame_index}`}
                  className="w-full rounded-lg mb-2 max-h-48 object-cover"
                />
              )}
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                {f.device_lat && <span>📍 {f.device_lat.toFixed(4)}, {f.device_lng?.toFixed(4)}</span>}
                {f.heading_degrees != null && <span>🧭 {f.heading_degrees}°</span>}
              </div>
              {f.asset_url && (
                <button
                  onClick={() => classifyFrame(f.asset_url!)}
                  disabled={classifyLoading}
                  className="mt-2 w-full py-1.5 bg-lime-300/10 text-lime-300 text-xs font-medium rounded-lg hover:bg-lime-300/20 disabled:opacity-50 transition-colors"
                >
                  {classifyLoading ? "Classifying..." : "Classify This Frame"}
                </button>
              )}
            </div>
          ))}

          {!selectedSession && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-zinc-500 mb-3">Test classification with any image URL:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testImageUrl}
                  onChange={(e) => setTestImageUrl(e.target.value)}
                  placeholder="https://example.com/tree.jpg"
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
                />
                <button
                  onClick={classifyUrl}
                  disabled={classifyLoading || !testImageUrl}
                  className="px-4 py-2 bg-lime-300 text-zinc-950 text-xs font-semibold rounded-lg hover:bg-lime-200 disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Classification result + logs */}
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Classification Result</h2>

          {classifyResult && (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 space-y-3">
              {classifyResult.error ? (
                <p className="text-red-400 text-xs">{classifyResult.error}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Model: {classifyResult.model}</span>
                    <span className="text-xs text-zinc-500">{classifyResult.inference_ms}ms</span>
                  </div>
                  {classifyResult.scene_description && (
                    <p className="text-xs text-zinc-300 italic">{classifyResult.scene_description}</p>
                  )}
                  {classifyResult.observations?.map((obs: any, i: number) => (
                    <div key={i} className="rounded-lg bg-white/[0.04] border border-white/5 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">
                          {obs.count > 1 ? `${obs.count}× ` : ""}{obs.label}
                        </span>
                        <span className={`text-xs font-medium ${
                          obs.native_status === "native" ? "text-lime-300" :
                          obs.native_status === "invasive" ? "text-red-400" :
                          "text-zinc-400"
                        }`}>
                          {obs.native_status || "unknown"}
                        </span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-zinc-400">
                        <span>Category: {obs.category}</span>
                        <span>Layer: {obs.layer || "—"}</span>
                        <span>Size: {obs.size || "—"}</span>
                        <span>Confidence: {(obs.confidence * 100).toFixed(0)}%</span>
                        {obs.species && <span className="col-span-2">Species: {obs.species}</span>}
                        {obs.health && <span>Health: {obs.health}</span>}
                        {obs.estimated_height_ft && <span>Height: ~{obs.estimated_height_ft}ft</span>}
                      </div>
                      {obs.notes && <p className="text-[10px] text-zinc-500 mt-1">{obs.notes}</p>}
                    </div>
                  ))}
                  {classifyResult.raw_response && (
                    <details className="text-[10px]">
                      <summary className="text-zinc-500 cursor-pointer">Raw model response</summary>
                      <pre className="mt-1 text-zinc-600 whitespace-pre-wrap bg-black/30 rounded p-2 max-h-40 overflow-y-auto">
                        {classifyResult.raw_response}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          )}

          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">API Log</h2>
          <div className="rounded-lg border border-white/10 bg-black/30 p-3 max-h-80 overflow-y-auto font-mono">
            {apiLogs.length === 0 ? (
              <p className="text-xs text-zinc-600">No activity yet</p>
            ) : (
              apiLogs.map((log, i) => (
                <p key={i} className="text-[10px] text-zinc-400 py-0.5">{log}</p>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

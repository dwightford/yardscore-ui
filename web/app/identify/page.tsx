"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";
import { useSearchParams } from "next/navigation";
import NavBar from "../components/NavBar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Suggestion {
  scientific_name: string;
  common_name: string | null;
  family: string | null;
  genus: string | null;
  confidence: number;
}

interface IdentifyResult {
  entity_id: string | null;
  top_suggestion: Suggestion | null;
  suggestions: Suggestion[];
  status: string;
}

export default function IdentifyPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f4ef] flex items-center justify-center"><p className="text-gray-400">Loading...</p></div>}>
      <IdentifyPage />
    </Suspense>
  );
}

function IdentifyPage() {
  const { data: session } = useSession();
  const tokenRef = useRef<string | undefined>(undefined);
  useEffect(() => { tokenRef.current = (session as any)?.apiToken; }, [session]);

  const searchParams = useSearchParams();
  const entityId = searchParams.get("entity");
  const entityName = searchParams.get("name") || "Unknown";

  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [result, setResult] = useState<IdentifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organ, setOrgan] = useState("auto");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoBlob(file);
    setPhoto(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }

  async function handleIdentify() {
    if (!photoBlob) return;
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.append("file", photoBlob, "closeup.jpg");
      if (entityId) fd.append("entity_id", entityId);
      fd.append("organ", organ);

      const r = await apiFetch(tokenRef.current, `${API}/species/identify`, {
        method: "POST",
        body: fd,
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: "Unknown error" }));
        setError(err.detail || `Error ${r.status}`);
        setLoading(false);
        return;
      }

      const data: IdentifyResult = await r.json();
      setResult(data);
    } catch (err) {
      setError("Failed to connect to identification service");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f4ef]">
      <NavBar active="/identify" />

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Entity context */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-400 uppercase tracking-wider">Identifying</p>
          <p className="text-lg font-semibold text-[#2d6a4f]">{entityName}</p>
          {entityId && <p className="text-xs text-gray-400 mt-1">Entity: {entityId.slice(0, 8)}...</p>}
        </div>

        {/* Instructions */}
        <div className="bg-[#e8f5ee] rounded-xl p-4 text-sm text-[#2d6a4f] space-y-2">
          <p className="font-semibold">Take a close-up photo of:</p>
          <ul className="space-y-1 text-[#2d6a4f]/70">
            <li>• <strong>Leaves</strong> — best for most trees and shrubs</li>
            <li>• <strong>Flowers</strong> — most accurate when in bloom</li>
            <li>• <strong>Bark</strong> — useful for winter identification</li>
            <li>• <strong>Fruit/seeds</strong> — when available</li>
          </ul>
        </div>

        {/* Organ selector */}
        <div className="flex gap-2">
          {[
            { value: "auto", label: "Auto" },
            { value: "leaf", label: "Leaf" },
            { value: "flower", label: "Flower" },
            { value: "bark", label: "Bark" },
            { value: "fruit", label: "Fruit" },
          ].map((o) => (
            <button
              key={o.value}
              onClick={() => setOrgan(o.value)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                organ === o.value
                  ? "bg-[#2d6a4f] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#52b788]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Photo capture */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          className="hidden"
        />

        {!photo ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-16 rounded-2xl border-2 border-dashed border-[#52b788] bg-white hover:bg-[#e8f5ee] transition-colors flex flex-col items-center gap-3"
          >
            <svg className="w-10 h-10 text-[#52b788]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            <span className="text-sm font-semibold text-[#2d6a4f]">Take Close-Up Photo</span>
            <span className="text-xs text-gray-400">Get close to the leaves, flowers, or bark</span>
          </button>
        ) : (
          <div className="space-y-4">
            {/* Photo preview */}
            <div className="relative rounded-2xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt="Close-up for identification" className="w-full h-auto rounded-2xl" />
              <button
                onClick={() => { setPhoto(null); setPhotoBlob(null); setResult(null); }}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center text-sm hover:bg-black/70"
              >
                &times;
              </button>
            </div>

            {/* Identify button */}
            {!result && (
              <button
                onClick={handleIdentify}
                disabled={loading}
                className="w-full py-3.5 bg-[#2d6a4f] hover:bg-[#1b4332] text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50 shadow-lg"
              >
                {loading ? "Identifying..." : "Identify This Plant"}
              </button>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Results */}
        {result && result.status === "success" && result.top_suggestion && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* Top result */}
            <div className="bg-[#2d6a4f] p-5 text-white">
              <p className="text-xs uppercase tracking-wider text-white/60 mb-1">Top Match</p>
              <p className="text-xl font-bold">
                {result.top_suggestion.common_name || result.top_suggestion.scientific_name}
              </p>
              <p className="text-sm text-white/70 italic mt-1">
                {result.top_suggestion.scientific_name}
              </p>
              <div className="flex gap-4 mt-3 text-xs text-white/50">
                {result.top_suggestion.family && <span>Family: {result.top_suggestion.family}</span>}
                <span>Confidence: {(result.top_suggestion.confidence * 100).toFixed(0)}%</span>
              </div>
              {entityId && (
                <p className="text-xs text-green-300 mt-3">
                  &#10003; Saved to {entityName}
                </p>
              )}
            </div>

            {/* Other suggestions */}
            {result.suggestions.length > 1 && (
              <div className="p-4">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Other Possibilities</p>
                <div className="space-y-2">
                  {result.suggestions.slice(1).map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {s.common_name || s.scientific_name}
                        </p>
                        <p className="text-xs text-gray-400 italic">{s.scientific_name}</p>
                      </div>
                      <span className="text-xs text-gray-400 tabular-nums">
                        {(s.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => { setPhoto(null); setPhotoBlob(null); setResult(null); }}
                className="flex-1 py-2.5 bg-[#2d6a4f] text-white text-sm font-semibold rounded-lg hover:bg-[#1b4332]"
              >
                Take Another Photo
              </button>
              <a
                href="/map"
                className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg text-center hover:border-[#52b788]"
              >
                Back to Map
              </a>
            </div>
          </div>
        )}

        {result && result.status === "no_match" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            <p className="font-semibold">No species match found</p>
            <p className="mt-1 text-yellow-700">Try getting closer to the leaves or flowers, or select a specific organ type above.</p>
          </div>
        )}

        {/* PlantNet credit */}
        <p className="text-center text-[10px] text-gray-300">
          Species identification powered by PlantNet
        </p>
      </div>
    </div>
  );
}

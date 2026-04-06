"use client";

/**
 * /dashboard — Smart property router
 *
 * Canon: Property Home is the real logged-in homepage.
 * If user has one property → redirect to /property/:id
 * If user has multiple → show a property picker
 * If none → prompt to add a property
 *
 * This page should feel like a brief waypoint, not a destination.
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface LandUnit {
  id: string;
  name: string;
  address: string | null;
  observation_count?: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const token = (session as any)?.apiToken as string | undefined;

  const [landUnits, setLandUnits] = useState<LandUnit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/land_units`)
      .then((r) => r.json())
      .then((data) => {
        const units: LandUnit[] = Array.isArray(data) ? data : data.land_units ?? [];
        setLandUnits(units);

        // Auto-redirect if single property
        if (units.length === 1) {
          router.replace(`/property/${units[0].id}`);
          return;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-lime-300/30 border-t-lime-300 rounded-full animate-spin" />
      </div>
    );
  }

  // No properties — redirect to address-based onboarding
  if (landUnits.length === 0) {
    router.replace("/onboard");
    return (
      <div className="min-h-screen bg-forest-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-forest-300/30 border-t-forest-300 rounded-full animate-spin" />
      </div>
    );
  }

  // Multiple properties — show picker
  return (
    <div className="min-h-screen bg-[#07110c]">
      <nav className="border-b border-white/5 bg-[#07110c] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3 h-3 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-white">YardScore</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-white text-lg font-semibold mb-1">Your properties</h1>
        <p className="text-stone-500 text-sm mb-6">Choose a property to view.</p>

        <div className="space-y-2">
          {landUnits.map((lu) => (
            <a
              key={lu.id}
              href={`/property/${lu.id}`}
              className="block rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] px-4 py-3.5 transition"
            >
              <p className="text-white text-sm font-medium">{lu.name}</p>
              {lu.address && (
                <p className="text-stone-500 text-xs mt-0.5">{lu.address.split(",").slice(0, 2).join(",")}</p>
              )}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

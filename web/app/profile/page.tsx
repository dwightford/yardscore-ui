"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BillingStatus {
  role: string;
  is_pro: boolean;
  is_founder: boolean;
  is_admin: boolean;
  founders_remaining: number;
}

interface UserStats {
  properties: number;
  scans: number;
  species: number;
  plants: number;
}

function PlanBadge({ status }: { status: BillingStatus | null }) {
  if (!status) return null;

  if (status.is_admin) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium">
        Admin
      </span>
    );
  }
  if (status.is_founder) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-lime-300/10 border border-lime-300/30 text-lime-300 text-xs font-medium">
        Founder
      </span>
    );
  }
  if (status.is_pro) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-lime-300/10 border border-lime-300/30 text-lime-300 text-xs font-medium">
        Pro
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium">
      Free
    </span>
  );
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;
  const email = session?.user?.email;

  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    Promise.all([
      apiFetch(token, `${API}/billing/status`).then((r) => r.ok ? r.json() : null),
      apiFetch(token, `${API}/land_units`).then(async (r) => {
        if (!r.ok) return null;
        const units = await r.json();
        // Aggregate stats across all properties
        let scans = 0, plants = 0, speciesSet = new Set<string>();
        await Promise.all(units.map(async (u: any) => {
          const [er, sr] = await Promise.all([
            apiFetch(token, `${API}/entities?land_unit_id=${u.id}`).then((r) => r.ok ? r.json() : []),
            apiFetch(token, `${API}/observation_sessions?land_unit_id=${u.id}`).then((r) => r.ok ? r.json() : []),
          ]);
          plants += er.length;
          scans += sr.length;
          er.forEach((e: any) => { if (e.species) speciesSet.add(e.species); });
        }));
        return { properties: units.length, scans, species: speciesSet.size, plants };
      }),
    ]).then(([b, s]) => {
      setBilling(b);
      setStats(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

  const isPro = billing?.is_pro || billing?.is_admin;

  return (
    <div className="min-h-screen bg-[#07110c] pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-2">
        <h1 className="text-xl font-bold text-white">Profile</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 space-y-4 mt-4">
        {/* User card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-lime-300/10 border border-lime-300/20 flex items-center justify-center">
              <span className="text-xl font-bold text-lime-300">
                {email ? email[0].toUpperCase() : "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold truncate">{email || "—"}</p>
              <div className="flex items-center gap-2 mt-1">
                <PlanBadge status={billing} />
                {billing?.role && !billing.is_admin && (
                  <span className="text-[10px] text-zinc-600">{billing.role}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/[0.03] border border-white/5 animate-pulse" />
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-2xl font-bold text-white">{stats.properties}</p>
              <p className="text-xs text-zinc-500">Properties</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-2xl font-bold text-white">{stats.scans}</p>
              <p className="text-xs text-zinc-500">Scan Sessions</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-2xl font-bold text-white">{stats.species}</p>
              <p className="text-xs text-zinc-500">Species Found</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-2xl font-bold text-white">{stats.plants}</p>
              <p className="text-xs text-zinc-500">Plants Observed</p>
            </div>
          </div>
        )}

        {/* Plan section */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Your Plan</h2>

          {isPro ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-lime-300/5 border border-lime-300/15 p-4">
                <p className="text-lime-300 font-semibold text-sm">
                  {billing?.is_founder ? "Founder's License" :
                   billing?.is_admin ? "Admin Access" :
                   "YardScore Pro"}
                </p>
                <p className="text-zinc-400 text-xs mt-1">
                  {billing?.is_founder ? "Lifetime Pro access — thank you for believing early." :
                   billing?.is_admin ? "Full feature access." :
                   "All features unlocked."}
                </p>
              </div>
              <p className="text-[10px] text-zinc-600">
                All Pro features: detailed reports, score history, PDF export, nursery links, priority ID.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
                <p className="text-white font-semibold text-sm">Free</p>
                <p className="text-zinc-400 text-xs mt-1">
                  Scan, score, species census, map, share link.
                </p>
              </div>
              <a
                href="/upgrade"
                className="block w-full py-3 bg-lime-300 text-zinc-950 text-sm font-bold rounded-xl text-center hover:bg-lime-200 transition-colors"
              >
                Upgrade to Pro
              </a>
              <p className="text-[10px] text-zinc-600 text-center">
                Unlock detailed reports, score history, PDF export, and more.
              </p>
            </div>
          )}
        </div>

        {/* Pro features breakdown */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            {isPro ? "What's included" : "Free vs Pro"}
          </h2>
          <div className="space-y-2">
            {[
              { feature: "Scan & identify plants", free: true, pro: true },
              { feature: "Species census", free: true, pro: true },
              { feature: "YardScore (0-100)", free: true, pro: true },
              { feature: "Map with plant locations", free: true, pro: true },
              { feature: "Share link", free: true, pro: true },
              { feature: "Detailed narrative report", free: false, pro: true },
              { feature: "Score history & trends", free: false, pro: true },
              { feature: "PDF property report", free: false, pro: true },
              { feature: "Nursery recommendations", free: false, pro: true },
              { feature: "Priority plant identification", free: false, pro: true },
            ].map((row) => (
              <div key={row.feature} className="flex items-center justify-between py-1">
                <span className="text-xs text-zinc-300">{row.feature}</span>
                <div className="flex items-center gap-3">
                  {!isPro && (
                    <span className={`text-[10px] ${row.free ? "text-lime-400" : "text-zinc-600"}`}>
                      {row.free ? "✓" : "—"}
                    </span>
                  )}
                  <span className={`text-[10px] ${row.pro ? "text-lime-400" : "text-zinc-600"}`}>
                    {isPro ? (row.pro ? "✓" : "—") : (row.pro ? "✓ Pro" : "—")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full py-3 bg-white/5 border border-white/10 text-zinc-400 text-sm font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors"
        >
          Sign Out
        </button>

        <p className="text-center text-[10px] text-zinc-600 pb-4">
          YardScore by DrewHenry
        </p>
      </div>
    </div>
  );
}

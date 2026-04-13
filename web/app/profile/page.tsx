"use client";

/**
 * /profile — account, stats, and About.
 *
 * Pruned per auth-first / dead-flow sprint:
 *   - Dropped "Upgrade to Pro" CTA and Free vs Pro grid. Canon: creators
 *     never pay for their own yard data (DrewHenry Principle).
 *   - Added About / Troubleshooting section with build sha + API URL so
 *     users can report "which version am I on" without archaeology.
 */

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";

interface BillingStatus {
  role: string;
  is_admin: boolean;
}

interface UserStats {
  properties: number;
  scans: number;
  species: number;
  plants: number;
}

function RoleBadge({ status }: { status: BillingStatus | null }) {
  if (!status) return null;
  if (status.is_admin) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-medium">
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs font-medium">
      Homeowner
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
      apiFetch(token, `${API}/billing/status`).then((r) => (r.ok ? r.json() : null)),
      apiFetch(token, `${API}/land_units`).then(async (r) => {
        if (!r.ok) return null;
        const units = await r.json();
        let scans = 0,
          plants = 0,
          speciesSet = new Set<string>();
        await Promise.all(
          units.map(async (u: any) => {
            const [er, sr] = await Promise.all([
              apiFetch(token, `${API}/entities?land_unit_id=${u.id}`).then((r) =>
                r.ok ? r.json() : [],
              ),
              apiFetch(token, `${API}/observation_sessions?land_unit_id=${u.id}`).then((r) =>
                r.ok ? r.json() : [],
              ),
            ]);
            plants += er.length;
            scans += sr.length;
            er.forEach((e: any) => {
              if (e.species) speciesSet.add(e.species);
            });
          }),
        );
        return { properties: units.length, scans, species: speciesSet.size, plants };
      }),
    ])
      .then(([b, s]) => {
        setBilling(b);
        setStats(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-[#07110c] pb-24">
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
                <RoleBadge status={billing} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-white/[0.03] border border-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : (
          stats && (
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
          )
        )}

        {/* Preferences */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">Preferences</h2>
          <p className="text-xs text-zinc-400">
            Per-yard preferences (outcomes, light, planting style) live on each
            property. Open your property home to adjust them.
          </p>
        </div>

        {/* Integrations — canonical home for image import + external connections */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white mb-1">Integrations</h2>
          <p className="text-xs text-zinc-500 mb-4">
            Connect external photo libraries and services. These live here, not
            in the mainline app flow.
          </p>
          <div className="space-y-2">
            {[
              {
                name: "Google Photos",
                desc: "Import past yard photos for passive species ID.",
                status: "Pending verification",
              },
              {
                name: "iCloud / Apple Photos",
                desc: "Bulk import from your camera roll.",
                status: "Not yet available",
              },
              {
                name: "Camera",
                desc: "Live capture during Observe. Enabled on mobile.",
                status: "Built in",
              },
            ].map((row) => (
              <div
                key={row.name}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white">{row.name}</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">{row.desc}</p>
                </div>
                <span className="flex-none rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Troubleshooting / About */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm font-semibold text-white mb-3">
            About & troubleshooting
          </h2>
          <dl className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">Build</dt>
              <dd className="font-mono text-zinc-300">{BUILD_SHA}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">API</dt>
              <dd className="font-mono text-zinc-300 truncate max-w-[60%]" title={API}>
                {API.replace(/^https?:\/\//, "")}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zinc-500">App</dt>
              <dd className="text-zinc-300">YardScore by DrewHenry</dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] text-zinc-600">
            Include the build id when reporting a problem — it tells us which
            version you&apos;re on.
          </p>
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

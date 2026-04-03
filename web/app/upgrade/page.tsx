"use client";

/**
 * /upgrade — Tiered pricing page with Stripe Checkout
 *
 * Tiers: Free | Pro (annual) | Founder (lifetime, limited) | Team (coming soon)
 */

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BillingStatus {
  role: string;
  is_pro: boolean;
  is_founder: boolean;
  is_admin: boolean;
  founders_remaining: number;
  available_products: {
    founders_license: { available: boolean; remaining: number; price: string };
    pro_annual: { available: boolean; price: string };
  };
}

const CHECK = (
  <svg className="w-3.5 h-3.5 text-lime-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const DASH = <span className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-zinc-600 text-xs flex items-center">—</span>;

export default function UpgradePage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/billing/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setStatus(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [token]);

  async function startCheckout(product: string) {
    if (!token) return;
    setCheckingOut(product);
    try {
      const r = await apiFetch(token, `${API}/billing/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.checkout_url) {
          window.location.href = data.checkout_url;
          return;
        }
      }
      const err = await r.json().catch(() => ({ detail: "Checkout failed" }));
      alert(err.detail || "Checkout failed");
    } catch {
      alert("Could not start checkout. Try again.");
    }
    setCheckingOut(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isPro = status?.is_pro || status?.is_admin;
  const isFounder = status?.is_founder;
  const foundersLeft = status?.available_products.founders_license.remaining ?? 0;
  const foundersAvailable = status?.available_products.founders_license.available ?? false;

  return (
    <div className="min-h-screen bg-[#07110c] pb-20">
      {/* Nav */}
      <div className="border-b border-white/10 px-5 py-4 flex items-center gap-3">
        <a href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-base font-semibold text-white">Plans</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8">
        {/* Already pro */}
        {isPro && (
          <div className="rounded-2xl border border-lime-300/25 bg-lime-300/5 p-6 text-center mb-8">
            <p className="text-lime-300 text-lg font-bold mb-1">
              {isFounder ? "Founder's License" : "Pro access active"}
            </p>
            <p className="text-zinc-400 text-sm mb-4">
              {isFounder
                ? "Lifetime access. Thank you for being a founder."
                : "All features unlocked. Thank you for supporting YardScore."}
            </p>
            <a href="/dashboard" className="text-sm text-lime-300 hover:text-lime-200">
              Back to Dashboard →
            </a>
          </div>
        )}

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-1">
            {isPro ? "Your plan" : "Unlock the full picture"}
          </h2>
          <p className="text-sm text-zinc-400">
            Start free. Upgrade when you're ready.
          </p>
        </div>

        <div className="space-y-4">

          {/* ── Free ─────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-bold text-white">Free</p>
                <p className="text-xs text-zinc-500 mt-0.5">Scan, score, share</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">$0</p>
              </div>
            </div>
            <ul className="space-y-1.5">
              {["5 scans/month", "Plant census + score", "Shareable link"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">{CHECK}{f}</li>
              ))}
              {["Score history", "Full reports", "Species recommendations"].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-zinc-600">{DASH}{f}</li>
              ))}
            </ul>
            {!isPro && (
              <div className="mt-4 py-2.5 rounded-xl border border-white/10 text-center text-xs text-zinc-500">
                Your current plan
              </div>
            )}
          </div>

          {/* ── Pro Annual ───────────────────────────────────── */}
          <div className={`rounded-2xl border p-5 ${isPro && !isFounder ? "border-lime-300/40 bg-lime-300/5" : "border-white/15 bg-white/[0.04]"}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-bold text-white">Pro</p>
                <p className="text-xs text-zinc-400 mt-0.5">For serious yard stewards</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-white">$29.99</p>
                <p className="text-[10px] text-zinc-500">/ year</p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-4">
              {[
                "Unlimited scans",
                "Score history + trends",
                "LLM-generated property narrative",
                "Shareable PDF report",
                "Species recommendations",
                "Neighbor comparison (coming soon)",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">{CHECK}{f}</li>
              ))}
            </ul>
            {!isPro ? (
              <button
                onClick={() => startCheckout("pro_annual")}
                disabled={!!checkingOut}
                className="w-full py-3 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm hover:bg-white/20 transition-colors disabled:opacity-50"
              >
                {checkingOut === "pro_annual" ? "Redirecting…" : "Get Pro — $29.99/yr"}
              </button>
            ) : (
              <div className="py-2.5 rounded-xl text-center text-xs text-lime-300/70">
                {isPro && !isFounder ? "✓ Your plan" : "Included in your plan"}
              </div>
            )}
          </div>

          {/* ── Founder's License ────────────────────────────── */}
          {(foundersAvailable || isFounder) && (
            <div className={`rounded-2xl border-2 p-5 ${isFounder ? "border-lime-300/50 bg-lime-300/8" : "border-lime-300/30 bg-lime-300/5"}`}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-white">Founder&apos;s License</p>
                    <span className="text-[10px] bg-lime-300/20 text-lime-300 border border-lime-300/30 px-1.5 py-0.5 rounded-full font-medium">Limited</span>
                  </div>
                  <p className="text-xs text-lime-300/70 mt-0.5">Lifetime Pro — one-time</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-white">$29.99</p>
                  <p className="text-[10px] text-zinc-500">forever</p>
                </div>
              </div>

              {!isFounder && (
                <div className="mt-3 mb-4">
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
                    <span>{foundersLeft} seats remaining</span>
                    <span>{50 - foundersLeft} / 50 claimed</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime-400 rounded-full"
                      style={{ width: `${((50 - foundersLeft) / 50) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <ul className="space-y-1.5 mb-4">
                {[
                  "Everything in Pro, forever",
                  "Founder badge on your profile",
                  "Direct access to the team",
                  "Input on the product roadmap",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">{CHECK}{f}</li>
                ))}
              </ul>

              {!isPro ? (
                <button
                  onClick={() => startCheckout("founders_license")}
                  disabled={!!checkingOut}
                  className="w-full py-3 rounded-xl bg-lime-300 text-zinc-950 font-bold text-sm hover:bg-lime-200 transition-colors disabled:opacity-50"
                >
                  {checkingOut === "founders_license" ? "Redirecting…" : "Claim Founder's License"}
                </button>
              ) : (
                <div className="py-2.5 rounded-xl text-center text-xs text-lime-300/70">
                  {isFounder ? "✓ You are a founder" : "Included in your plan"}
                </div>
              )}
            </div>
          )}

          {/* ── Team / Pro (coming soon) ──────────────────────── */}
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 opacity-70">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-white">Team</p>
                  <span className="text-[10px] bg-white/10 text-zinc-400 border border-white/10 px-1.5 py-0.5 rounded-full">Coming soon</span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">For professionals & multi-property</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-zinc-400">$—</p>
                <p className="text-[10px] text-zinc-600">/ mo</p>
              </div>
            </div>
            <ul className="space-y-1.5 mb-4">
              {[
                "Multiple properties under one account",
                "Arborist & grower report types",
                "Client-facing share pages",
                "Bulk export",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-zinc-500">{CHECK}{f}</li>
              ))}
            </ul>
            <a
              href="mailto:dwight@drewhenry.com?subject=YardScore Team interest"
              className="block w-full py-2.5 rounded-xl border border-white/10 text-zinc-400 text-sm text-center hover:text-white hover:border-white/20 transition-colors"
            >
              Get notified when available
            </a>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-600 mt-8">
          All plans include data portability — your observations are always yours.
        </p>
      </div>
    </div>
  );
}

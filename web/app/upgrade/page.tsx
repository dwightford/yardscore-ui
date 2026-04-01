"use client";

/**
 * /upgrade — Pricing page with Stripe Checkout
 *
 * Shows Founder's License (limited seats) and Pro annual.
 * Checks billing status to show remaining seats and current role.
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

  return (
    <div className="min-h-screen bg-[#07110c]">
      {/* Nav */}
      <div className="px-5 pt-14 pb-4">
        <a href="/dashboard" className="text-zinc-500 text-sm hover:text-white">← Dashboard</a>
      </div>

      <div className="max-w-lg mx-auto px-5 pb-12">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white">
            {isPro ? "You have Pro access" : "Upgrade to Pro"}
          </h1>
          {isPro ? (
            <p className="text-zinc-400 text-sm mt-2">
              {status?.is_founder ? "Founder's License — lifetime access" :
               status?.is_admin ? "Admin access — full features" :
               "Pro subscriber — all features unlocked"}
            </p>
          ) : (
            <p className="text-zinc-400 text-sm mt-2">
              Unlock detailed reports, score history, and more.
            </p>
          )}
        </div>

        {!isPro && (
          <div className="space-y-4">
            {/* Founder's License */}
            {status?.available_products.founders_license.available && (
              <div className="rounded-2xl border-2 border-lime-300/30 bg-lime-300/5 p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Founder&apos;s License</h2>
                    <p className="text-xs text-lime-300">Lifetime Pro access</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">$29.99</p>
                    <p className="text-[10px] text-zinc-500">one time, forever</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 mb-3">
                  First 50 users only. {status.available_products.founders_license.remaining} seats remaining.
                  Everything in Pro, plus Founder badge and direct access to the team.
                </p>

                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-lime-400 rounded-full"
                    style={{ width: `${((50 - status.available_products.founders_license.remaining) / 50) * 100}%` }}
                  />
                </div>

                <button
                  onClick={() => startCheckout("founders_license")}
                  disabled={checkingOut === "founders_license"}
                  className="w-full py-3.5 bg-lime-300 text-zinc-950 font-bold rounded-xl text-sm transition hover:bg-lime-200 disabled:opacity-50"
                >
                  {checkingOut === "founders_license" ? "Redirecting to checkout..." : "Get Founder's License"}
                </button>
              </div>
            )}

            {/* Pro Annual */}
            {status?.available_products.pro_annual.available && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">YardScore Pro</h2>
                    <p className="text-xs text-zinc-400">Annual subscription</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">$29.99</p>
                    <p className="text-[10px] text-zinc-500">per year</p>
                  </div>
                </div>

                <button
                  onClick={() => startCheckout("pro_annual")}
                  disabled={checkingOut === "pro_annual"}
                  className="w-full py-3.5 bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-sm transition hover:bg-white/20 disabled:opacity-50"
                >
                  {checkingOut === "pro_annual" ? "Redirecting to checkout..." : "Subscribe to Pro"}
                </button>
              </div>
            )}

            {/* What Pro includes */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white mb-3">What you get with Pro</h3>
              <div className="space-y-2">
                {[
                  "Detailed census report with LLM-generated narrative",
                  "Score history and improvement tracking over time",
                  "Shareable PDF property report",
                  "Neighbor comparison (when available)",
                  "Priority plant identification",
                  "Species recommendations matched to your site conditions",
                  "Local nursery links with availability",
                ].map((feature) => (
                  <div key={feature} className="flex items-start gap-2">
                    <span className="text-lime-400 text-xs mt-0.5">✓</span>
                    <span className="text-xs text-zinc-300">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Free tier reminder */}
            <p className="text-center text-[10px] text-zinc-600 mb-6">
              Free tier includes: scan, score, species census, map, share link.
              You never lose access to your data.
            </p>

            {/* Professional tiers */}
            <div className="border-t border-white/[0.06] pt-6">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4 text-center">For Professionals</p>

              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Grower</p>
                    <p className="text-[10px] text-zinc-500">For propagators and small native plant growers</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">$9.99<span className="text-zinc-500 font-normal">/mo</span></p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Arborist</p>
                    <p className="text-[10px] text-zinc-500">Multi-property assessments with professional reports</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">$19.99<span className="text-zinc-500 font-normal">/mo</span></p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Nursery</p>
                    <p className="text-[10px] text-zinc-500">Inventory visibility, demand intelligence, featured listings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">$50<span className="text-zinc-500 font-normal">/mo</span></p>
                  </div>
                </div>

                <p className="text-center text-[10px] text-zinc-600 mt-2">
                  Professional tiers coming soon. <a href="mailto:dwight@drewhenry.com" className="text-lime-400/70 hover:text-lime-300">Contact us</a> for early access.
                </p>
              </div>
            </div>
          </div>
        )}

        {isPro && (
          <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-6 text-center">
            <p className="text-lime-300 text-lg font-bold mb-2">All features unlocked</p>
            <p className="text-zinc-400 text-sm">Thank you for supporting YardScore.</p>
            <a href="/dashboard" className="mt-4 inline-block text-sm text-lime-300 hover:text-lime-200">
              Back to Dashboard →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

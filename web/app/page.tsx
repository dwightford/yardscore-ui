"use client";

/**
 * Landing page — persona-targeted.
 * Tabs: Homeowner / Grower / Arborist / Nursery
 * URL targeting: ?for=grower shows grower pitch by default
 * Dynamic stats from real database per persona.
 */

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Sprout, Camera, TreePine, ShoppingBag, Leaf, Users, Store } from "lucide-react";

type Persona = "homeowner" | "grower" | "arborist" | "nursery";

const PERSONAS: { key: Persona; label: string; icon: any }[] = [
  { key: "homeowner", label: "Homeowners", icon: TreePine },
  { key: "grower", label: "Growers", icon: Leaf },
  { key: "arborist", label: "Arborists", icon: Users },
  { key: "nursery", label: "Nurseries", icon: Store },
];

const HERO: Record<Persona, { headline: string; highlight: string; description: string; cta: string; ctaLink: string }> = {
  homeowner: {
    headline: "Walk your yard.",
    highlight: "Know what grows.",
    description: "Point your phone at plants. YardScore identifies species, classifies native vs invasive, and produces an ecological census of your property — with recommendations for what to plant next.",
    cta: "Start Scanning — Free",
    ctaLink: "/login",
  },
  grower: {
    headline: "You grow native plants.",
    highlight: "We find your customers.",
    description: "Homeowners near you are being told exactly which species to plant. Your plants show up in their recommendations. You focus on growing — YardScore brings you the demand.",
    cta: "Join as a Grower — $9.99/mo",
    ctaLink: "/upgrade",
  },
  arborist: {
    headline: "Inventory a property.",
    highlight: "In 10 minutes.",
    description: "Walk a client's yard, tap trees, get a species census with GPS positions. Replace clipboard notes with professional data. Generate branded assessment reports.",
    cta: "Start Arborist Trial — $19.99/mo",
    ctaLink: "/upgrade",
  },
  nursery: {
    headline: "Your customers know",
    highlight: "exactly what they need.",
    description: "They walk in with a YardScore report showing which species their yard needs, matched to their site conditions. Your inventory shows up in their recommendations.",
    cta: "Partner With Us",
    ctaLink: "mailto:dwight@drewhenry.com?subject=YardScore%20Nursery%20Partnership",
  },
};

const STATS_BY_PERSONA: Record<Persona, { stats: { value: string; label: string }[] }> = {
  homeowner: {
    stats: [
      { value: "", label: "properties scanned" },
      { value: "", label: "species identified" },
      { value: "", label: "plants observed" },
      { value: "", label: "scan sessions" },
    ],
  },
  grower: {
    stats: [
      { value: "", label: "species recommended to homeowners" },
      { value: "", label: "homeowners scanning near you" },
      { value: "", label: "recommendations with nursery links" },
      { value: "$9.99", label: "per month to be listed" },
    ],
  },
  arborist: {
    stats: [
      { value: "", label: "properties in the system" },
      { value: "10 min", label: "to census a property" },
      { value: "", label: "species in our database" },
      { value: "$19.99", label: "per month" },
    ],
  },
  nursery: {
    stats: [
      { value: "", label: "homeowners getting recommendations" },
      { value: "", label: "species recommended monthly" },
      { value: "", label: "local nurseries listed" },
      { value: "$50", label: "per month for featured listing" },
    ],
  },
};

const FEATURES_BY_PERSONA: Record<Persona, { title: string; desc: string }[]> = {
  homeowner: [
    { title: "Species Census", desc: "Every plant identified by species, with common and scientific names." },
    { title: "Native vs Invasive", desc: "Each species classified against the USDA PLANTS database for your region." },
    { title: "Wildlife Supported", desc: "Estimated moth and butterfly species hosted, based on Doug Tallamy's research." },
    { title: "Ecosystem Layers", desc: "Canopy, understory, shrub, and ground cover — how complete is your habitat?" },
    { title: "YardScore (0-100)", desc: "An ecological health rating based on native species, layer diversity, and composition." },
    { title: "Light Conditions", desc: "Real-time sun and shade measurement. Over time, builds a light map of your yard." },
    { title: "What to Plant Next", desc: "Species recommendations matched to your site conditions, with links to local nurseries." },
  ],
  grower: [
    { title: "Demand Signal", desc: "See which species homeowners near you are being told to plant." },
    { title: "Listed in Recommendations", desc: "Your name appears when a homeowner needs a species you grow." },
    { title: "Seasonal Timing", desc: "Know when demand peaks for spring and fall planting." },
    { title: "No Website Needed", desc: "YardScore is your storefront. Homeowners find you through the app." },
    { title: "Lead Generation", desc: "Warm leads — people who already know they need your plants." },
    { title: "Simple Onboarding", desc: "Tell us what you grow and where you are. That's it." },
  ],
  arborist: [
    { title: "10-Minute Census", desc: "Walk a property, tap trees, get species + GPS positions." },
    { title: "Professional Tags", desc: "Your observations carry expert confidence. Tag trees for work." },
    { title: "Client Portfolio", desc: "Manage multiple properties from one dashboard." },
    { title: "Branded Reports", desc: "Generate PDF assessments with your company name and credentials." },
    { title: "Before & After", desc: "Track properties over time — show clients the improvement." },
    { title: "Jobber-Ready", desc: "Property data formatted for proposal and invoice tools." },
  ],
  nursery: [
    { title: "Qualified Leads", desc: "Homeowners arrive knowing exactly which species they need." },
    { title: "Inventory Visibility", desc: "Your stock appears in recommendations for nearby homeowners." },
    { title: "Demand Intelligence", desc: "See which species are most recommended in your service area." },
    { title: "Site-Matched Customers", desc: "Recommendations match plants to the customer's measured light conditions." },
    { title: "Featured Listing", desc: "Your nursery highlighted in reports for homeowners within your radius." },
    { title: "Sales Tracking", desc: "See which recommendations convert to in-store visits." },
  ],
};

function LandingContent() {
  const searchParams = useSearchParams();
  const forParam = searchParams.get("for") as Persona | null;
  const [persona, setPersona] = useState<Persona>(forParam && HERO[forParam] ? forParam : "homeowner");
  const [stats, setStats] = useState<{ properties: number; species: number; scans: number; plants: number } | null>(null);

  useEffect(() => {
    fetch("/api/public/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  const hero = HERO[persona];
  const features = FEATURES_BY_PERSONA[persona];

  // Fill in dynamic stats
  const personaStats = STATS_BY_PERSONA[persona].stats.map((s) => {
    if (s.value) return s; // static values like "$9.99"
    if (!stats) return { ...s, value: "—" };
    if (s.label.includes("properties")) return { ...s, value: String(stats.properties) };
    if (s.label.includes("species")) return { ...s, value: String(stats.species) };
    if (s.label.includes("plants")) return { ...s, value: String(stats.plants) };
    if (s.label.includes("scan")) return { ...s, value: String(stats.scans) };
    if (s.label.includes("homeowners")) return { ...s, value: String(stats.properties) };
    if (s.label.includes("nurseries")) return { ...s, value: "4" }; // current local nursery count
    if (s.label.includes("recommended")) return { ...s, value: String(stats.species) };
    return { ...s, value: "—" };
  });

  return (
    <div className="min-h-screen bg-[#07110c] text-white">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <Sprout className="h-5 w-5 text-lime-300" />
          </div>
          <span className="text-lg font-semibold tracking-tight">YardScore</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/upgrade" className="text-sm text-lime-300 hover:text-lime-200 transition-colors">Pricing</a>
          <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign In</a>
          <a href={hero.ctaLink} className="hidden sm:inline-flex rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200">
            {persona === "homeowner" ? "Scan Your Yard" : "Get Started"}
          </a>
        </div>
      </header>

      {/* Persona tabs */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex gap-1 border-b border-white/[0.06] overflow-x-auto">
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.key}
                onClick={() => setPersona(p.key)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                  persona === p.key
                    ? "border-lime-300 text-lime-300"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero — changes per persona */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-16 lg:pt-16 lg:pb-24">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {hero.headline}<br />
            <span className="text-lime-300">{hero.highlight}</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed max-w-xl">
            {hero.description}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a href={hero.ctaLink} className="inline-flex items-center justify-center rounded-full bg-lime-300 px-8 py-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-200">
              {hero.cta}
            </a>
            {persona === "homeowner" && (
              <a href="/share?id=87883629-e775-4729-a466-4d6112af853e" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white transition hover:bg-white/10">
                See a Real Census
              </a>
            )}
          </div>
        </div>

        {/* Stats — dynamic per persona */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {personaStats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-2xl font-bold text-lime-300">{s.value}</p>
              <p className="text-xs text-zinc-400 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features — change per persona */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold text-white mb-8">
          {persona === "homeowner" ? "What you learn about your yard" :
           persona === "grower" ? "What you get as a Grower" :
           persona === "arborist" ? "What you get as an Arborist" :
           "What you get as a Nursery Partner"}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-lime-300/15 bg-lime-300/5 p-8 sm:p-12 text-center">
          <h2 className="text-3xl font-bold text-white">
            {persona === "homeowner" ? "Know what grows in your yard." :
             persona === "grower" ? "Your plants. Their yards. Connected." :
             persona === "arborist" ? "Assess properties faster." :
             "Your customers already know what they need."}
          </h2>
          <p className="mt-4 text-zinc-300 max-w-lg mx-auto">
            {persona === "homeowner" ? "Free to scan. Free to score. Takes 10-20 minutes. Works on any phone." :
             persona === "grower" ? "$9.99/month. Tell us what you grow. We find your customers." :
             persona === "arborist" ? "$19.99/month. Multi-property. Professional reports. 10-minute census." :
             "Contact us to become a featured nursery partner."}
          </p>
          <a
            href={hero.ctaLink}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-lime-300 px-10 py-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-200"
          >
            {hero.cta}
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span><span className="text-zinc-400">YardScore</span> by DrewHenry</span>
          <div className="flex gap-6">
            <span>Species ID by Pl@ntNet</span>
            <span>Wildlife data from Doug Tallamy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07110c]" />}>
      <LandingContent />
    </Suspense>
  );
}

"use client";

/**
 * Landing page — the product speaks for itself.
 * No hype. Real numbers. Real value.
 */

import { Sprout, Camera, TreePine, ShoppingBag } from "lucide-react";

export default function LandingPage() {
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
          <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign In</a>
          <a href="/login" className="rounded-full bg-lime-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-lime-200">
            Scan Your Yard
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-12 pb-20 lg:pt-20 lg:pb-28">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Walk your yard.<br />
            <span className="text-lime-300">Know what grows.</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-300 leading-relaxed max-w-xl">
            Point your phone at plants. YardScore identifies species, classifies native
            vs invasive, and produces an ecological census of your property — with
            recommendations for what to plant next.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a href="/login" className="inline-flex items-center justify-center rounded-full bg-lime-300 px-8 py-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-200">
              Start Scanning — Free
            </a>
            <a href="/share?id=87883629-e775-4729-a466-4d6112af853e" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-8 py-4 text-sm font-medium text-white transition hover:bg-white/10">
              See a Real Census
            </a>
          </div>
        </div>

        {/* Real stats */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-3xl font-bold text-lime-300">28</p>
            <p className="text-sm text-zinc-400 mt-1">species identified in one walk</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-3xl font-bold text-white">88%</p>
            <p className="text-sm text-zinc-400 mt-1">native species on this property</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-3xl font-bold text-lime-300">2,345</p>
            <p className="text-sm text-zinc-400 mt-1">wildlife species supported</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-3xl font-bold text-white">23 min</p>
            <p className="text-sm text-zinc-400 mt-1">to census a 1-acre yard</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-bold text-white mb-12">How it works</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10">
                <Camera className="h-6 w-6 text-lime-300" />
              </div>
              <h3 className="text-lg font-semibold text-white">Scan</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Walk your yard with your phone. Tap the ID button when you see a plant.
                Tap multiple times on a tree — bark, branches, leaves — for better accuracy.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10">
                <TreePine className="h-6 w-6 text-lime-300" />
              </div>
              <h3 className="text-lg font-semibold text-white">Census</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Every species identified, native vs invasive, ecosystem layer analysis,
                and an estimate of how many wildlife species your plants support.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-lime-300/20 bg-lime-300/10">
                <ShoppingBag className="h-6 w-6 text-lime-300" />
              </div>
              <h3 className="text-lg font-semibold text-white">Improve</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Specific recommendations: which invasive to remove, which native to plant,
                and where to buy it from local nurseries. Rescan next season to see your score improve.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What you learn */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-bold text-white mb-8">What you learn about your yard</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { title: "Species Census", desc: "Every plant identified by species, with common and scientific names." },
            { title: "Native vs Invasive", desc: "Each species classified against the USDA PLANTS database for your region." },
            { title: "Wildlife Supported", desc: "Estimated moth and butterfly species hosted, based on Doug Tallamy's research." },
            { title: "Ecosystem Layers", desc: "Canopy, understory, shrub, and ground cover — how complete is your habitat?" },
            { title: "YardScore (0-100)", desc: "An ecological health rating based on native species, layer diversity, and composition." },
            { title: "What to Plant Next", desc: "Species recommendations with links to local nurseries and online shops." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-2xl border border-lime-300/15 bg-lime-300/5 p-8 sm:p-12 text-center">
          <h2 className="text-3xl font-bold text-white">Know what grows in your yard.</h2>
          <p className="mt-4 text-zinc-300 max-w-lg mx-auto">
            Free to scan. Free to score. Takes 10-20 minutes.
            Works on any phone with a camera.
          </p>
          <a
            href="/login"
            className="mt-8 inline-flex items-center justify-center rounded-full bg-lime-300 px-10 py-4 text-sm font-bold text-zinc-950 transition hover:bg-lime-200"
          >
            Start Scanning
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

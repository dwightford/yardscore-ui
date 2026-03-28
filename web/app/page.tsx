import Image from "next/image";
import EarlyAccessForm from "./components/EarlyAccessForm";

/* ── YardScore SVG Logo ──────────────────────────────────────────────────── */

function YardScoreLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 44" fill="none" role="img" aria-label="YardScore" className={className}>
      <rect width="44" height="44" rx="9" fill="#2d6a4f" />
      <path d="M14 11 L22 21 L30 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="22" y1="21" x2="22" y2="29" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="13" y1="33" x2="31" y2="33" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      <text x="56" y="29" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fontSize="19" fontWeight="600" letterSpacing="-0.4" fill="#1a3328">YardScore</text>
    </svg>
  );
}

/* ── Landing Page ─────────────────────────────────────────────────────────── */

export default function EcoEntryPage() {
  return (
    <>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#f8f4ef]/90 backdrop-blur-md border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <YardScoreLogo className="h-8 w-auto" />
          <div className="flex items-center gap-6">
            <a href="#vision" className="text-sm font-medium text-gray-600 hover:text-[#2d6a4f] transition-colors hidden sm:block">Vision</a>
            <a href="#ecosystem" className="text-sm font-medium text-gray-600 hover:text-[#2d6a4f] transition-colors hidden sm:block">Ecosystem</a>
            <a href="#early-access" className="text-sm font-semibold text-white bg-[#2d6a4f] hover:bg-[#1b4332] px-4 py-2 rounded-lg transition-colors">Early Access</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#f8f4ef] overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-sm font-semibold text-[#52b788] uppercase tracking-widest mb-4">The intelligence layer for living landscapes</p>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#2d6a4f] leading-[1.1] tracking-tight">
                Know what your land can become.
              </h1>
              <p className="mt-6 text-lg text-gray-700 leading-relaxed max-w-xl">
                Most people know the price of land. Very few know its potential. YardScore turns observations into ecological intelligence — helping you understand, improve, and steward any property.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#early-access" className="inline-flex items-center px-7 py-3.5 rounded-lg bg-[#2d6a4f] text-white font-semibold text-sm hover:bg-[#1b4332] transition-colors shadow-lg shadow-[#2d6a4f]/20">
                  Request Early Access
                </a>
                <a href="#vision" className="inline-flex items-center px-7 py-3.5 rounded-lg border-2 border-[#2d6a4f] text-[#2d6a4f] font-semibold text-sm hover:bg-[#2d6a4f] hover:text-white transition-colors">
                  See the Vision
                </a>
              </div>
            </div>
            {/* 4-phone mockup image */}
            <div className="flex justify-center lg:justify-end">
              <Image
                src="/images/yardscore-mobile-app-mockups.jpg"
                alt="YardScore app — Scan, Observe, Score, Map"
                width={800}
                height={500}
                className="rounded-2xl shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Product Vision — Hero + Roadmap ──────────────────────────────── */}
      <section id="vision" className="bg-[#1a3328]">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <p className="text-sm font-semibold text-[#52b788] uppercase tracking-widest text-center mb-4">Product Vision</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            From scan to spatial intelligence
          </h2>
          <p className="text-white/50 text-center max-w-2xl mx-auto mb-16">
            YardScore evolves with every observation. Here&apos;s where we&apos;re headed — and what&apos;s live today.
          </p>

          {/* Hero: ui1 phone frame — what's real right now */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="flex justify-center">
              <div className="relative max-w-[300px]">
                <Image
                  src="/images/ui1-phone.png"
                  alt="YardScore scanning a yard — live today"
                  width={600}
                  height={1200}
                  className="w-full h-auto rounded-[2rem] shadow-2xl shadow-black/50"
                  priority
                />
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                  Live now
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-4">Release 1 — Scan &amp; Count</h3>
              <p className="text-white/60 leading-relaxed mb-6">
                Point your phone at your yard and walk. YardScore detects trees, shrubs, and ground cover in real time — counting what it sees, scoring your property, and giving you actionable insights. No setup, no forms. Just walk and point.
              </p>
              <ul className="space-y-3 text-sm">
                {["Real-time tree detection and counting", "Size classification (large, medium, small)", "Ecological score with evidence", "GPS-located entity tracking", "Satellite map with draggable markers", "Training data captured with every scan"].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-white/70">
                    <span className="text-green-400 mt-0.5">&#10003;</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Roadmap: ui2, ui3, ui4 as future releases */}
          <div className="border-t border-white/10 pt-16">
            <h3 className="text-lg font-semibold text-white/40 uppercase tracking-widest text-center mb-12">What&apos;s Next</h3>
            <div className="grid sm:grid-cols-3 gap-8">
              {[
                {
                  img: "/images/ui2.png",
                  release: "Release 2",
                  label: "Species & Insights",
                  desc: "Identify keystone species. Flag invasives. Get narrative ecological insights. Know your Oaks from your Tulip Poplars.",
                  status: "Coming soon",
                  statusColor: "bg-yellow-500",
                  features: ["Species identification", "Invasive detection", "Keystone species flagging", "Narrative scoring"],
                },
                {
                  img: "/images/ui3.png",
                  release: "Release 3",
                  label: "Inspect & Detail",
                  desc: "Tap any plant for health, size, and native status. A beauty shot of your property — data overlay as aesthetic.",
                  status: "In development",
                  statusColor: "bg-blue-500",
                  features: ["Plant detail cards", "Health assessment", "Before/after views", "Shareable property portrait"],
                },
                {
                  img: "/images/ui4.png",
                  release: "Release 4",
                  label: "Full Property Intelligence",
                  desc: "Soil, moisture, elevation, boundaries, measurements. The complete digital twin of your land.",
                  status: "Vision",
                  statusColor: "bg-purple-500",
                  features: ["Property boundary mapping", "Soil & moisture analysis", "Area measurements", "Improvement planning"],
                },
              ].map((phase) => (
                <div key={phase.label} className="group">
                  <div className="rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-[#52b788]/30 transition-colors mb-4 bg-black aspect-[9/16] relative">
                    <Image
                      src={phase.img}
                      alt={phase.label}
                      width={400}
                      height={711}
                      className="w-full h-full object-cover object-top opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${phase.statusColor}`} />
                        <span className="text-white/50 text-xs font-medium">{phase.status}</span>
                      </div>
                      <p className="text-white/30 text-[10px] uppercase tracking-widest">{phase.release}</p>
                      <h4 className="text-white font-semibold text-sm">{phase.label}</h4>
                    </div>
                  </div>
                  <p className="text-white/50 text-xs leading-relaxed mb-3">{phase.desc}</p>
                  <ul className="space-y-1">
                    {phase.features.map((f) => (
                      <li key={f} className="text-white/30 text-[11px] flex items-center gap-1.5">
                        <span className="text-white/20">&#8226;</span> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Value Prop Bar ────────────────────────────────────────────────── */}
      <section className="bg-[#2d6a4f]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { q: "What's ecologically strong here?" },
              { q: "What improvements matter most?" },
              { q: "What early steps increase value?" },
              { q: "How does this site compare nearby?" },
            ].map((item) => (
              <p key={item.q} className="text-white/80 text-xs sm:text-sm font-medium">
                <span className="text-[#52b788] mr-1">&#10003;</span> {item.q}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feature Tiles (Ecology / Property Potential / Stewardship) ──── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                title: "Ecology",
                color: "bg-[#2d6a4f]",
                items: ["Native Plants", "Habitat Signals", "Tree Canopy", "Biodiversity"],
              },
              {
                title: "Property Potential",
                color: "bg-[#52b788]",
                items: ["Improvement Ideas", "Location Insights", "Early Value Steps", "Site Comparison"],
              },
              {
                title: "Stewardship",
                color: "bg-[#40916c]",
                items: ["Track Observations", "Plan & Improve", "Measure Progress", "Seasonal Memory"],
              },
            ].map((tile) => (
              <div key={tile.title} className={`${tile.color} rounded-2xl p-6 sm:p-8 text-white`}>
                <h3 className="text-xl font-bold mb-4">{tile.title}</h3>
                <ul className="space-y-2">
                  {tile.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-white/80">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/50 flex-none" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="bg-[#e8f5ee]">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2d6a4f] text-center mb-16">
            How YardScore Works
          </h2>
          <div className="grid sm:grid-cols-4 gap-8 sm:gap-4">
            {[
              { step: "Observe", desc: "Study the site", icon: "🔍" },
              { step: "Interpret", desc: "Gain insights", icon: "🧠" },
              { step: "Plan", desc: "Make a plan", icon: "📋" },
              { step: "Track", desc: "See progress", icon: "📈" },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {i < 3 && (
                  <div className="hidden sm:block absolute top-6 -right-2 translate-x-1/2 text-[#52b788] text-2xl font-bold select-none pointer-events-none">
                    &rarr;
                  </div>
                )}
                <div className="w-14 h-14 rounded-full bg-white shadow-md text-2xl flex items-center justify-center mx-auto mb-3">
                  {item.icon}
                </div>
                <h3 className="text-base font-semibold text-[#2d6a4f] mb-1">{item.step}</h3>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ecosystem Audience ────────────────────────────────────────────── */}
      <section id="ecosystem" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2d6a4f] text-center mb-4">
            Built for people who think beyond curb appeal
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            From backyards to broader landscapes, YardScore helps you see the potential of any piece of land.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { role: "Homeowners", emoji: "🏠" },
              { role: "Gardeners", emoji: "🌻" },
              { role: "Arborists", emoji: "🌲" },
              { role: "Realtors", emoji: "🏡" },
              { role: "Nurseries", emoji: "🌿" },
              { role: "Land Stewards", emoji: "🗺️" },
            ].map((p) => (
              <div key={p.role} className="bg-[#f8f4ef] rounded-xl p-4 text-center border border-gray-100 hover:border-[#52b788] transition-colors">
                <span className="text-2xl">{p.emoji}</span>
                <p className="text-xs font-semibold text-gray-700 mt-2">{p.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Small Property. Bigger Picture. ───────────────────────────────── */}
      <section className="bg-[#f8f4ef]">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#2d6a4f] mb-6">
            Small Property. Bigger Picture.
          </h2>
          <p className="text-gray-700 text-lg leading-relaxed max-w-2xl mx-auto">
            From backyards to broader landscapes, YardScore helps you see the ecological potential of any piece of land. Scan it. Score it. Improve it. Track it over time.
          </p>
        </div>
      </section>

      {/* ── Early Access CTA ──────────────────────────────────────────────── */}
      <section id="early-access" className="bg-[#2d6a4f]">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Get early access to YardScore
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
            Be among the first to scan your yard and see its ecological potential.
          </p>
          <div className="flex justify-center">
            <EarlyAccessForm variant="dark" />
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#1a3328]">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-white/80 font-semibold text-sm">YardScore by DrewHenry</p>
              <p className="text-white/40 text-xs mt-1">Observation &rarr; Intelligence</p>
            </div>
            <div className="flex gap-6 text-white/40 text-xs">
              <a href="https://drewhenry.com" className="hover:text-white/70 transition-colors">DrewHenry.com</a>
              <a href="/dashboard" className="hover:text-white/70 transition-colors">Dashboard</a>
              <a href="/map" className="hover:text-white/70 transition-colors">Map</a>
            </div>
          </div>
          <p className="text-white/20 text-xs text-center mt-6">
            &copy; 2026 DrewHenry. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}

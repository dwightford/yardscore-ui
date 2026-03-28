import EarlyAccessForm from "./components/EarlyAccessForm";

/* ── Inline SVG Icons ────────────────────────────────────────────────────── */

function IconLeaf({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z" />
      <path d="M12 10v6" /><path d="M9 13h6" />
    </svg>
  );
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m14.5-6.5-1.4 1.4M7.9 16.1l-1.4 1.4m12-1.4-1.4-1.4M7.9 7.9 6.5 6.5" />
    </svg>
  );
}

/* ── YardScore SVG Logo ──────────────────────────────────────────────────── */

function YardScoreLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 44" fill="none" role="img" aria-label="YardScore" className={className}>
      <rect width="44" height="44" rx="9" fill="#2d6a4f" />
      <path d="M14 11 L22 21 L30 11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="22" y1="21" x2="22" y2="29" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="13" y1="33" x2="31" y2="33" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinecap="round" />
      <text x="56" y="22" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fontSize="18" fontWeight="600" letterSpacing="-0.4" fill="white">YardScore</text>
      <text x="56" y="36" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif" fontSize="8" fontWeight="500" letterSpacing="2" fill="rgba(255,255,255,0.35)">OBSERVATION → INTELLIGENCE</text>
    </svg>
  );
}

/* ── Landing Page ─────────────────────────────────────────────────────────── */

export default function EcoEntryPage() {
  return (
    <>
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-[#0d1f17]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <YardScoreLogo className="h-9 w-auto" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#vision" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Vision</a>
            <a href="#product" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Product</a>
            <a href="#who" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Who It&apos;s For</a>
            <a href="#early-access" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Early Access</a>
          </div>
          <a href="#early-access" className="text-sm font-semibold text-[#0d1f17] bg-[#86efac] hover:bg-[#a7f3d0] px-5 py-2.5 rounded-full transition-colors">
            Request Access
          </a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative bg-[#0d1f17] overflow-hidden">
        {/* Subtle radial glow */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(ellipse_at_center,_rgba(134,239,172,0.06)_0%,_transparent_70%)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 pt-20 pb-8 sm:pt-28 sm:pb-12">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            {/* Left: Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 mb-8">
                <span className="text-xs font-semibold text-[#86efac] uppercase tracking-widest">
                  The intelligence layer for living landscapes
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-[1.08] tracking-tight">
                See what your land is telling you.
              </h1>
              <p className="mt-6 text-lg text-white/60 leading-relaxed">
                YardScore turns scans, sightings, and site context into ecological intelligence.
                Walk a property with your phone, map what is there, surface what matters,
                and understand what the land can become.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <a href="#early-access" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#86efac] text-[#0d1f17] font-semibold text-sm hover:bg-[#a7f3d0] transition-colors shadow-lg shadow-[#86efac]/10">
                  Request Early Access <span aria-hidden>&rarr;</span>
                </a>
                <a href="#vision" className="inline-flex items-center px-7 py-3.5 rounded-full border border-white/20 text-white/80 font-semibold text-sm hover:border-white/40 hover:text-white transition-colors">
                  See a Sample Scan
                </a>
              </div>

              {/* Proof cards */}
              <div className="mt-14 grid grid-cols-3 gap-4">
                {[
                  { val: "15", label: "trees recognized in a single walk" },
                  { val: "85", label: "example resilience score with evidence" },
                  { val: "4", label: "product releases from scan to full intelligence" },
                ].map((s) => (
                  <div key={s.val} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
                    <p className="text-2xl font-bold text-white">{s.val}</p>
                    <p className="text-[11px] text-white/40 mt-1.5 leading-snug">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Constructed hero visual */}
            <div className="hidden lg:block relative">
              {/* Glow dots */}
              <div className="absolute top-8 right-8 w-3 h-3 rounded-full bg-[#86efac]/30 blur-sm" />
              <div className="absolute bottom-32 left-4 w-2 h-2 rounded-full bg-[#86efac]/20 blur-sm" />

              {/* Live Property Signals card */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 mb-4">
                <p className="text-[10px] font-semibold text-[#86efac] uppercase tracking-widest mb-2">Live Property Signals</p>
                <p className="text-white font-semibold text-lg mb-1">Ecological score for the site</p>
                <p className="text-white/40 text-xs leading-relaxed">
                  Not just detection. The scanner reads the land, identifies habitat structure,
                  and turns field observations into usable property intelligence.
                </p>
              </div>

              {/* Phone mockup — constructed, not a screenshot */}
              <div className="relative mx-auto max-w-[280px]">
                <div className="rounded-[2rem] border-2 border-white/10 bg-[#111a14] p-5 shadow-2xl shadow-black/40">
                  {/* Phone header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <IconLeaf className="w-4 h-4 text-[#86efac]" />
                      <span className="text-white text-xs font-semibold">YardScore</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#86efac]" />
                      <span className="text-[10px] text-white/50">Live</span>
                    </div>
                  </div>
                  {/* Score */}
                  <div className="text-center border border-white/10 rounded-xl py-5 mb-4 bg-white/[0.02]">
                    <p className="text-[9px] font-semibold text-[#86efac] uppercase tracking-widest mb-1">Property Score</p>
                    <p className="text-5xl font-bold text-white">85</p>
                    <p className="text-xs text-white/50 mt-1">Resilient landscape</p>
                  </div>
                  {/* Metric grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Tree canopy", val: "+18", color: "text-[#86efac]" },
                      { label: "Native habitat", val: "+12", color: "text-[#86efac]" },
                      { label: "Invasive pressure", val: "-6", color: "text-red-400" },
                      { label: "Moisture opportunity", val: "+4", color: "text-[#86efac]" },
                    ].map((m) => (
                      <div key={m.label} className="border border-white/10 rounded-lg p-2.5 bg-white/[0.02]">
                        <p className="text-[10px] text-white/40">{m.label}</p>
                        <p className={`text-sm font-bold ${m.color}`}>{m.val}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Signal cards beside phone */}
              <div className="absolute right-0 top-[55%] space-y-2 max-w-[200px]">
                {[
                  { title: "Habitat signal", desc: "Edge corridor + pollinator activity" },
                  { title: "Canopy cluster", desc: "6 mature trees detected nearby" },
                  { title: "Improvement", desc: "Add understory along sunny edge" },
                ].map((s) => (
                  <div key={s.title} className="rounded-xl border border-white/10 bg-[#0d1f17]/90 backdrop-blur-sm px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-white">{s.title}</p>
                      <span className="text-white/30 text-xs">&rarr;</span>
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Credential strip */}
        <div className="max-w-7xl mx-auto px-6 pb-16 sm:pb-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
            {[
              { title: "Release 1", desc: "Scan, count, score, and map property observations" },
              { title: "Field first", desc: "Built around walking the land, not filling out forms" },
              { title: "Evidence based", desc: "Scores are tied to visible signals and map context" },
              { title: "Platform path", desc: "Designed to grow into full property intelligence" },
            ].map((c) => (
              <div key={c.title} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-semibold text-white mb-1">{c.title}</p>
                <p className="text-[11px] text-white/40 leading-snug">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Vision — Release Grid ────────────────────────────────── */}
      <section id="vision" className="bg-[#0f231a]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-[#86efac] uppercase tracking-widest">Product Vision</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            From scan to spatial intelligence
          </h2>
          <p className="text-white/50 max-w-2xl mb-14 leading-relaxed">
            Start with what is usable now, then show a believable path toward species insight,
            inspectable details, and a full digital twin of the property.
          </p>

          {/* 2x2 Release grid */}
          <div className="grid sm:grid-cols-2 gap-6">
            {[
              {
                status: "Live now", statusColor: "bg-[#86efac] text-[#0d1f17]",
                release: "Release 1", title: "Scan & Count",
                desc: "Walk a property with your phone. YardScore detects visible vegetation, places observations on the map, and produces an ecological score with evidence.",
                features: ["Real-time tree and shrub detection", "Size classification", "Ecological score with evidence", "GPS-located observations"],
              },
              {
                status: "Coming soon", statusColor: "bg-yellow-400/90 text-[#0d1f17]",
                release: "Release 2", title: "Species & Insights",
                desc: "Move from counting what is present to understanding what matters: keystone species, invasives, and narrative site insights.",
                features: ["Species identification", "Invasive detection", "Keystone signals", "Narrative ecological summaries"],
              },
              {
                status: "In development", statusColor: "bg-blue-400/90 text-[#0d1f17]",
                release: "Release 3", title: "Inspect & Detail",
                desc: "Tap into individual plants and habitat features for health, native status, before-and-after comparisons, and shareable property portraits.",
                features: ["Plant detail cards", "Health assessment", "Before / after views", "Shareable reports"],
              },
              {
                status: "Vision", statusColor: "bg-purple-400/90 text-[#0d1f17]",
                release: "Release 4", title: "Full Property Intelligence",
                desc: "Unify boundaries, moisture, canopy, habitat, and improvement planning into a living digital twin of the land.",
                features: ["Boundary mapping", "Soil and moisture analysis", "Improvement planning", "Change over time"],
              },
            ].map((r) => (
              <div key={r.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
                <div className="flex items-center justify-between mb-5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${r.statusColor}`}>
                    {r.status}
                  </span>
                  <IconSparkle className="w-5 h-5 text-white/15" />
                </div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {r.release} &mdash; {r.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed mb-5">{r.desc}</p>
                <div className="grid grid-cols-2 gap-2">
                  {r.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2">
                      <span className="text-[#86efac] text-xs">&#10003;</span>
                      <span className="text-white/60 text-xs">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="bg-[#0d1f17]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-[#86efac] uppercase tracking-widest">How It Works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Observe. Interpret. Plan. Track.
          </h2>
          <p className="text-white/50 max-w-2xl mb-14 leading-relaxed">
            The operational loop is strong once you see the sequence. Walk the land, turn signals
            into meaning, decide what matters, and build memory over time.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: "01", title: "Observe",
                desc: "Walk the property with your phone and capture the living signals already present.",
                icon: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7Z",
              },
              {
                step: "02", title: "Interpret",
                desc: "Turn images and location data into counts, classifications, and ecological meaning.",
                icon: "M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.3 24.3 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 0 1-1.59.66H9.06a2.25 2.25 0 0 1-1.591-.659L5 14.5m14 0V5.846a2.25 2.25 0 0 0-1.883-2.22",
              },
              {
                step: "03", title: "Plan",
                desc: "See what to preserve, what to improve, and which changes matter most first.",
                icon: "M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.4 48.4 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 0 0 2.25 2.25h.75",
              },
              {
                step: "04", title: "Track",
                desc: "Build memory over time so the property becomes more legible season after season.",
                icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#86efac]">
                    <path d={s.icon} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
                <p className="text-white/15 text-xs font-mono mt-4">{s.step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who It's For ─────────────────────────────────────────────────── */}
      <section id="who" className="bg-[#0f231a]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-[#86efac] uppercase tracking-widest">Built For</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            People who think beyond curb appeal
          </h2>
          <p className="text-white/50 max-w-2xl mb-14 leading-relaxed">
            YardScore serves anyone who wants to understand and improve living property &mdash;
            from a single backyard to managed landscapes.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { role: "Homeowners", value: "See what is strong, what is weak, and where simple changes create value.", icon: "M2.25 12l8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" },
              { role: "Gardeners", value: "Scan beds and yard zones to guide planting, habitat, and seasonal decisions.", icon: "M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" },
              { role: "Arborists", value: "Capture canopy, context, and inventory data directly from the field.", icon: "M6.429 6.429A9 9 0 1 0 21 12a9 9 0 0 0-2.021-5.571M6.429 6.429 12 12m-5.571-5.571L3 3" },
              { role: "Realtors", value: "Turn outdoor potential into visible, differentiated property intelligence.", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
              { role: "Nurseries", value: "Connect what is in the aisle or on the lot to an interpretable inventory layer.", icon: "M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" },
              { role: "Land Stewards", value: "Track restoration, habitat health, and improvement over time.", icon: "M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934a1.12 1.12 0 0 1-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934a1.12 1.12 0 0 1 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" },
            ].map((p) => (
              <div key={p.role} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center mb-4">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-[#86efac]">
                    <path d={p.icon} />
                  </svg>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{p.role}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{p.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value — Small Property. Bigger Picture. ──────────────────────── */}
      <section id="product" className="bg-[#0d1f17]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            {/* Left: Copy + question cards */}
            <div>
              <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 mb-6">
                <span className="text-xs font-semibold text-[#86efac] uppercase tracking-widest">Value</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Small property. Bigger picture.
              </h2>
              <p className="text-white/50 leading-relaxed mb-10">
                The product is not just about identifying what is in frame. It is about helping people
                understand ecological strength, improvement opportunity, and change over time.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {[
                  "What is ecologically strong here?",
                  "What improvements matter most?",
                  "Which early steps add value?",
                  "How does this property compare nearby?",
                  "What should I preserve first?",
                  "What changed since last season?",
                ].map((q) => (
                  <div key={q} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-start gap-2">
                    <span className="text-[#86efac] text-xs mt-0.5 flex-none">&#10003;</span>
                    <span className="text-white/60 text-xs leading-snug">{q}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Category cards */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Ecology", items: ["Native plants", "Habitat signals", "Tree canopy", "Biodiversity"] },
                { title: "Property potential", items: ["Improvement ideas", "Location insights", "Early value steps", "Site comparison"] },
                { title: "Stewardship", items: ["Track observations", "Plan and improve", "Measure progress", "Seasonal memory"] },
                { title: "Platform path", items: ["Phone capture", "Map context", "Field memory", "Digital twin"] },
              ].map((cat) => (
                <div key={cat.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <h3 className="text-sm font-bold text-white mb-3">{cat.title}</h3>
                  <ul className="space-y-2">
                    {cat.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-white/50 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#86efac]/60 flex-none" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Early Access CTA ──────────────────────────────────────────────── */}
      <section id="early-access" className="bg-[#0f231a]">
        <div className="max-w-7xl mx-auto px-6 py-20 sm:py-28">
          <div className="rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top_left,_rgba(134,239,172,0.04)_0%,_transparent_50%)] p-10 sm:p-14">
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Left: Copy */}
              <div>
                <div className="inline-flex items-center rounded-full bg-white/[0.06] border border-white/10 px-4 py-1.5 mb-6">
                  <span className="text-xs font-semibold text-[#86efac] uppercase tracking-widest">Get Early Access</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">
                  Be among the first to scan your yard and see its ecological potential.
                </h2>
                <p className="text-white/40 text-sm leading-relaxed mt-4">
                  This mockup pushes the page toward a stronger product story: less detached app screenshot,
                  more living landscape intelligence.
                </p>
              </div>

              {/* Right: Form */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
                <EarlyAccessForm variant="dark" />
                <p className="text-white/30 text-xs mt-5 leading-relaxed">
                  Early access for homeowners, gardeners, arborists, nurseries, and land-focused teams.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="bg-[#091610] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/60 font-semibold text-sm">
              YardScore <span className="font-normal text-white/30">by DrewHenry</span>
            </p>
            <p className="text-white/30 text-sm">Observation &rarr; Intelligence</p>
          </div>
          <p className="text-white/15 text-xs text-center mt-6">
            &copy; 2026 DrewHenry. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}

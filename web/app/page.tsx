"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  MapPinned,
  ScanLine,
  Sprout,
  Trees,
  Waves,
  ShieldCheck,
  Home,
  Flower2,
  Building2,
  Tractor,
  BarChart3,
  Sparkles,
  CheckCircle2,
  Radar,
} from "lucide-react";
import EarlyAccessForm from "./components/EarlyAccessForm";

/* ── Data ────────────────────────────────────────────────────────────────── */

const releases = [
  {
    phase: "Live now",
    title: "Release 1 — Scan & Count",
    description:
      "Walk a property with your phone. YardScore detects visible vegetation, places observations on the map, and produces an ecological score with evidence.",
    bullets: [
      "Real-time tree and shrub detection",
      "Size classification",
      "Ecological score with evidence",
      "GPS-located observations",
    ],
  },
  {
    phase: "Coming soon",
    title: "Release 2 — Species & Insights",
    description:
      "Move from counting what is present to understanding what matters: keystone species, invasives, and narrative site insights.",
    bullets: [
      "Species identification",
      "Invasive detection",
      "Keystone signals",
      "Narrative ecological summaries",
    ],
  },
  {
    phase: "In development",
    title: "Release 3 — Inspect & Detail",
    description:
      "Tap into individual plants and habitat features for health, native status, before-and-after comparisons, and shareable property portraits.",
    bullets: [
      "Plant detail cards",
      "Health assessment",
      "Before / after views",
      "Shareable reports",
    ],
  },
  {
    phase: "Vision",
    title: "Release 4 — Full Property Intelligence",
    description:
      "Unify boundaries, moisture, canopy, habitat, and improvement planning into a living digital twin of the land.",
    bullets: [
      "Boundary mapping",
      "Soil and moisture analysis",
      "Improvement planning",
      "Change over time",
    ],
  },
];

const audiences = [
  { icon: Home, title: "Homeowners", text: "See what is strong, what is weak, and where simple changes create value." },
  { icon: Flower2, title: "Gardeners", text: "Scan beds and yard zones to guide planting, habitat, and seasonal decisions." },
  { icon: Trees, title: "Arborists", text: "Capture canopy, context, and inventory data directly from the field." },
  { icon: Building2, title: "Realtors", text: "Turn outdoor potential into visible, differentiated property intelligence." },
  { icon: Tractor, title: "Nurseries", text: "Connect what is in the aisle or on the lot to an interpretable inventory layer." },
  { icon: ShieldCheck, title: "Land Stewards", text: "Track restoration, habitat health, and improvement over time." },
];

const signals = [
  { label: "Tree canopy", value: "+18" },
  { label: "Native habitat", value: "+12" },
  { label: "Invasive pressure", value: "-6" },
  { label: "Moisture opportunity", value: "+4" },
];

const steps = [
  {
    icon: Camera,
    title: "Observe",
    text: "Walk the property with your phone and capture the living signals already present.",
  },
  {
    icon: ScanLine,
    title: "Interpret",
    text: "Turn images and location data into counts, classifications, and ecological meaning.",
  },
  {
    icon: MapPinned,
    title: "Plan",
    text: "See what to preserve, what to improve, and which changes matter most first.",
  },
  {
    icon: BarChart3,
    title: "Track",
    text: "Build memory over time so the property becomes more legible season after season.",
  },
];

/* ── Shared Components ───────────────────────────────────────────────────── */

function SectionTitle({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="max-w-3xl">
      <div className="mb-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-emerald-200/80">
        {eyebrow}
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h2>
      <p className="mt-5 text-base leading-7 text-zinc-300 sm:text-lg">{body}</p>
    </div>
  );
}

function GlowNode({ className }: { className: string }) {
  return (
    <div className={`absolute h-4 w-4 rounded-full bg-lime-200 shadow-[0_0_40px_14px_rgba(190,242,100,0.45)] ${className}`}>
      <div className="absolute inset-[-8px] rounded-full border border-lime-200/40" />
    </div>
  );
}

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[300px] rounded-[2.8rem] border border-white/10 bg-zinc-950/90 p-3 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="absolute left-1/2 top-3 h-6 w-28 -translate-x-1/2 rounded-full bg-zinc-900" />
      <div className="overflow-hidden rounded-[2.2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(88,140,118,0.30),transparent_45%),linear-gradient(180deg,#08110c_0%,#0b1711_42%,#112219_100%)] p-4 pt-10">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2 font-medium text-zinc-200">
            <Sprout className="h-4 w-4 text-lime-300" />
            YardScore
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <div className="h-2 w-2 rounded-full bg-lime-300" />
            Live
          </div>
        </div>

        <div className="mt-5 rounded-[1.8rem] border border-lime-200/20 bg-lime-100/5 p-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <div className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">Property score</div>
          <div className="mt-2 text-6xl font-semibold tracking-tight text-white">85</div>
          <div className="mt-1 text-sm text-zinc-300">Resilient landscape</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-xs">
            {signals.map((signal) => (
              <div key={signal.label} className="rounded-2xl border border-white/[0.08] bg-white/5 px-3 py-2">
                <div className="text-zinc-400">{signal.label}</div>
                <div className="mt-1 font-medium text-lime-200">{signal.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[
            ["Habitat signal", "Edge corridor + pollinator activity"],
            ["Canopy cluster", "6 mature trees detected nearby"],
            ["Improvement", "Add understory layer along sunny edge"],
          ].map(([title, subtitle]) => (
            <div key={title} className="flex items-start justify-between rounded-2xl border border-white/[0.08] bg-white/[0.06] px-4 py-3">
              <div>
                <div className="text-sm font-medium text-white">{title}</div>
                <div className="mt-1 text-xs leading-5 text-zinc-400">{subtitle}</div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 text-zinc-500" />
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          {[
            ["15", "Trees"],
            ["09", "Signals"],
            ["99%", "Scan path"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-white/[0.08] bg-emerald-400/[0.08] px-3 py-3">
              <div className="font-semibold text-white">{value}</div>
              <div className="mt-1 text-zinc-400">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniPreviewCard({ title, body, icon: Icon }: { title: string; body: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/10 backdrop-blur-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-lime-200">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p>
    </div>
  );
}

/* ── Landing Page ─────────────────────────────────────────────────────────── */

export default function EcoEntryPage() {
  return (
    <div className="min-h-screen bg-[#07110c] text-white">
      {/* ── Hero wrapper with gradients ──────────────────────────────────── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(167,243,208,0.14),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(190,242,100,0.16),transparent_22%),radial-gradient(circle_at_bottom,rgba(20,83,45,0.38),transparent_44%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:80px_80px]" />

        {/* ── Nav ────────────────────────────────────────────────────────── */}
        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
              <Sprout className="h-5 w-5 text-lime-300" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">YardScore</div>
              <div className="text-xs uppercase tracking-[0.24em] text-zinc-400">Observation → Intelligence</div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-zinc-300 md:flex">
            <a href="#vision" className="transition hover:text-white">Vision</a>
            <a href="#how" className="transition hover:text-white">How It Works</a>
            <a href="#audiences" className="transition hover:text-white">Built For</a>
            <a href="#value" className="transition hover:text-white">Value</a>
          </nav>

          {/* Mobile: sign in + request access */}
          <div className="flex items-center gap-3 md:hidden">
            <a href="/login" className="text-sm text-zinc-300 transition hover:text-white">Sign In</a>
            <a href="#access" className="rounded-full border border-lime-300/30 bg-lime-300/10 px-4 py-2 text-xs font-medium text-lime-100">
              Access
            </a>
          </div>

          {/* Desktop: full nav + sign in */}
          <div className="hidden items-center gap-4 md:flex">
            <a href="/login" className="text-sm text-zinc-300 transition hover:text-white">Sign In</a>
            <a href="#access" className="rounded-full border border-lime-300/30 bg-lime-300/10 px-5 py-2.5 text-sm font-medium text-lime-100 transition hover:bg-lime-300/20">
              Request Access
            </a>
          </div>
        </header>

        {/* ── Section 1: Hero ────────────────────────────────────────────── */}
        <section className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:pb-32 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-3xl"
          >
            <div className="inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-lime-100/90">
              The intelligence layer for living landscapes
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
              See what your land is telling you.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
              YardScore turns scans, sightings, and site context into ecological intelligence. Walk a property with your phone,
              map what is there, surface what matters, and understand what the land can become.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <a href="#access" className="group inline-flex items-center justify-center rounded-full bg-lime-300 px-6 py-3.5 text-sm font-semibold text-zinc-950 transition hover:scale-[1.01]">
                Request Early Access
                <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <a href="#vision" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/10">
                See a Sample Scan
              </a>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-3xl font-semibold text-white">15</div>
                <div className="mt-2 text-sm text-zinc-400">trees recognized in a single walk</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-3xl font-semibold text-white">85</div>
                <div className="mt-2 text-sm text-zinc-400">example resilience score with evidence</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <div className="text-3xl font-semibold text-white">4</div>
                <div className="mt-2 text-sm text-zinc-400">product releases from scan to full intelligence</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.12 }}
            className="relative hidden min-h-[640px] lg:block"
          >
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(173,255,47,0.14),transparent_24%),linear-gradient(180deg,rgba(10,22,14,0.1),rgba(4,10,7,0.78))]" />
            <div className="absolute inset-x-6 bottom-6 top-6 rounded-[2.4rem] bg-[radial-gradient(circle_at_50%_40%,rgba(163,230,53,0.08),transparent_15%),radial-gradient(circle_at_15%_70%,rgba(190,242,100,0.14),transparent_16%),radial-gradient(circle_at_80%_25%,rgba(74,222,128,0.12),transparent_18%),linear-gradient(180deg,rgba(14,28,18,0.55),rgba(10,18,13,0.85))] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
              <div className="absolute inset-0 opacity-80">
                <div className="absolute left-[12%] top-[30%] h-px w-[30%] rotate-[12deg] bg-lime-200/60" />
                <div className="absolute left-[21%] top-[46%] h-px w-[48%] -rotate-[7deg] bg-lime-200/45" />
                <div className="absolute left-[8%] top-[63%] h-px w-[60%] rotate-[8deg] bg-lime-200/45" />
                <div className="absolute left-[48%] top-[54%] h-px w-[32%] rotate-[18deg] bg-lime-200/40" />
                <div className="absolute left-[40%] top-[28%] h-px w-[35%] -rotate-[12deg] bg-lime-200/30" />
              </div>

              <GlowNode className="left-[12%] top-[62%]" />
              <GlowNode className="left-[26%] top-[34%]" />
              <GlowNode className="left-[56%] top-[72%]" />
              <GlowNode className="left-[74%] top-[48%]" />
              <GlowNode className="left-[84%] top-[66%]" />

              <div className="absolute left-8 top-10 max-w-[220px] rounded-3xl border border-white/10 bg-[#0d1712]/85 p-5 backdrop-blur-md">
                <div className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">Live property signals</div>
                <div className="mt-3 text-lg font-medium text-white">Ecological context in the field</div>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Not just a pretty mockup. The scene itself becomes the interface: canopy, habitat, risk, and next steps.
                </p>
              </div>

              <div className="absolute bottom-8 left-8 hidden max-w-[240px] rounded-3xl border border-white/10 bg-[#0d1712]/85 p-5 backdrop-blur-md md:block">
                <div className="flex items-center gap-3 text-white">
                  <Radar className="h-5 w-5 text-lime-300" />
                  <span className="font-medium">Observation network</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-300">
                  Phones, maps, imagery, and field context combine into a usable score instead of a pile of disconnected data.
                </p>
              </div>

              <div className="absolute inset-x-0 top-[18%] flex justify-center">
                <PhoneMockup />
              </div>
            </div>
          </motion.div>
        </section>
      </div>

      {/* ── Section 2: Credential Strip ──────────────────────────────────── */}
      <section className="border-y border-white/[0.08] bg-black/20">
        <div className="mx-auto grid max-w-7xl gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {[
            ["Release 1", "Scan, count, score, and map property observations"],
            ["Field first", "Built around walking the land, not filling out forms"],
            ["Evidence based", "Scores are tied to visible signals and map context"],
            ["Platform path", "Designed to grow into full property intelligence"],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4">
              <div className="text-sm font-medium text-white">{title}</div>
              <div className="mt-1 text-sm text-zinc-400">{text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 3: Product Vision ────────────────────────────────────── */}
      <section id="vision" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <SectionTitle
          eyebrow="Product vision"
          title="From scan to spatial intelligence"
          body="Start with what is usable now, then show a believable path toward species insight, inspectable details, and a full digital twin of the property."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {releases.map((release, index) => (
            <motion.div
              key={release.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-120px" }}
              transition={{ duration: 0.45, delay: index * 0.06 }}
              className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-7 shadow-2xl shadow-black/10"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-lime-100">
                  {release.phase}
                </span>
                <Sparkles className="h-5 w-5 text-lime-300/70" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-white">{release.title}</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-300">{release.description}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {release.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Why This Version Works ────────────────────────────── */}
      <section id="why" className="bg-[linear-gradient(180deg,rgba(5,12,9,0),rgba(12,30,20,0.6),rgba(5,12,9,0))]">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <SectionTitle
                eyebrow="Why this version works"
                title="Make the product thesis visible above the fold"
                body="The hero should immediately show the central idea: the land is being interpreted. That means a real environment, a phone anchored in the scene, and subtle signal overlays that make ecological intelligence feel tangible."
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <MiniPreviewCard
                icon={Trees}
                title="Landscape-first hero"
                body="Swap the detached app screenshot for a cinematic property scene with visible ecological signals."
              />
              <MiniPreviewCard
                icon={MapPinned}
                title="Proof before poetry"
                body="Move real capabilities closer to the top so the vision has credibility immediately."
              />
              <MiniPreviewCard
                icon={Waves}
                title="Better narrative flow"
                body="Reduce repeated positioning language and let each section do a distinct job."
              />
              <MiniPreviewCard
                icon={ShieldCheck}
                title="Premium, not sci-fi"
                body="Keep the moody ecological atmosphere, but stay grounded enough to feel like a serious product."
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 5: How It Works ──────────────────────────────────────── */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <SectionTitle
          eyebrow="How it works"
          title="Observe. Interpret. Plan. Track."
          body="This is the operational loop beneath the brand. It should read cleanly and quickly, because the product idea is strong once the user sees the sequence."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.4, delay: index * 0.07 }}
                className="relative rounded-[2rem] border border-white/10 bg-white/5 p-7"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-lime-300/20 bg-lime-300/10 text-lime-100">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="mt-5 text-2xl font-semibold text-white">{step.title}</div>
                <p className="mt-3 text-sm leading-7 text-zinc-300">{step.text}</p>
                <div className="mt-8 text-sm text-zinc-500">0{index + 1}</div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* ── Section 6: Built For ─────────────────────────────────────────── */}
      <section id="audiences" className="bg-black/20">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
          <SectionTitle
            eyebrow="Built for"
            title="People who think beyond curb appeal"
            body="YardScore serves anyone who wants to understand and improve living property — from a single backyard to managed landscapes."
          />

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;
              return (
                <motion.div
                  key={audience.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-6"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                    <Icon className="h-6 w-6 text-lime-300" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-white">{audience.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">{audience.text}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section 7: Value ─────────────────────────────────────────────── */}
      <section id="value" className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
          <div>
            <SectionTitle
              eyebrow="Value"
              title="Small property. Bigger picture."
              body="The product is not just about identifying what is in frame. It is about helping people understand ecological strength, improvement opportunity, and change over time."
            />

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {[
                "What is ecologically strong here?",
                "What improvements matter most?",
                "Which early steps add value?",
                "How does this property compare nearby?",
                "What should I preserve first?",
                "What changed since last season?",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/5 px-4 py-4 text-sm text-zinc-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(132,204,22,0.15),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-7">
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Ecology", items: ["Native plants", "Habitat signals", "Tree canopy", "Biodiversity"] },
                { title: "Property potential", items: ["Improvement ideas", "Location insights", "Early value steps", "Site comparison"] },
                { title: "Stewardship", items: ["Track observations", "Plan and improve", "Measure progress", "Seasonal memory"] },
                { title: "Platform path", items: ["Phone capture", "Map context", "Field memory", "Digital twin"] },
              ].map((cat) => (
                <div key={cat.title} className="rounded-3xl border border-white/[0.08] bg-black/20 p-5">
                  <div className="text-lg font-semibold text-white">{cat.title}</div>
                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    {cat.items.map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-lime-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 8: Early Access ──────────────────────────────────────── */}
      <section id="access" className="px-6 pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] border border-lime-300/15 bg-[radial-gradient(circle_at_top,rgba(190,242,100,0.14),transparent_28%),linear-gradient(180deg,rgba(17,24,19,0.95),rgba(9,14,11,0.98))] px-8 py-14 shadow-2xl shadow-black/20 sm:px-12 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-lime-100">
                Get early access
              </div>
              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Be among the first to scan your yard and see its ecological potential.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">
                YardScore is opening early access to homeowners, gardeners, arborists, nurseries, and anyone
                who wants to understand and improve the living landscape around them.
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6 backdrop-blur-sm">
              <EarlyAccessForm variant="dark" />
              <div className="mt-4 text-xs leading-6 text-zinc-500">
                Early access for homeowners, gardeners, arborists, nurseries, and land-focused teams.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.08] px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="font-medium text-zinc-300">YardScore</span> by DrewHenry
          </div>
          <div>Observation → Intelligence</div>
        </div>
      </footer>
    </div>
  );
}

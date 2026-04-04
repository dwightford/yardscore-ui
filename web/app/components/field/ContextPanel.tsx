"use client";

/**
 * ContextPanel
 *
 * A bottom sheet that slides up and changes its content based on
 * whichever action the user selected in the BottomActionRail.
 *
 * States:
 *   walk     → walk session controls (start/end, progress)
 *   identify → "point your camera at a plant" prompt
 *   anchor   → anchor type picker + save
 *   area     → area type picker + save
 *   light    → light direction + condition picker
 *   more     → secondary action grid (reserved)
 *
 * All user-facing language is plain homeowner English.
 * No internal jargon — subject/patch/breadcrumb stay internal.
 */

import React, { useState } from "react";
import type { ActionMode } from "./BottomActionRail";
import type { PlantIdResult } from "@/lib/field-api";

// ── Sub-panel types ───────────────────────────────────────────────────────────

export interface WalkState {
  active: boolean;
  anchorCount: number;
  areaCount: number;
  subjectCount: number;
  startedAt?: Date;
}

export interface ContextPanelProps {
  mode: ActionMode;
  walkState: WalkState;
  onStartWalk: () => void;
  onEndWalk: () => void;
  onSaveAnchor: (type: string, label: string) => void;
  onSaveArea: (type: string, label: string) => void;
  onTagSubject: (type: string, label: string) => void;
  onSaveSubjectAnchor: (subjectType: string, label: string, anchorType: string) => void;
  onSaveLight: (direction: string, condition: string) => void;
  onSaveNote: (category: string, text: string) => void;
  onClose: () => void;
  /** Capture a frame from the live camera for plant ID */
  captureFrame?: () => Promise<Blob | null>;
  /** Called when PlantNet identifies a plant from a captured frame */
  onIdentify?: (result: PlantIdResult) => void;
  /** Navigate to another page from the More panel */
  onNavigate?: (path: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function elapsed(start: Date): string {
  const s = Math.floor((Date.now() - start.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Sub-panels ────────────────────────────────────────────────────────────────

function WalkPanel({ state, onStart, onEnd }: {
  state: WalkState;
  onStart: () => void;
  onEnd: () => void;
}) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!state.active || !state.startedAt) return;
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [state.active, state.startedAt]);

  if (!state.active) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-stone-300 text-sm leading-relaxed">
          Start at your front door. Walk your property naturally — the app will build a map as you move.
        </p>
        <p className="text-stone-500 text-xs">
          You can stop and tag plants, areas, and reference points along the way.
        </p>
        <button
          onClick={onStart}
          className="w-full bg-green-600 hover:bg-green-500 active:scale-95 text-white font-semibold rounded-xl py-3.5 transition"
        >
          Start Walk
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-300 text-sm font-medium">Walk in progress</span>
        </div>
        {state.startedAt && (
          <span className="text-stone-500 text-xs tabular-nums">
            {elapsed(state.startedAt)}
          </span>
        )}
      </div>

      {/* Progress counts */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: state.anchorCount, label: "Reference points" },
          { v: state.subjectCount, label: "Plants noted" },
          { v: state.areaCount, label: "Areas marked" },
        ].map(({ v, label }) => (
          <div key={label} className="bg-white/5 rounded-xl py-2.5">
            <p className="text-2xl font-bold text-white">{v}</p>
            <p className="text-stone-500 text-[10px] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onEnd}
        className="w-full bg-stone-700 hover:bg-stone-600 active:scale-95 text-stone-200 font-semibold rounded-xl py-3 transition"
      >
        Finish Walk
      </button>
    </div>
  );
}

const ORGAN_LABELS: Array<{ key: string; label: string; icon: string }> = [
  { key: "auto",   label: "Whole plant", icon: "🌿" },
  { key: "leaf",   label: "Leaf",        icon: "🍃" },
  { key: "bark",   label: "Bark",        icon: "🪵" },
  { key: "flower", label: "Flower",      icon: "🌸" },
  { key: "fruit",  label: "Fruit/Seed",  icon: "🫐" },
];

function IdentifyPanel({
  onTag,
  onTagAsAnchor,
  captureFrame,
  onIdentify,
}: {
  onTag: (type: string, label: string) => void;
  onTagAsAnchor: (subjectType: string, label: string, anchorType: string) => void;
  captureFrame?: () => Promise<Blob | null>;
  onIdentify?: (result: PlantIdResult) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("tree");
  const [useAsAnchor, setUseAsAnchor] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [idResult, setIdResult] = useState<PlantIdResult | null>(null);
  const [idError, setIdError] = useState<string | null>(null);

  // Multi-shot: stack of captured images
  const [shots, setShots] = useState<Array<{ blob: Blob; organ: string }>>([]);
  const [nextOrgan, setNextOrgan] = useState("auto");

  const handleCapture = async () => {
    if (!captureFrame) return;
    try {
      const blob = await captureFrame();
      if (!blob) return;
      setShots((prev) => [...prev, { blob, organ: nextOrgan }]);
      // Auto-advance organ suggestion
      const usedOrgans = new Set([...shots.map((s) => s.organ), nextOrgan]);
      const next = ORGAN_LABELS.find((o) => !usedOrgans.has(o.key));
      if (next) setNextOrgan(next.key);
    } catch {}
  };

  const handleIdentify = async () => {
    if (shots.length === 0) return;
    setIdentifying(true);
    setIdError(null);
    try {
      const { identifyPlantMulti } = await import("@/lib/field-api");
      const result = await identifyPlantMulti(shots as any);
      if (result) {
        setIdResult(result);
        setLabel(result.commonName || result.scientificName);
        onIdentify?.(result);
      } else {
        setIdError("Could not identify — try different angles");
      }
    } catch {
      setIdError("Identification failed");
    } finally {
      setIdentifying(false);
    }
  };

  const handleSave = () => {
    if (useAsAnchor) {
      const anchorType = type === "tree" ? "big_tree" : "custom";
      onTagAsAnchor(type, label, anchorType);
    } else {
      onTag(type, label);
    }
    setLabel("");
    setIdResult(null);
    setUseAsAnchor(false);
    setShots([]);
    setNextOrgan("auto");
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-400 text-sm leading-relaxed">
        Snap one or more photos — leaf, bark, flower, the whole plant. More angles = better ID.
      </p>

      {/* Capture button + shot counter */}
      {captureFrame && (
        <div className="flex gap-2">
          <button
            onClick={handleCapture}
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white font-semibold rounded-xl py-3 transition"
          >
            {shots.length === 0 ? "Capture" : `Capture (${shots.length})`}
          </button>
          {shots.length > 0 && (
            <button
              onClick={handleIdentify}
              disabled={identifying}
              className="bg-white/10 hover:bg-white/15 active:scale-95 text-white font-medium rounded-xl px-4 py-3 text-sm transition disabled:opacity-50"
            >
              {identifying ? "..." : "Identify"}
            </button>
          )}
        </div>
      )}

      {/* Shot chips — show what's been captured */}
      {shots.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {shots.map((s, i) => {
            const org = ORGAN_LABELS.find((o) => o.key === s.organ);
            return (
              <span
                key={i}
                className="bg-emerald-900/30 border border-emerald-700/30 rounded-full px-2 py-0.5 text-[10px] text-emerald-300 flex items-center gap-1"
              >
                <span>{org?.icon ?? "📷"}</span>
                {org?.label ?? s.organ}
              </span>
            );
          })}
          {shots.length < 5 && (
            <button
              onClick={() => {
                const next = ORGAN_LABELS.find((o) => !shots.some((s) => s.organ === o.key));
                if (next) setNextOrgan(next.key);
              }}
              className="text-[10px] text-stone-500 hover:text-stone-300 px-1"
            >
              + more
            </button>
          )}
        </div>
      )}

      {/* Organ picker for next shot */}
      {shots.length > 0 && shots.length < 5 && (
        <div className="flex gap-1.5">
          {ORGAN_LABELS.filter((o) => !shots.some((s) => s.organ === o.key)).map((o) => (
            <button
              key={o.key}
              onClick={() => setNextOrgan(o.key)}
              className={[
                "px-2 py-1 rounded-lg text-[10px] transition",
                nextOrgan === o.key
                  ? "bg-emerald-800/50 text-emerald-300"
                  : "text-stone-500 hover:text-stone-300",
              ].join(" ")}
            >
              {o.icon} {o.label}
            </button>
          ))}
        </div>
      )}

      {/* ID result */}
      {idResult && (
        <div className="bg-emerald-900/40 border border-emerald-700/40 rounded-xl px-3 py-2.5">
          <p className="text-emerald-300 text-sm font-medium">{idResult.commonName || idResult.scientificName}</p>
          {idResult.commonName && (
            <p className="text-emerald-500/70 text-xs italic">{idResult.scientificName}</p>
          )}
          <p className="text-emerald-600 text-[10px] mt-1">
            {idResult.family} · {Math.round(idResult.confidence * 100)}% · {shots.length} {shots.length === 1 ? "photo" : "photos"}
          </p>
        </div>
      )}

      {idError && <p className="text-amber-400 text-xs">{idError}</p>}

      <div className="flex gap-2">
        {["tree", "shrub", "groundcover", "other"].map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={[
              "flex-1 py-2 rounded-xl text-xs font-medium transition",
              type === t ? "bg-green-700 text-white" : "bg-white/8 text-stone-400 hover:text-white",
            ].join(" ")}
          >
            {t === "groundcover" ? "Cover" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Optional: describe it (e.g. tall oak by fence)"
        className="bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-green-500/50"
      />

      {/* Use as anchor toggle */}
      <button
        onClick={() => setUseAsAnchor(!useAsAnchor)}
        className={[
          "flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition",
          useAsAnchor
            ? "bg-amber-700/40 border border-amber-500/40 text-amber-200"
            : "bg-white/5 border border-white/10 text-stone-500 hover:text-stone-300",
        ].join(" ")}
      >
        <span className="text-sm">📍</span>
        {useAsAnchor ? "Will also use as reference point" : "Also use as reference point?"}
      </button>

      <button
        onClick={handleSave}
        className="w-full bg-green-700 hover:bg-green-600 active:scale-95 text-white font-semibold rounded-xl py-3 transition"
      >
        {useAsAnchor ? "Note Plant + Set Anchor" : "Note This Plant"}
      </button>
    </div>
  );
}

function AnchorPanel({ onSave }: { onSave: (type: string, label: string) => void }) {
  const ANCHOR_TYPES = [
    { value: "front_door",     label: "Front door" },
    { value: "side_door",      label: "Side door" },
    { value: "back_door",      label: "Back door" },
    { value: "driveway_corner",label: "Driveway corner" },
    { value: "big_tree",       label: "Big tree" },
    { value: "shed_corner",    label: "Shed / fence corner" },
    { value: "custom",         label: "Other landmark" },
  ];
  const [type, setType] = useState("front_door");
  const [label, setLabel] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-300 text-sm leading-relaxed">
        Drop a reference point here. These help your map stay accurate across visits.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ANCHOR_TYPES.map(({ value, label: lbl }) => (
          <button
            key={value}
            onClick={() => { setType(value); setLabel(lbl); }}
            className={[
              "py-2.5 px-3 rounded-xl text-xs font-medium text-left transition",
              type === value
                ? "bg-amber-700/60 border border-amber-500/50 text-amber-200"
                : "bg-white/6 text-stone-400 hover:text-white",
            ].join(" ")}
          >
            {lbl}
          </button>
        ))}
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Name this point (optional)"
        className="bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-amber-500/50"
      />
      <button
        onClick={() => onSave(type, label || type.replace(/_/g, " "))}
        className="w-full bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-semibold rounded-xl py-3 transition"
      >
        Save Reference Point
      </button>
    </div>
  );
}

function AreaPanel({ onSave }: { onSave: (type: string, label: string) => void }) {
  const AREA_TYPES = [
    { value: "lawn",         label: "Lawn" },
    { value: "mulch",        label: "Mulch bed" },
    { value: "groundcover",  label: "Groundcover" },
    { value: "mixed_bed",    label: "Mixed garden bed" },
    { value: "leaf_litter",  label: "Leaf litter / natural area" },
    { value: "bare_soil",    label: "Bare soil" },
    { value: "violet_zone",  label: "Wild / unmown area" },
  ];
  const [type, setType] = useState("lawn");
  const [label, setLabel] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-300 text-sm leading-relaxed">
        Mark the type of ground cover or planting area where you're standing.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {AREA_TYPES.map(({ value, label: lbl }) => (
          <button
            key={value}
            onClick={() => { setType(value); setLabel(lbl); }}
            className={[
              "py-2.5 px-3 rounded-xl text-xs font-medium text-left transition",
              type === value
                ? "bg-lime-800/60 border border-lime-600/50 text-lime-200"
                : "bg-white/6 text-stone-400 hover:text-white",
            ].join(" ")}
          >
            {lbl}
          </button>
        ))}
      </div>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Describe this area (optional)"
        className="bg-white/8 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-lime-500/50"
      />
      <button
        onClick={() => onSave(type, label || type.replace(/_/g, " "))}
        className="w-full bg-lime-700 hover:bg-lime-600 active:scale-95 text-white font-semibold rounded-xl py-3 transition"
      >
        Mark This Area
      </button>
    </div>
  );
}

function LightPanel({ onSave }: { onSave: (direction: string, condition: string) => void }) {
  const DIRECTIONS = ["morning sun", "afternoon sun", "full day", "mostly shade", "full shade"];
  const CONDITIONS = ["clear sky", "partly cloudy", "overcast"];
  const [dir, setDir] = useState("afternoon sun");
  const [cond, setCond] = useState("clear sky");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-300 text-sm leading-relaxed">
        Record how much sun this spot gets. This helps build a light map for your yard.
      </p>
      <div>
        <p className="text-stone-500 text-xs mb-2 uppercase tracking-wide">Sun exposure here</p>
        <div className="flex flex-wrap gap-2">
          {DIRECTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDir(d)}
              className={[
                "py-1.5 px-3 rounded-full text-xs font-medium transition",
                dir === d
                  ? "bg-yellow-600/70 border border-yellow-500/50 text-yellow-100"
                  : "bg-white/6 text-stone-400 hover:text-white",
              ].join(" ")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-stone-500 text-xs mb-2 uppercase tracking-wide">Sky right now</p>
        <div className="flex gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => setCond(c)}
              className={[
                "flex-1 py-1.5 rounded-full text-xs font-medium transition",
                cond === c
                  ? "bg-sky-700/70 border border-sky-500/50 text-sky-100"
                  : "bg-white/6 text-stone-400 hover:text-white",
              ].join(" ")}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={() => onSave(dir, cond)}
        className="w-full bg-yellow-600 hover:bg-yellow-500 active:scale-95 text-white font-semibold rounded-xl py-3 transition"
      >
        Record Light
      </button>
    </div>
  );
}

function MorePanel({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const ACTIONS = [
    { label: "Property",    icon: "🏠", path: "/property" },
    { label: "Dashboard",   icon: "📊", path: "/dashboard" },
    { label: "Scan plants", icon: "📷", path: "/scan" },
    { label: "Identify",    icon: "🔍", path: "/identify" },
    { label: "Map",         icon: "🗺", path: "/map" },
    { label: "Help",        icon: "❓", path: null },
  ];

  return (
    <div className="flex flex-col gap-3">
      <p className="text-stone-500 text-sm">Quick access to other tools.</p>
      <div className="grid grid-cols-3 gap-3">
        {ACTIONS.map(({ label, icon, path }) => (
          <button
            key={label}
            onClick={() => path && onNavigate?.(path)}
            className={[
              "bg-white/6 hover:bg-white/10 rounded-xl py-3 px-2 text-xs transition flex flex-col items-center gap-1",
              path ? "text-stone-300" : "text-stone-500",
            ].join(" ")}
          >
            <span className="text-base">{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function NotePanel({ onSave }: { onSave: (category: string, text: string) => void }) {
  const CATEGORIES = [
    { value: "notice",  label: "I notice...",    icon: "👀" },
    { value: "smell",   label: "Smells like...", icon: "🌸" },
    { value: "sound",   label: "I hear...",      icon: "🐦" },
    { value: "mood",    label: "It feels...",    icon: "🌤" },
    { value: "vista",   label: "The view...",    icon: "🏞" },
    { value: "story",   label: "This place...",  icon: "📖" },
  ];
  const [category, setCategory] = useState("notice");
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-stone-400 text-sm leading-relaxed">
        What do you notice right here? It all becomes part of your property memory.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={[
              "py-2 px-2 rounded-xl text-xs font-medium transition text-center",
              category === c.value
                ? "bg-sky-700/50 border border-sky-500/40 text-sky-200"
                : "bg-white/5 text-stone-500 hover:text-stone-300 border border-transparent",
            ].join(" ")}
          >
            <span className="block text-base mb-0.5">{c.icon}</span>
            {c.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Say it in your own words..."
        rows={3}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-sky-500/40 resize-none"
      />
      <button
        onClick={() => { onSave(category, text); setText(""); }}
        disabled={!text.trim()}
        className="w-full bg-sky-700 hover:bg-sky-600 active:scale-95 text-white font-semibold rounded-xl py-3 transition disabled:opacity-40"
      >
        Save Note
      </button>
    </div>
  );
}

// ── Main ContextPanel ─────────────────────────────────────────────────────────

export default function ContextPanel({
  mode,
  walkState,
  onStartWalk,
  onEndWalk,
  onSaveAnchor,
  onSaveArea,
  onTagSubject,
  onSaveSubjectAnchor,
  onSaveLight,
  onSaveNote,
  onClose,
  captureFrame,
  onIdentify,
  onNavigate,
}: ContextPanelProps) {
  const TITLES: Record<ActionMode, string> = {
    walk:     "Your Walk",
    identify: "Identify This",
    anchor:   "Reference Point",
    area:     "Mark an Area",
    light:    "Record Light",
    note:     "Say What You Notice",
    more:     "More",
  };

  return (
    /* Backdrop + Sheet — outer positioning is handled by the parent motion wrapper */
    <div className="flex flex-col justify-end h-full">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="relative z-10 bg-stone-950/95 rounded-t-2xl border-t border-white/10 px-5 pt-4 pb-6 max-h-[75vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-base">{TITLES[mode]}</h2>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-white text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {mode === "walk"     && <WalkPanel state={walkState} onStart={onStartWalk} onEnd={onEndWalk} />}
        {mode === "identify" && <IdentifyPanel onTag={onTagSubject} onTagAsAnchor={onSaveSubjectAnchor} captureFrame={captureFrame} onIdentify={onIdentify} />}
        {mode === "anchor"   && <AnchorPanel onSave={onSaveAnchor} />}
        {mode === "area"     && <AreaPanel onSave={onSaveArea} />}
        {mode === "light"    && <LightPanel onSave={onSaveLight} />}
        {mode === "note"     && <NotePanel onSave={onSaveNote} />}
        {mode === "more"     && <MorePanel onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

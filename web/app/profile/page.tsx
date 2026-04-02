"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { apiFetch } from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PERSONAS = [
  {
    id: "homeowner",
    label: "Homeowner",
    icon: "🏡",
    description: "Yard health, eco scoring, and planting guidance for your property.",
  },
  {
    id: "gardener",
    label: "Gardener",
    icon: "🌿",
    description: "Deep plant knowledge, species ID, and garden composition tracking.",
  },
  {
    id: "arborist",
    label: "Arborist",
    icon: "🌳",
    description: "Tree health, canopy coverage, and structural assessment.",
  },
  {
    id: "grower",
    label: "Grower",
    icon: "🥕",
    description: "Food production, yield tracking, and growing conditions.",
  },
];

interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  user_type: string;
  onboarded_at: string | null;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const token = (session as any)?.apiToken as string | undefined;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [selectedType, setSelectedType] = useState("homeowner");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch(token, `${API}/me`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setProfile(data.user);
          setDisplayName(data.user.display_name ?? "");
          setSelectedType(data.user.user_type ?? "homeowner");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaved(false);

    const r = await apiFetch(token, `${API}/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: displayName, user_type: selectedType }),
    });

    if (r.ok) {
      const data = await r.json();
      setProfile(data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-lime-300 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isPro = profile?.role === "pro" || profile?.role === "admin" || profile?.role === "founder";

  return (
    <div className="min-h-screen bg-[#07110c] pb-16">
      {/* Header */}
      <div className="border-b border-white/10 px-5 py-4 flex items-center gap-3">
        <a href="/dashboard" className="text-zinc-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <h1 className="text-base font-semibold text-white">Profile</h1>
      </div>

      <div className="max-w-lg mx-auto px-5 pt-8 space-y-8">
        {/* Account info */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Account</p>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-lime-300/20 border border-lime-300/30 flex items-center justify-center text-lime-300 font-semibold text-sm">
              {(profile?.display_name ?? profile?.email ?? "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{profile?.display_name ?? profile?.email}</p>
              <p className="text-xs text-zinc-400">{profile?.email}</p>
            </div>
            <div className="ml-auto">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                isPro
                  ? "bg-lime-300/20 text-lime-300 border border-lime-300/30"
                  : "bg-white/10 text-zinc-400 border border-white/10"
              }`}>
                {profile?.role === "admin" ? "Admin" : isPro ? "Pro" : "Free"}
              </span>
            </div>
          </div>
          {!isPro && (
            <a href="/upgrade" className="block w-full text-center py-2.5 rounded-xl bg-lime-300/10 border border-lime-300/20 text-lime-300 text-sm font-medium hover:bg-lime-300/20 transition-colors">
              Upgrade to Pro →
            </a>
          )}
        </div>

        {/* Edit profile form */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Display name */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-2">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={80}
              className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-lime-300/50"
            />
          </div>

          {/* Persona picker */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-3">I am a…</label>
            <div className="grid grid-cols-2 gap-3">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedType(p.id)}
                  className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border text-left transition-all ${
                    selectedType === p.id
                      ? "bg-lime-300/15 border-lime-300/50 shadow-[0_0_0_1px_rgba(190,230,100,0.3)]"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <span className={`text-sm font-semibold ${selectedType === p.id ? "text-lime-200" : "text-white"}`}>
                    {p.label}
                  </span>
                  <span className="text-xs text-zinc-400 leading-relaxed">{p.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            className="w-full h-12 bg-lime-300 text-zinc-950 rounded-xl font-semibold text-sm hover:bg-lime-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? (
              <span className="w-4 h-4 border-2 border-zinc-800 border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </>
            ) : (
              "Save profile"
            )}
          </button>
        </form>

        {/* Sign out */}
        <div className="pt-2">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full h-11 rounded-xl border border-white/10 text-zinc-400 text-sm hover:text-white hover:border-white/20 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

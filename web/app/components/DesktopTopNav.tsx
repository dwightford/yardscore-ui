"use client";

/**
 * DesktopTopNav — authenticated desktop interpretation chrome
 *
 * Canon (yardscore website redesign brief v1):
 *   - Mobile observes. Web interprets.
 *   - Web spine: Property Home -> Structure -> Signals -> Readiness -> Narrative
 *
 * Patch (YardScore Authenticated Surface Separation, 2026-04-09):
 *   - Authenticated desktop must NOT see the bottom mobile tab bar.
 *   - Authenticated desktop must NOT see Walk as a primary persistent action.
 *   - Authenticated desktop should default toward Property Home / interpretation.
 *
 * This component is the desktop counterpart to BottomTabs. It is the
 * minimum viable top nav: brand mark, primary interpretation routes,
 * profile. It does NOT include a Walk action — Walk only happens on
 * the phone, and the /walk page itself already redirects desktop
 * visitors back here.
 *
 * Render rules:
 *   - Public landing ("/") never gets this nav
 *   - Walk / login / share / onboard / garden routes never get this nav
 *   - Phone shell never gets this nav (BottomTabs is its chrome instead)
 *   - Pre-hydration (shell unknown) renders this nav as the desktop default
 */

import { usePathname } from "next/navigation";
import { Home, Map as MapIcon, User } from "lucide-react";
import { useDeviceShell } from "@/hooks/useDeviceShell";

const DESKTOP_LINKS = [
  {
    href: "/dashboard",
    label: "Property Home",
    matchPrefixes: ["/dashboard", "/property"],
    icon: Home,
  },
  {
    href: "/map",
    label: "Map",
    matchPrefixes: ["/map"],
    icon: MapIcon,
  },
  {
    href: "/profile",
    label: "Profile",
    matchPrefixes: ["/profile"],
    icon: User,
  },
];

/** Routes where the desktop top nav should NOT render */
const HIDDEN_ON = ["/login", "/share", "/walk", "/onboard", "/garden"];

export default function DesktopTopNav() {
  const pathname = usePathname();
  const shell = useDeviceShell();

  // Public landing — no authenticated chrome.
  if (pathname === "/") return null;

  // Routes that opt out of nav (login, walk, share, etc).
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  // Phone shell uses BottomTabs instead.
  // Pre-hydration (shell === null) renders desktop default — that's correct.
  if (shell === "phone") return null;

  return (
    <header
      className="sticky top-0 z-40 hidden border-b border-white/[0.06] bg-forest-950/95 backdrop-blur-lg lg:block"
      aria-label="Desktop interpretation navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <a
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-semibold tracking-wide text-stone-200"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-lime-300/20 bg-lime-300/10">
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 text-lime-300"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 22c-4-4-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8-8 12Z"
              />
            </svg>
          </span>
          YardScore
        </a>
        <nav className="flex items-center gap-1">
          {DESKTOP_LINKS.map((link) => {
            const Icon = link.icon;
            const active = link.matchPrefixes.some(
              (p) => pathname === p || pathname.startsWith(p + "/")
            );
            return (
              <a
                key={link.label}
                href={link.href}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/[0.06] text-stone-100"
                    : "text-stone-400 hover:bg-white/[0.03] hover:text-stone-200"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
                <span>{link.label}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

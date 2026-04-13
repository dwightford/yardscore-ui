"use client";

/**
 * BottomTabs — phone-only authenticated mobile chrome
 *
 * Canon (YardScore Authenticated Surface Separation, 2026-04-09):
 *   - Authenticated phone:   shows the mobile capture nav (Walk | Ask | Map)
 *   - Authenticated desktop: this component renders nothing.
 *                            Desktop uses DesktopTopNav instead.
 *   - Unauthenticated:       this component renders nothing on the public
 *                            landing page (HIDDEN_ON includes "/").
 *
 * During walks, the tab bar also hides. Camera is the app.
 */

import { usePathname } from "next/navigation";
import {
  Footprints,
  Home,
  Map,
} from "lucide-react";
import { useDeviceShell } from "@/hooks/useDeviceShell";

// Phone tabs only — desktop has its own top nav and never sees this bar.
// `/dashboard` is a redirect-only waypoint → users always land on their
// property home.
const PHONE_TABS = [
  {
    href: "/dashboard",
    label: "Home",
    icon: Home,
  },
  {
    href: "/walk",
    label: "Walk",
    icon: Footprints,
  },
  {
    href: "/map",
    label: "Map",
    icon: Map,
  },
];

/** Pages where the tab bar should NOT appear */
const HIDDEN_ON = ["/login", "/share", "/walk", "/onboard", "/garden"];

export default function BottomTabs() {
  const pathname = usePathname();
  const shell = useDeviceShell();

  // Public landing — never show authenticated chrome.
  if (pathname === "/") return null;

  // Pages that explicitly opt out of the tab bar.
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  // Pre-hydration (shell unknown) and desktop both render nothing.
  // Desktop-default posture: never flash mobile chrome on a desktop browser.
  if (shell !== "phone") return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-forest-950/95 backdrop-blur-lg lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {PHONE_TABS.map((tab) => {
          const Icon = tab.icon;
          const active =
            pathname === tab.href ||
            (tab.href !== "/" && pathname.startsWith(tab.href));

          return (
            <a
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                active ? "text-forest-300" : "text-zinc-500"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

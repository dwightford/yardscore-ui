"use client";

/**
 * BottomTabs — phone-only authenticated mobile chrome.
 *
 * Canon (yardscore-site-map-and-route-truth-v1):
 *   - The only primary post-auth surfaces are Progress and Observe.
 *   - Map is a secondary review surface; reachable from property
 *     quick-actions, not from primary nav.
 *
 * During walks, the tab bar hides. Camera is the app.
 */

import { usePathname } from "next/navigation";
import { Activity, Footprints } from "lucide-react";
import { useDeviceShell } from "@/hooks/useDeviceShell";

// `/dashboard` is a redirect-only waypoint → users land on their property
// home, which renders Progress content.
const PHONE_TABS = [
  {
    href: "/dashboard",
    label: "Progress",
    icon: Activity,
  },
  {
    href: "/walk",
    label: "Observe",
    icon: Footprints,
  },
];

/** Pages where the tab bar should NOT appear */
const HIDDEN_ON = ["/login", "/register", "/share", "/walk", "/onboard", "/garden"];

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

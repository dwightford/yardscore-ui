"use client";

/**
 * BottomTabs — Garden Voice edition
 *
 * Three-mode navigation:
 * Mobile:  Walk | Ask | Map
 * Desktop: Home | Map | Profile
 *
 * During walks, the tab bar hides. Camera is the app.
 */

import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Footprints,
  MessageCircle,
  Map,
  Home,
  User,
} from "lucide-react";

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    setMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);
  return mobile;
}

const TABS = [
  {
    href: "/dashboard",
    label: "Home",
    mobileLabel: "Walk",
    mobileHref: "/walk",
    mobileOnly: false,
    icon: Home,
    mobileIcon: Footprints,
  },
  {
    href: "/dashboard",
    label: "Ask",
    mobileOnly: true,
    icon: MessageCircle,
    // TODO: /ask route when chat interface is built
    // For now, links to dashboard/property page
  },
  {
    href: "/map",
    label: "Map",
    mobileOnly: false,
    icon: Map,
  },
  {
    href: "/profile",
    label: "Profile",
    mobileOnly: false,
    icon: User,
  },
];

/** Pages where the tab bar should NOT appear */
const HIDDEN_ON = ["/login", "/share", "/walk", "/onboard", "/garden"];

export default function BottomTabs() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (pathname === "/") return null;

  const visibleTabs = TABS.filter((t) => !t.mobileOnly || isMobile);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.06] bg-forest-950/95 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-center justify-around">
        {visibleTabs.map((tab) => {
          const href =
            isMobile && tab.mobileHref ? tab.mobileHref : tab.href;
          const label =
            isMobile && tab.mobileLabel ? tab.mobileLabel : tab.label;
          const Icon = isMobile && tab.mobileIcon ? tab.mobileIcon : tab.icon;

          const active =
            href === "/dashboard"
              ? pathname === "/dashboard" ||
                pathname.startsWith("/property")
              : pathname === href ||
                (href !== "/" && pathname.startsWith(href));

          return (
            <a
              key={label}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 transition-colors ${
                active ? "text-forest-300" : "text-zinc-500"
              }`}
            >
              <Icon
                className="h-5 w-5"
                strokeWidth={active ? 2 : 1.5}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

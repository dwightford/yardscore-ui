"use client";

/**
 * useDeviceShell — authenticated shell device-class detection.
 *
 * Canon (yardscore website redesign brief v1):
 *   - Mobile observes.
 *   - Web interprets.
 *
 * Patch (YardScore Authenticated Surface Separation, 2026-04-09):
 *   - Authenticated phone:   mobile capture shell, walk-first, bottom tabs ok
 *   - Authenticated desktop: interpretation shell, no bottom tabs, no walk CTA
 *
 * The unauthenticated public site is shared responsively across both
 * device classes. This hook is only meaningful for authenticated views.
 *
 * Detection strategy
 * ──────────────────
 * Touch capability is the existing yardscore convention (used by
 * BottomTabs and /walk/page.tsx for the same purpose). Reusing that
 * signal keeps the shell distinction consistent across the codebase.
 *
 * SSR returns `null` so the first paint is shell-agnostic. Components
 * should render the **desktop default** (no mobile chrome) until the
 * client hydrates and the real device class is known. This avoids
 * hydration mismatches AND keeps desktop visually clean by default.
 *
 * Returns:
 *   - "phone"   — touch device, render mobile shell
 *   - "desktop" — non-touch, render desktop interpretation shell
 *   - null      — server render or pre-hydration; render desktop default
 */

import { useEffect, useState } from "react";

export type DeviceShell = "phone" | "desktop";

export function useDeviceShell(): DeviceShell | null {
  const [shell, setShell] = useState<DeviceShell | null>(null);

  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);
    setShell(isTouch ? "phone" : "desktop");
  }, []);

  return shell;
}

/**
 * Convenience: returns true only when device class is known to be phone.
 * Returns false during SSR / pre-hydration (desktop-default posture).
 */
export function useIsPhoneShell(): boolean {
  return useDeviceShell() === "phone";
}

/**
 * Convenience: returns true when device class is known to be desktop
 * OR when device class is unknown (pre-hydration). This is the
 * "no mobile chrome" predicate — safer to over-include desktop than
 * to flash mobile chrome on a desktop.
 */
export function useIsDesktopShell(): boolean {
  const shell = useDeviceShell();
  return shell === "desktop" || shell === null;
}

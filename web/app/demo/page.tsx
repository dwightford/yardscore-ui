"use client";

/**
 * /demo — canonical demo URL (anonymous, non-claiming).
 *
 * Per site-map-and-route-truth-v1: Demo is "safe for anonymous users, not
 * a private yard, not a claim path." For now we forward to the public
 * census surface at /share with a demo id. Swap `DEMO_ID` for a real
 * seeded public land_unit once one exists.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEMO_ID = process.env.NEXT_PUBLIC_DEMO_LAND_UNIT_ID || "demo";

export default function DemoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/share?id=${DEMO_ID}`);
  }, [router]);
  return (
    <div className="min-h-screen bg-forest-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-forest-300/30 border-t-forest-300 rounded-full animate-spin" />
    </div>
  );
}

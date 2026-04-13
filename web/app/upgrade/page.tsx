"use client";

/**
 * /upgrade — retired. Canon: "The creator never pays."
 *
 * Redirects to /profile. Kept as a stub so external links don't 404.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UpgradeRetired() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return (
    <div className="min-h-screen bg-[#07110c] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-lime-300/30 border-t-lime-300 rounded-full animate-spin" />
    </div>
  );
}

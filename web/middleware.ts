import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Upgrade-mode middleware.
 *
 * When UPGRADE_MODE=true, all routes redirect to the landing splash
 * except: the splash itself, early-access API, static assets, and share pages.
 *
 * When UPGRADE_MODE is not set, normal auth middleware runs.
 */

const UPGRADE_MODE = process.env.UPGRADE_MODE === "true";

// Routes that stay accessible during upgrade
const UPGRADE_ALLOW = [
  "/",
  "/api/early-access",
  "/share",
];

function isAllowedDuringUpgrade(pathname: string): boolean {
  return UPGRADE_ALLOW.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

// Static assets that should never be intercepted
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/apple-touch") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/models/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never touch static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Upgrade mode: redirect everything else to splash
  if (UPGRADE_MODE && !isAllowedDuringUpgrade(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Normal mode: run auth middleware
  if (!UPGRADE_MODE) {
    const { auth } = await import("./auth");
    return (auth as any)(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image).*)",
  ],
};

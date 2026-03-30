import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";

const MOBILE_RE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/scan", "/capture", "/map", "/identify", "/debug"];

// Routes that are always public
const PUBLIC_ROUTES = ["/", "/login", "/api/auth", "/api/early-access"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Always allow public routes and static assets
  if (
    PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/apple-touch") ||
    pathname.startsWith("/icon-") ||
    pathname.startsWith("/models/")
  ) {
    // Mobile redirect on landing page only
    if (pathname === "/") {
      const ua = req.headers.get("user-agent") ?? "";
      if (MOBILE_RE.test(ua)) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtected = PROTECTED_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));

  if (isProtected && !req.auth) {
    // Not authenticated — redirect to login
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

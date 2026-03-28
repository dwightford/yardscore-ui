import { NextRequest, NextResponse } from "next/server";

const MOBILE_RE =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname !== "/") return NextResponse.next();

  const ua = req.headers.get("user-agent") ?? "";
  if (MOBILE_RE.test(ua)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};

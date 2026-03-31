export { auth as middleware } from "./auth";

export const config = {
  matcher: [
    // Match all routes except static files, images, and public assets
    "/((?!_next/static|_next/image|favicon|manifest|apple-touch|icon-|models/|plantnet-proxy|spike|share).*)",
  ],
};

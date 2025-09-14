// middleware.ts
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     *  - API routes starting with /api/webhooks
     *  - Public assets in /_next/static and /favicon.ico
     */
    "/((?!_next/static|favicon.ico|api/webhooks).*)",
  ],
};

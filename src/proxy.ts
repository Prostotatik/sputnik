import { NextResponse, type NextRequest } from "next/server";
import { isAllowedRequest } from "./lib/same-origin";

export function proxy(request: NextRequest) {
  if (!isAllowedRequest(request.method, request.headers)) {
    return NextResponse.json({ error: "Request blocked: unknown host or cross-site request" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };

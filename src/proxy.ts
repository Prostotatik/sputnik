import { NextResponse, type NextRequest } from "next/server";
import { isAllowedMutation } from "./lib/same-origin";

export function proxy(request: NextRequest) {
  if (!isAllowedMutation(request.method, request.headers, request.headers.get("host"))) {
    return NextResponse.json({ error: "Cross-site requests are not allowed" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };

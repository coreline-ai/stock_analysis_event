import { NextResponse } from "next/server";

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

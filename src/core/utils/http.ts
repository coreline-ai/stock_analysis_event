import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "missing_env"
  | "forbidden_env"
  | "db_error"
  | "quote_unavailable"
  | "symbol_not_found"
  | "unknown_error";

export interface ClassifiedApiError {
  message: string;
  status: number;
  code: ApiErrorCode;
}

export function classifyApiError(err: unknown): ClassifiedApiError {
  const message = err instanceof Error ? err.message : "unknown_error";

  if (message === "unauthorized") {
    return { message, status: 401, code: "unauthorized" };
  }
  if (message === "invalid_request") {
    return { message, status: 400, code: "invalid_request" };
  }
  if (message.startsWith("Missing required env:")) {
    return { message, status: 500, code: "missing_env" };
  }
  if (message.startsWith("Forbidden env detected:")) {
    return { message, status: 500, code: "forbidden_env" };
  }
  if (/(database|postgres|pg|ECONN|ENOTFOUND|connection|timeout|relation\s+.+\s+does not exist)/i.test(message)) {
    return { message, status: 500, code: "db_error" };
  }
  return { message, status: 500, code: "unknown_error" };
}

export function jsonError(message: string, status = 500, code: ApiErrorCode = "unknown_error") {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

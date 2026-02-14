import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "missing_env"
  | "forbidden_env"
  | "db_error"
  | "rate_limited"
  | "quote_unavailable"
  | "symbol_not_found"
  | "unknown_error";

export interface ClassifiedApiError {
  message: string;
  status: number;
  code: ApiErrorCode;
}

function isKnownErrorCode(value: string): value is ApiErrorCode {
  return (
    value === "unauthorized" ||
    value === "invalid_request" ||
    value === "missing_env" ||
    value === "forbidden_env" ||
    value === "db_error" ||
    value === "rate_limited" ||
    value === "quote_unavailable" ||
    value === "symbol_not_found" ||
    value === "unknown_error"
  );
}

export function classifyApiError(err: unknown): ClassifiedApiError {
  const message = err instanceof Error ? err.message : "unknown_error";

  if (message === "unauthorized") {
    return { message, status: 401, code: "unauthorized" };
  }
  if (message === "invalid_request" || message === "invalid_target_symbol") {
    return { message, status: 400, code: "invalid_request" };
  }
  if (message === "rate_limited") {
    return { message, status: 429, code: "rate_limited" };
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
  if (isKnownErrorCode(message)) {
    return { message, status: 500, code: message };
  }
  return { message, status: 500, code: "unknown_error" };
}

export function toPublicErrorMessage(code: ApiErrorCode, message: string): string {
  if (code === "invalid_request" || code === "unauthorized" || code === "quote_unavailable" || code === "symbol_not_found") {
    return code;
  }
  if (code === "missing_env") {
    // keep explicit DART hint for KR missing env guidance without leaking all internals
    return message.includes("DART_API_KEY") ? "missing_env:DART_API_KEY" : "missing_env";
  }
  if (code === "forbidden_env") return "forbidden_env";
  if (code === "db_error") return "db_error";
  if (code === "rate_limited") return "rate_limited";
  return "unknown_error";
}

export function jsonError(message: string, status = 500, code: ApiErrorCode = "unknown_error") {
  return NextResponse.json({ ok: false, error: toPublicErrorMessage(code, message), code }, { status });
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

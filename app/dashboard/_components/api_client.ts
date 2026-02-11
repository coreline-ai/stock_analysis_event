"use client";

export interface ApiResultOk<T> {
  ok: true;
  status: number;
  data: T;
}

export interface ApiResultError {
  ok: false;
  status: number;
  error: string;
  code?: string;
}

export type ApiResult<T> = ApiResultOk<T> | ApiResultError;

interface RequestOptions {
  token?: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

function parseError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const maybeError = (payload as { error?: unknown }).error;
  if (typeof maybeError === "string" && maybeError.trim().length > 0) return maybeError;
  return fallback;
}

function parseErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const maybeCode = (payload as { code?: unknown }).code;
  if (typeof maybeCode === "string" && maybeCode.trim().length > 0) return maybeCode;
  return undefined;
}

export async function apiRequest<T>(url: string, opts: RequestOptions = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };

  if (opts.token) headers["x-api-token"] = opts.token;

  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
      signal: opts.signal
    });

    const text = await res.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: parseError(payload, res.statusText || "request_failed"),
        code: parseErrorCode(payload)
      };
    }

    if (payload && typeof payload === "object" && "ok" in payload && (payload as { ok: boolean }).ok === true) {
      const wrapped = payload as { data?: unknown };
      return {
        ok: true,
        status: res.status,
        data: (wrapped.data ?? null) as T
      };
    }

    return {
      ok: true,
      status: res.status,
      data: payload as T
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "network_error",
      code: "network_error"
    };
  }
}

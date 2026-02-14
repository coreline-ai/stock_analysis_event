export interface TelemetryEventPayload {
  name: string;
  page: string;
  value: number | string | boolean | null;
  meta: Record<string, string | number | boolean | null>;
  at: string;
}

const MAX_NAME_LENGTH = 80;
const MAX_PAGE_LENGTH = 200;
const MAX_VALUE_LENGTH = 240;
const MAX_META_KEYS = 20;
const MAX_META_KEY_LENGTH = 48;
const MAX_META_VALUE_LENGTH = 180;
const MAX_CONTENT_LENGTH_BYTES = 16 * 1024;

function trimText(input: unknown, maxLength: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLength);
}

function normalizeValue(input: unknown, maxLength: number): string | number | boolean | null {
  if (typeof input === "string") return input.slice(0, maxLength);
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  if (typeof input === "boolean") return input;
  return null;
}

function sanitizeMeta(input: unknown): Record<string, string | number | boolean | null> {
  if (!input || typeof input !== "object") return {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, MAX_META_KEYS);
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [rawKey, value] of entries) {
    const key = trimText(rawKey, MAX_META_KEY_LENGTH);
    if (!key) continue;
    safe[key] = normalizeValue(value, MAX_META_VALUE_LENGTH);
  }
  return safe;
}

export function assertTelemetryContentLength(contentLength: string | null): void {
  if (!contentLength) return;
  const parsed = Number(contentLength);
  if (!Number.isFinite(parsed)) return;
  if (parsed > MAX_CONTENT_LENGTH_BYTES) {
    throw new Error("invalid_request");
  }
}

export function sanitizeTelemetryEvent(body: unknown): TelemetryEventPayload {
  if (!body || typeof body !== "object") throw new Error("invalid_request");

  const raw = body as Record<string, unknown>;
  const name = trimText(raw.name, MAX_NAME_LENGTH);
  if (!name) throw new Error("invalid_request");

  const page = trimText(raw.page, MAX_PAGE_LENGTH);
  const value = normalizeValue(raw.value, MAX_VALUE_LENGTH);
  const meta = sanitizeMeta(raw.meta);
  const atRaw = trimText(raw.at, 64);
  const at = atRaw || new Date().toISOString();

  return { name, page, value, meta, at };
}

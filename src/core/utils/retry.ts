export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number; onError?: (err: unknown, attempt: number) => void }
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      opts.onError?.(err, attempt + 1);
      if (attempt < opts.retries) {
        const delay = opts.baseDelayMs * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

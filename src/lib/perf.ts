/**
 * Lightweight server timing for development and staging.  It is intentionally
 * opt-in in production builds so no operational logs are emitted by default.
 */
export function startPerf(label: string): () => void {
  const enabled = process.env.NODE_ENV === "development" || process.env.FLEETHUB_PERF_LOGS === "1";
  if (!enabled) return () => undefined;

  const startedAt = Date.now();
  return () => {
    console.info(`[perf] ${label}: ${Date.now() - startedAt}ms`);
  };
}

/**
 * Measure an awaited operation without changing its error or return semantics.
 * This is intentionally limited to development/staging so production users do
 * not incur logging noise or receive internal timing details.
 */
export async function measurePerf<T>(label: string, task: () => Promise<T>): Promise<T> {
  const enabled = process.env.NODE_ENV === "development" || process.env.FLEETHUB_PERF_LOGS === "1";
  if (!enabled) return task();

  const startedAt = Date.now();
  try {
    return await task();
  } finally {
    console.info(`[perf] ${label}: ${Date.now() - startedAt}ms`);
  }
}

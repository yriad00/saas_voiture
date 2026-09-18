/** Validate browser mutation requests behind local/proxy URL rewriting. */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const hosts = new Set([requestUrl.host, request.headers.get("host"), request.headers.get("x-forwarded-host")].filter((v): v is string => Boolean(v)));
    if (!hosts.has(originUrl.host)) return false;
    const protocols = new Set([requestUrl.protocol.slice(0, -1), request.headers.get("x-forwarded-proto")].filter((v): v is string => Boolean(v)));
    return protocols.has(originUrl.protocol.slice(0, -1));
  } catch {
    return false;
  }
}

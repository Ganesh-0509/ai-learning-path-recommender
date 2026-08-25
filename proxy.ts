import {NextResponse, type NextRequest} from 'next/server';

/**
 * Per-request CSP nonce for script-src, following Next.js's own documented
 * App Router pattern. This can't be a static header in next.config.ts:
 * Next.js delivers its React Server Components payload via inline
 * `<script>` tags on every page (`self.__next_f.push(...)`) — required for
 * hydration, not something the app can avoid — so a bare `script-src 'self'`
 * blocks the app from ever becoming interactive. A nonce lets those specific
 * Next.js-generated inline scripts run while still refusing any other
 * injected inline script (docs/SECURITY.md §3).
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' trusts scripts loaded BY a nonce'd script — needed
    // for Next.js's own async chunk loading — without opening script-src to
    // arbitrary origins.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({request: {headers: requestHeaders}});
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

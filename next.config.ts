import type {NextConfig} from 'next';

// docs/SECURITY.md §3 — applied to every response. Content-Security-Policy
// is set per-request in proxy.ts instead (it needs a fresh nonce per
// request for Next.js's own inline hydration scripts), not here.
const SECURITY_HEADERS = [
  {key: 'X-Content-Type-Options', value: 'nosniff'},
  {key: 'X-Frame-Options', value: 'DENY'},
  {key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin'},
];

const nextConfig: NextConfig = {
  // Next.js 16 auto-generates AGENTS.md/CLAUDE.md on every dev/build run —
  // not project content, just noise for a repo that already documents
  // itself (README.md, docs/).
  agentRules: false,
  async headers() {
    return [{source: '/:path*', headers: SECURITY_HEADERS}];
  },
};

export default nextConfig;

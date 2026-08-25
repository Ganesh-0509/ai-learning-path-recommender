import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Next.js 16 auto-generates AGENTS.md/CLAUDE.md on every dev/build run —
  // not project content, just noise for a repo that already documents
  // itself (README.md, PLAN.md, docs/).
  agentRules: false,
};

export default nextConfig;

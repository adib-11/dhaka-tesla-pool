import type { NextConfig } from 'next';

// Rewrites are baked in at build time, so API_URL must exist during `next build`
// (Docker build arg locally, project env var on Vercel).
const apiUrl = process.env.API_URL ?? 'http://localhost:4000';
if (!process.env.API_URL && process.env.NODE_ENV === 'production') {
  throw new Error('API_URL must be set when building for production');
}

const nextConfig: NextConfig = {
  output: 'standalone',
  // Same-origin proxy: the session cookie stays first-party even though the API lives on another domain.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;

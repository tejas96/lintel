import type { NextConfig } from 'next';

/** Where the Next server reaches the API. The browser only ever calls /api on this origin. */
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4105';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The design system's web components ship as TypeScript source.
  transpilePackages: ['@lintel/design-system'],
  async rewrites() {
    // Proxying keeps the session cookie first-party (same origin as the app).
    return [{ source: '/api/:path*', destination: `${apiInternalUrl}/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;

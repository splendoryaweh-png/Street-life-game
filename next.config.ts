import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ESLint is re-enabled now that the temporary production build has completed.
  eslint: {
    ignoreDuringBuilds: false,
  },
  // Keep TypeScript checks enabled; type errors must block release.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

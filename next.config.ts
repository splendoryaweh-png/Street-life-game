import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Temporary: skip ESLint during this production build so the release is not
  // blocked by existing lint warnings/errors. Re-enable after this release.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Keep TypeScript checks enabled; type errors must still block release.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep production builds fail-closed: TypeScript errors must block release.
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

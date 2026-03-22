/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
   outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  typescript: {
      ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   reactStrictMode: true,
//     output: 'standalone',
//     outputFileTracingRoot: __dirname,
//   turbopack: {
//     root: __dirname,
//   },
//   typescript: {
//       ignoreBuildErrors: true,
//   },
//   experimental: {
//       turbopack: false,
//     serverActions: {
//       bodySizeLimit: '2mb',
//     },
//   },
//   images: {
//     remotePatterns: [
//       {
//         protocol: 'https',
//         hostname: '**',
//       },
//     ],
//   },
//   async rewrites() {
//     return [
//       {
//         source: '/api/:path*',
//         destination: 'http://localhost:5000/api/:path*',
//       },
//     ];
//   },
// };
//
// module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    allowedDevOrigins: ['192.168.0.199'],

    // Fix turbopack build issues
    output: "standalone",

    turbopack: {
        root: __dirname,
    },
    typescript: {
        ignoreBuildErrors: true, // temporary
    },

    experimental: {
        serverActions: {
            bodySizeLimit: "2mb",
        },
    },

    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "**",
            },
        ],
    },

    async rewrites() {
        return [
            {
                source: "/api/:path*",
                destination:
                    `${process.env.API_URL || "http://localhost:5000"}/api/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    allowedDevOrigins: ['192.168.0.199'],

    // "shared" is a pnpm workspace package linked into node_modules as TS
    // source (see shared/package.json exports). Next.js doesn't transpile
    // node_modules by default, so it needs to be told to for this one.
    transpilePackages: ["shared"],

    // Fix turbopack build issues
    output: "standalone",

    turbopack: {
        // `client` is an npm workspace member now (see root package.json),
        // so `next` and shared deps get hoisted to the repo root's
        // node_modules. Turbopack needs to know the root sits one level
        // up in order to resolve them.
        root: require("path").resolve(__dirname, ".."),
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

    // No more /api/:path* rewrite — habits/auth routes now live inside
    // this app as Route Handlers (app/api/**), talking straight to
    // Supabase Postgres via Drizzle and to Supabase Auth via
    // @supabase/ssr. There's no separate Express service to proxy to.
};

module.exports = nextConfig;

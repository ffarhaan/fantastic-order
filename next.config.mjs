import crypto from "crypto";

const buildId = process.env.VERCEL_GIT_COMMIT_SHA || crypto.randomBytes(8).toString("hex");

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  generateBuildId: async () => buildId,
  env: {
    NEXT_PUBLIC_APP_BUILD_ID: buildId,
  },
  async headers() {
    return [
      {
        source: "/",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;

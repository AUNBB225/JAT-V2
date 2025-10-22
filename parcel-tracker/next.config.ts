/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // ลบบรรทัดนี้ออก ❌
  // eslint: {
  //   ignoreDuringBuilds: true,
  // },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // เพิ่ม allowedDevOrigins สำหรับ development
  allowedDevOrigins: [
    'localhost:3000',
    '192.168.137.1:3000',
    '*.localhost:3000'
  ],
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@mui/material', '@mui/icons-material', '@mui/system'],
};

export default nextConfig;

import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fix: "multiple lockfiles detected" warning — set this project as the turbopack root
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Fix: Blocked cross-origin HMR requests from network interfaces
  allowedDevOrigins: ['192.168.108.1', 'localhost'],
};

export default nextConfig;

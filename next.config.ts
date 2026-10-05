import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "20mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dk0k1i3js6c49.cloudfront.net",
        pathname: "/applications/logos/payment-icons/**",
      },
      {
        protocol: "https",
        hostname: "dk0k1i3js6c49.cloudfront.net",
        pathname: "/iconos-envio/**",
      },
    ],
  },
};

export default nextConfig;

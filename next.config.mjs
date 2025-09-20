import withPWAInit from "@ducanh2912/next-pwa";

const remotePatterns = [
  {
    protocol: "https",
    hostname: "pbs.twimg.com",
    pathname: "/**",
  },
  {
    protocol: "https",
    hostname: "abs.twimg.com",
    pathname: "/**",
  },
];

const withPWA = withPWAInit({
  dest: "public",
  // disable: process.env.NODE_ENV === "development",
  // register: true,
  // scope: "/app",
  // sw: "service-worker.js",
  //...
});

// Your Next config is automatically typed!
export default withPWA({
  images: {
    remotePatterns,
    unoptimized: true, // Disable image optimization for external images
  },
  // output: "export", // Outputs a Single-Page Application (SPA).
  // distDir: "./dist", // Changes the build output directory to `./dist/`.
  // basePath: process.env.NEXT_PUBLIC_BASE_PATH, // Sets the base path to `/some-base-path`.
});

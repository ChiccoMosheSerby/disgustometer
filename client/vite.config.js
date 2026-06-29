import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In development, calls to /api/* are forwarded to the Express server
// on port 3001, so the browser only ever talks to its own origin.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});

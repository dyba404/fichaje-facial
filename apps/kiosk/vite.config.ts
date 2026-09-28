import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// host: true → accesible desde la tablet del local en la LAN.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});

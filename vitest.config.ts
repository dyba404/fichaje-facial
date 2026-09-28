import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/api/test/**/*.test.ts"],
    // los tests de API comparten la BD recon_test: no pueden pisarse en paralelo
    fileParallelism: false,
  },
});

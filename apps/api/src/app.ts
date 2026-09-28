import Fastify from "fastify";

export async function buildApp() {
  const app = Fastify({
    logger: { level: "info" },
  });

  app.get("/healthz", async () => ({
    ok: true,
    app: "recon-api",
    time: new Date().toISOString(),
  }));

  app.get("/", async () => ({
    name: "recon",
    description: "API de fichaje con reconocimiento facial",
    version: "0.1.0",
  }));

  return app;
}

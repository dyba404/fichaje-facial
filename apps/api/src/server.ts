import { buildApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";

const app = await buildApp();

app.listen({ port, host }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`recon-api escuchando en ${address}`);
});

import { env } from "./lib/env.js";
import express from "express";
import cors from "cors";
import { api } from "./routes/index.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { prisma } from "./lib/prisma.js";
import { providerInfo } from "./services/ai/index.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((s) => s.trim()) }));
app.use(express.json({ limit: "2mb" }));

app.use("/api", api);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.PORT, () => {
  const ai = providerInfo();
  console.log(`Audit API on http://localhost:${env.PORT} (AI: ${ai.provider}${ai.live ? "" : " — no key, using fallback data"})`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

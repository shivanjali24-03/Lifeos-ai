import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase, prisma } from "./config/database.js";

const server = createServer(app);
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Shutting down LifeOS AI...`);
  server.close(async (error) => {
    if (error) console.error("Error closing HTTP server:", error);
    try {
      await prisma.$disconnect();
      process.exit(error ? 1 : 0);
    } catch (disconnectError) {
      console.error("Error disconnecting Prisma:", disconnectError);
      process.exit(1);
    }
  });
}

async function start(): Promise<void> {
  await connectDatabase();
  server.listen(env.PORT, () => {
    console.log(`LifeOS AI backend running on http://localhost:${env.PORT}`);
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

start().catch(async (error: unknown) => {
  console.error("Failed to start backend:", error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});

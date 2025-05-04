require("dotenv").config();
import replyFrom from "@fastify/reply-from";
import fastifyStatic from "@fastify/static";
import { PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import path from "path";
import { DenoManager } from "./deno_manager"; // Import DenoManager
import appRoutes from "./routes/apps";

const prisma = new PrismaClient();
const denoManager = new DenoManager(prisma); // Instantiate DenoManager

const fastify = Fastify({
  logger: true,
});

// Register fastify-static to serve the React app build
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../../frontend/dist"), // Path to the built React app
  prefix: "/", // Serve from the root
});

// Register reply-from for proxying
fastify.register(replyFrom);
// Register app routes, passing the walletService, prisma, and cache instances
fastify.register(appRoutes, {
  prefix: "/api/apps",
  prisma: prisma,
  denoManager: denoManager, // Pass denoManager instance
});

// Fallback route to serve index.html for client-side routing
fastify.setNotFoundHandler((request, reply) => {
  // Check if the request is not for an API endpoint
  if (!request.raw.url?.startsWith("/api")) {
    reply.sendFile("index.html");
  } else {
    reply.code(404).send({ message: "Not Found" });
  }
});

// Run the server
const start = async () => {
  try {
    // --- Phase 3: Startup Initialization ---
    fastify.log.info("Starting backend...");

    // Initialize Deno Manager (resetting states)
    await denoManager.initializeManager();

    fastify.log.info("Completed startup initialization.");
    // --- End Phase 3 ---

    await fastify.listen({ port: 3001, host: "0.0.0.0" }); // Use port 3001 for the backend
    fastify.log.info(
      `Server listening on ${fastify.server.address()?.toString()}`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

// Graceful shutdown
const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
signals.forEach((signal) => {
  process.on(signal, async () => {
    fastify.log.info(`Received ${signal}, shutting down gracefully...`);
    fastify.log.info("Stopping Deno backends...");
    await denoManager.stopAllBackends(); // Stop Deno processes first
    fastify.log.info("Deno backends stop initiated.");
    fastify.log.info("Closing Fastify server...");
    await fastify.close();
    fastify.log.info("Fastify server closed.");
    fastify.log.info("Disconnecting Prisma...");
    await prisma.$disconnect(); // Disconnect Prisma
    fastify.log.info("Prisma disconnected.");
    fastify.log.info("Server shut down complete.");
    process.exit(0);
  });
});

require("dotenv").config();
import fastifyStatic from "@fastify/static";
import { PrismaClient } from "@prisma/client"; // Import Prisma Client
import Fastify from "fastify";
import path from "path";
import appRoutes from "./routes/apps"; // Import app routes

const prisma = new PrismaClient(); // Instantiate Prisma Client

const fastify = Fastify({
  logger: true,
});

// Register fastify-static to serve the React app build
fastify.register(fastifyStatic, {
  root: path.join(__dirname, "../../frontend/dist"), // Path to the built React app
  prefix: "/", // Serve from the root
});

// Register app routes, passing the walletService, prisma, and cache instances
fastify.register(appRoutes, {
  prefix: "/api/apps",
  prisma: prisma, // Pass prisma instance
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

import { AppState, PrismaClient } from "@prisma/client"; // Import Prisma Client & Enum
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { executePrompt } from "../ai/agent";

// Define the expected options structure passed during registration
interface AppRoutesOptions extends FastifyPluginOptions {
  prisma: PrismaClient; // Add prisma
}

async function appRoutes(
  fastify: FastifyInstance,
  options: AppRoutesOptions // Use updated options type
) {
  const { prisma } = options; // Destructure prisma from options

  // Define the expected body structure for creating an app
  interface CreateAppBody {
    prompt: string;
  }

  // Route to create a new app
  fastify.post<{ Body: CreateAppBody }>(
    "/",
    async (
      request: FastifyRequest<{ Body: CreateAppBody }>,
      reply: FastifyReply
    ) => {
      const { prompt } = request.body;

      if (!prompt) {
        return reply.code(400).send({
          message: "prompt is required and must be a non-empty string.",
        });
      }

      try {
        // 1. Create App record in DB
        const app = await prisma.app.create({
          data: {
            prompt: prompt,
            state: AppState.INITIALIZING, // Use Enum
          },
        });

        fastify.log.info(`Created new app record with ID: ${app.id}`);

        // 2. Return App ID immediately
        reply.code(202).send({ id: app.id }); // 202 Accepted

        // 3. Start generation in the background (fire and forget)
        // We don't await this promise
        executePromptAndUpdateDb(fastify, prisma, app.id, prompt);
      } catch (error) {
        fastify.log.error(
          error,
          `Failed initial app creation for prompt: ${prompt}`
        );
        // If DB creation failed before sending response, send 500
        if (!reply.sent) {
          return reply
            .code(500)
            .send({ message: "Internal Server Error during app creation." });
        }
        // If response already sent, we can't send another one, just log
      }
    }
  );

  // Route to get app status
  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return reply.code(400).send({ message: "Invalid App ID format." });
    }

    try {
      const app = await prisma.app.findUnique({
        where: { id: appId },
      });

      if (!app) {
        return reply.code(404).send({ message: "App not found." });
      }

      return reply.send(app);
    } catch (error) {
      fastify.log.error(error, `Failed to fetch app status for ID: ${appId}`);
      return reply.code(500).send({ message: "Internal Server Error." });
    }
  });

  // Route to view generated HTML
  fastify.get<{ Params: { id: string } }>(
    "/:id/view",
    async (request, reply) => {
      const { id } = request.params;
      const appId = parseInt(id, 10);

      if (isNaN(appId)) {
        return reply.code(400).send({ message: "Invalid App ID format." });
      }

      try {
        const app = await prisma.app.findUnique({
          where: { id: appId },
        });

        if (!app) {
          return reply.code(404).send({ message: "App not found." });
        }

        if (app.state !== AppState.COMPLETED) {
          // Maybe return a placeholder or status page instead?
          return reply.code(400).send({
            message: `App generation not complete. Current state: ${app.state}`,
          });
        }

        if (!app.html) {
          fastify.log.warn(`App ${appId} is COMPLETED but has no HTML.`);
          return reply
            .code(500)
            .send({ message: "App completed but no content found." });
        }

        // Send the HTML content
        return reply.type("text/html").send(app.html);
      } catch (error) {
        fastify.log.error(error, `Failed to fetch app view for ID: ${appId}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );
}

// Helper function to run generation and update DB
async function executePromptAndUpdateDb(
  fastify: FastifyInstance,
  prisma: PrismaClient,
  appId: number,
  prompt: string
) {
  let generatedHtml = "";
  let generatedCharsCount = 0;
  let lastUpdateTime = 0; // Track last DB update time for throttling
  const throttleInterval = 1000; // Update DB at most every 1 second

  try {
    // Get the stream from the updated executePrompt
    const htmlStream = executePrompt(prompt); // Now returns AsyncIterable<string>

    // Process the stream chunk by chunk
    for await (const chunk of htmlStream) {
      if (generatedCharsCount === 0) {
        // Mark as GENERATING once we get first chunk back
        await prisma.app.update({
          where: { id: appId },
          data: { state: AppState.GENERATING },
        });
        fastify.log.info(`App ${appId} state changed to GENERATING.`);
      }
      generatedHtml += chunk;
      generatedCharsCount += chunk.length;

      // Throttle numChars updates to the DB
      const now = Date.now();
      if (now - lastUpdateTime > throttleInterval) {
        try {
          await prisma.app.update({
            where: { id: appId },
            // Update only numChars and keep state as GENERATING
            data: { numChars: generatedCharsCount },
          });
          lastUpdateTime = now;
          // Use debug level for potentially frequent logs
          fastify.log.debug(
            `App ${appId} numChars updated to ${generatedCharsCount}`
          );
        } catch (dbUpdateError) {
          // Log error but continue processing stream
          fastify.log.error(
            dbUpdateError,
            `Failed periodic numChars update for app ${appId}`
          );
        }
      }
    }

    // Final Update DB on completion (after stream ends)
    await prisma.app.update({
      where: { id: appId },
      data: {
        html: generatedHtml,
        state: AppState.COMPLETED,
        numChars: generatedCharsCount, // Ensure final count is accurate
        // TODO: Add title generation later
      },
    });
    fastify.log.info(`App ${appId} generation COMPLETED.`);
  } catch (error) {
    fastify.log.error(error, `Failed generation for app ID: ${appId}`);
    // Update DB on failure
    try {
      await prisma.app.update({
        where: { id: appId },
        // Keep potentially partially generated numChars when failing
        data: { state: AppState.FAILED },
      });
      fastify.log.info(`App ${appId} state changed to FAILED.`);
    } catch (dbError) {
      fastify.log.error(
        dbError,
        `Failed to update app ${appId} state to FAILED after generation error.`
      );
    }
  }
}

export default appRoutes;

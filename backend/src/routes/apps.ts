import { AppState, PrismaClient } from "@prisma/client"; // Import Prisma Client & Enum
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { evaluatePrompt, executePrompt, generateAppTitle } from "../ai/agent";

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

  // Define the expected querystring structure for getting apps
  interface GetAppsQuerystring {
    status?: string;
  }

  // Define the expected structure of app items returned in the list
  interface AppListItem {
    id: number;
    prompt: string;
    state: AppState;
    // Add other fields if selected in the prisma query
  }

  // Route to get a list of apps with optional filtering
  fastify.get<{ Querystring: GetAppsQuerystring; Reply: AppListItem[] }>(
    "/",
    async (
      request: FastifyRequest<{ Querystring: GetAppsQuerystring }>,
      reply: FastifyReply
    ) => {
      const { status } = request.query;

      try {
        let apps: AppListItem[]; // Explicitly type the apps variable
        if (status === "completed") {
          apps = await prisma.app.findMany({
            where: { state: AppState.COMPLETED, published: true },
            select: {
              // Select only necessary fields for the list view
              id: true,
              prompt: true,
              state: true,
              // Include other fields if needed in the list view
            },
          });
        } else {
          // For now, if status is not 'completed', return an empty array or handle other statuses later
          // Or, you could return all apps:
          // apps = await prisma.app.findMany();
          apps = []; // Returning empty array for now if status is not 'completed'
        }

        return reply.send(apps);
      } catch (error) {
        fastify.log.error(error, `Failed to fetch apps with status: ${status}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );

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
          select: {
            id: true,
            editKey: true,
            previewKey: true,
          },
        });

        fastify.log.info(`Created new app record with ID: ${app.id}`);

        // 2. Return App ID immediately
        reply.code(202).send(app); // 202 Accepted

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
  fastify.get<{ Params: { id: string }; Querystring: { editKey?: string } }>(
    "/:id",
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

        const appResponse = {
          id: app.id,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt,
          state: app.state,
          published: app.published,
          ...(request.query.editKey === app.editKey
            ? {
                errorMessage: app.errorMessage,
                promptSuggestions: app.promptSuggestions, // Add promptSuggestions here
              }
            : {}),
          ...(app.published || request.query.editKey === app.editKey
            ? {
                html: app.html,
                lightningAddress: app.lightningAddress,
                prompt: app.prompt,
                numChars: app.numChars,
                title: app.title,
              }
            : {}),
        };

        return reply.send(appResponse);
      } catch (error) {
        fastify.log.error(error, `Failed to fetch app status for ID: ${appId}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );

  // Define the expected body structure for updating an app
  interface UpdateAppBody {
    published?: boolean;
    lightningAddress?: string;
    // Add other updatable fields here later
  }

  // Route to update an app (e.g., publish)
  fastify.put<{
    Params: { id: string };
    Querystring: { editKey?: string };
    Body: UpdateAppBody;
  }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const { editKey } = request.query;
    const { published, lightningAddress } = request.body;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return reply.code(400).send({ message: "Invalid App ID format." });
    }

    if (!editKey) {
      return reply.code(401).send({ message: "Edit key is required." });
    }

    // Ensure at least one updatable field is provided
    if (published === undefined && !lightningAddress) {
      return reply.code(400).send({ message: "No updatable fields provided." });
    }

    try {
      // Find the app and validate the edit key
      const app = await prisma.app.findUnique({
        where: { id: appId },
      });

      if (!app) {
        return reply.code(404).send({ message: "App not found." });
      }

      if (editKey !== app.editKey) {
        return reply.code(403).send({ message: "Invalid edit key." });
      }

      // Update the app with the provided data
      const updatedApp = await prisma.app.update({
        where: { id: appId },
        data: {
          published,
          lightningAddress,
          // Add other updatable fields here later
        },
        select: {
          id: true,
          published: true,
          lightningAddress: true,
          // Select other fields to return if needed
        },
      });

      fastify.log.info(
        `App ${appId} updated. Published: ${updatedApp.published}`
      );

      return reply.send(updatedApp);
    } catch (error) {
      fastify.log.error(error, `Failed to update app for ID: ${appId}`);
      return reply.code(500).send({ message: "Internal Server Error." });
    }
  });

  // Define the expected body structure for regenerating an app
  interface RegenerateAppBody {
    prompt: string;
  }

  // Route to regenerate an app
  fastify.put<{
    Params: { id: string };
    Querystring: { editKey?: string };
    Body: RegenerateAppBody;
  }>("/:id/regenerate", async (request, reply) => {
    const { id } = request.params;
    const { editKey } = request.query;
    const { prompt } = request.body;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return reply.code(400).send({ message: "Invalid App ID format." });
    }

    if (!editKey) {
      return reply.code(401).send({ message: "Edit key is required." });
    }

    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      return reply.code(400).send({
        message: "Prompt is required and must be a non-empty string.",
      });
    }

    try {
      // Find the app and validate the edit key and published status
      const app = await prisma.app.findUnique({
        where: { id: appId },
      });

      if (!app) {
        return reply.code(404).send({ message: "App not found." });
      }

      if (editKey !== app.editKey) {
        return reply.code(403).send({ message: "Invalid edit key." });
      }

      if (app.published) {
        return reply
          .code(400)
          .send({ message: "Cannot regenerate a published app." });
      }

      // Update the app to reset state and set new prompt
      await prisma.app.update({
        where: { id: appId },
        data: {
          prompt: prompt,
          state: AppState.INITIALIZING,
          html: null, // Clear previous results
          numChars: 0,
          errorMessage: null,
          title: null, // Reset title as well
        },
      });

      fastify.log.info(`App ${appId} regeneration requested with new prompt.`);
      reply.code(202).send({ message: "App regeneration started." }); // 202 Accepted

      // Start generation in the background (fire and forget)
      executePromptAndUpdateDb(fastify, prisma, appId, prompt);
    } catch (error) {
      fastify.log.error(error, `Failed to regenerate app for ID: ${appId}`);
      if (!reply.sent) {
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  });

  // Route to view generated HTML
  fastify.get<{ Params: { id: string }; Querystring: { previewKey?: string } }>(
    "/:id/view",
    async (request, reply) => {
      const { id } = request.params;
      const { previewKey } = request.query;
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

        if (!app.published && previewKey !== app.previewKey) {
          // Maybe return a placeholder or status page instead?
          return reply.code(400).send({
            message: `App is not published`,
          });
        }

        if (!app.html) {
          fastify.log.warn(`App ${appId} is COMPLETED but has no HTML.`);
          return reply
            .code(500)
            .send({ message: "App completed but no content found." });
        }

        // Send the HTML content
        let htmlWithLightningAddress = app.html;
        if (app.lightningAddress) {
          htmlWithLightningAddress = htmlWithLightningAddress.replaceAll(
            "rolznzfra@getalby.com",
            app.lightningAddress
          );
        }
        return reply.type("text/html").send(htmlWithLightningAddress);
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

    const htmlStart = generatedHtml.indexOf("<html");
    const htmlEnd = generatedHtml.indexOf("</html>");
    if (htmlStart < 0 || htmlEnd < 0) {
      throw new Error(
        "Could not find HTML in generated response: " + generatedHtml
      );
    }
    generatedHtml = generatedHtml.substring(
      htmlStart,
      htmlEnd + "</html>".length
    );

    // Update state to REVIEWING before generating title/suggestions
    fastify.log.info(`App ${appId} updating state to REVIEWING.`);
    await prisma.app.update({
      where: { id: appId },
      data: {
        state: AppState.REVIEWING,
        html: generatedHtml, // Save the generated HTML here too
        numChars: generatedCharsCount, // Ensure count is saved before review
      },
    });

    // Generate title and evaluate prompt after successful HTML generation
    fastify.log.info(`App ${appId} generating title and evaluating prompt...`);
    const [generatedTitle, promptEvaluation] = await Promise.all([
      generateAppTitle(prompt),
      evaluatePrompt(prompt),
    ]);
    fastify.log.info(
      `App ${appId} title: ${generatedTitle}, evaluation score: ${
        promptEvaluation.split("\n")[0]
      }`
    );

    // Final Update DB on completion (after review)
    await prisma.app.update({
      where: { id: appId },
      data: {
        // html and numChars already saved before REVIEWING state
        state: AppState.COMPLETED,
        title: generatedTitle, // Add generated title
        promptSuggestions: promptEvaluation, // Add prompt evaluation
      },
    });
    fastify.log.info(
      `App ${appId} generation COMPLETED with title and evaluation.`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    fastify.log.error(error, `Failed generation for app ID: ${appId}`);
    // Update DB on failure
    try {
      await prisma.app.update({
        where: { id: appId },
        // Keep potentially partially generated numChars when failing
        data: {
          state: AppState.FAILED,
          errorMessage: errorMessage.substring(0, 1000), // Store error message (truncated if needed)
        },
      });
      fastify.log.info(
        `App ${appId} state changed to FAILED. Error: ${errorMessage}`
      );
    } catch (dbError) {
      fastify.log.error(
        dbError,
        `Failed to update app ${appId} state to FAILED after generation error.`
      );
    }
  }
}

export default appRoutes;

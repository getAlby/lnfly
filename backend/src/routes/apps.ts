import { AppState, BackendState, PrismaClient } from "@prisma/client"; // Import Prisma Client & Enums
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { evaluatePrompt, executePrompt, generateAppTitle } from "../ai/agent";
import { DenoManager } from "../deno_manager"; // Import DenoManager

// Define the expected options structure passed during registration
interface AppRoutesOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
  denoManager: DenoManager; // Add denoManager
}

async function appRoutes(
  fastify: FastifyInstance,
  options: AppRoutesOptions // Use updated options type
) {
  const { prisma, denoManager } = options; // Destructure prisma and denoManager

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
              title: true,
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
        executePromptAndUpdateDb(fastify, prisma, app.id, prompt); // Pass denoManager
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
          // Select all fields needed, including new backend fields
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
                promptSuggestions: app.promptSuggestions,
                // Include backend details only if editKey matches
                denoCode: app.denoCode,
                backendState: app.backendState,
                backendPort: app.backendPort,
                generatingSection: app.generatingSection,
              }
            : {}),
          ...(app.published || request.query.editKey === app.editKey
            ? {
                // Publicly visible or previewable fields
                html: app.html,
                lightningAddress: app.lightningAddress,
                prompt: app.prompt,
                numChars: app.numChars,
                title: app.title,
                // Do NOT expose denoCode/backend details here unless editKey matches (handled above)
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
    title?: string;
    state?: AppState; // Add state field
    errorMessage?: string | null; // Add errorMessage field
  }

  // Route to update an app (e.g., publish, cancel)
  fastify.put<{
    Params: { id: string };
    Querystring: { editKey?: string };
    Body: UpdateAppBody;
  }>("/:id", async (request, reply) => {
    const { id } = request.params;
    const { editKey } = request.query;
    const { published, lightningAddress, title, state, errorMessage } =
      request.body; // Extract new fields
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return reply.code(400).send({ message: "Invalid App ID format." });
    }

    if (!editKey) {
      return reply.code(401).send({ message: "Edit key is required." });
    }

    // Ensure at least one updatable field is provided
    if (
      published === undefined &&
      lightningAddress === undefined && // Check if undefined
      title === undefined &&
      state === undefined &&
      errorMessage === undefined
    ) {
      return reply.code(400).send({ message: "No updatable fields provided." });
    }

    if (state && state !== "FAILED") {
      return reply.code(400).send({ message: "Can only set state to FAILED." });
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
          // Pass all potentially undefined fields directly
          published,
          lightningAddress,
          title,
          state,
          errorMessage,
        },
        select: {
          id: true,
          published: true,
          lightningAddress: true,
          title: true,
          state: true, // Select updated state
          errorMessage: true, // Select updated error message
        },
      });

      fastify.log.info(
        `App ${appId} updated. Data: ${JSON.stringify(updatedApp)}`
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
          title: null,
          denoCode: null, // Clear deno code on regenerate
          backendState: BackendState.STOPPED, // Reset backend state
          backendPort: null,
        },
      });

      // Stop any potentially running backend for this app before regenerating
      await denoManager.stopAppBackend(appId);

      fastify.log.info(`App ${appId} regeneration requested with new prompt.`);
      reply.code(202).send({ message: "App regeneration started." }); // 202 Accepted

      // Start generation in the background (fire and forget)
      executePromptAndUpdateDb(fastify, prisma, appId, prompt); // Pass denoManager
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
        let processedHtml = app.html; // Start with original HTML
        if (app.lightningAddress) {
          processedHtml = processedHtml.replaceAll(
            "rolznzfra@getalby.com",
            app.lightningAddress
          );
        }
        // Replace /PROXY paths with the backend proxy path
        // Use regex to ensure we only match the beginning of the path segment in attributes
        // Handles both double and single quotes
        processedHtml = processedHtml.replaceAll(
          `/PROXY/`,
          `/api/apps/${appId}/proxy/`
        );

        return reply.type("text/html").send(processedHtml); // Send the fully processed HTML
      } catch (error) {
        fastify.log.error(error, `Failed to fetch app view for ID: ${appId}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );

  // --- Backend Control Routes ---

  // Route to start the Deno backend
  fastify.post<{ Params: { id: string }; Querystring: { editKey?: string } }>(
    "/:id/backend/start",
    async (request, reply) => {
      const { id } = request.params;
      const { editKey } = request.query;
      const appId = parseInt(id, 10);

      if (isNaN(appId)) {
        return reply.code(400).send({ message: "Invalid App ID format." });
      }
      if (!editKey) {
        return reply.code(401).send({ message: "Edit key is required." });
      }

      try {
        const app = await prisma.app.findUnique({ where: { id: appId } });
        if (!app) {
          return reply.code(404).send({ message: "App not found." });
        }
        if (editKey !== app.editKey) {
          return reply.code(403).send({ message: "Invalid edit key." });
        }
        if (!app.denoCode) {
          return reply.code(400).send({ message: "App has no backend code." });
        }

        // Call manager to start (non-blocking)
        denoManager.startAppBackend(appId);

        // Give it a moment to potentially update state, then fetch latest
        await new Promise((resolve) => setTimeout(resolve, 200)); // Small delay
        const updatedApp = await prisma.app.findUnique({
          where: { id: appId },
        });

        return reply.send({ backendState: updatedApp?.backendState });
      } catch (error) {
        fastify.log.error(
          error,
          `Failed to start backend for app ID: ${appId}`
        );
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );

  // Route to stop the Deno backend
  fastify.post<{ Params: { id: string }; Querystring: { editKey?: string } }>(
    "/:id/backend/stop",
    async (request, reply) => {
      const { id } = request.params;
      const { editKey } = request.query;
      const appId = parseInt(id, 10);

      if (isNaN(appId)) {
        return reply.code(400).send({ message: "Invalid App ID format." });
      }
      if (!editKey) {
        return reply.code(401).send({ message: "Edit key is required." });
      }

      try {
        const app = await prisma.app.findUnique({ where: { id: appId } });
        if (!app) {
          return reply.code(404).send({ message: "App not found." });
        }
        if (editKey !== app.editKey) {
          return reply.code(403).send({ message: "Invalid edit key." });
        }

        // Call manager to stop (non-blocking)
        denoManager.stopAppBackend(appId);

        // Give it a moment to potentially update state, then fetch latest
        await new Promise((resolve) => setTimeout(resolve, 200)); // Small delay
        const updatedApp = await prisma.app.findUnique({
          where: { id: appId },
        });

        return reply.send({ backendState: updatedApp?.backendState });
      } catch (error) {
        fastify.log.error(error, `Failed to stop backend for app ID: ${appId}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );
  // --- Proxy Route ---

  // Route to proxy requests to the running Deno backend
  fastify.all<{ Params: { id: string; "*": string } }>(
    "/:id/proxy/*",
    async (request, reply) => {
      const { id } = request.params;
      const targetPath = request.params["*"]; // Get the path after /proxy/
      const appId = parseInt(id, 10);

      if (isNaN(appId)) {
        return reply.code(400).send({ message: "Invalid App ID format." });
      }

      try {
        // Fetch app details, specifically the port and state
        const app = await prisma.app.findUnique({
          where: { id: appId },
          select: { backendPort: true, backendState: true },
        });

        if (!app) {
          return reply.code(404).send({ message: "App not found." });
        }

        // Check if the backend is running and has a port assigned
        if (app.backendState !== BackendState.RUNNING || !app.backendPort) {
          return reply.code(503).send({
            message: "App backend is not running or port not available.",
          });
        }

        // Construct the target URL for the Deno app
        const targetUrl = `http://localhost:${app.backendPort}/${targetPath}`;

        fastify.log.info(
          `Proxying request for app ${appId}: ${request.method} ${request.url} -> ${targetUrl}`
        );

        // Forward the request using reply.from
        // It automatically handles method, headers, query string, and body
        return reply.from(targetUrl, {
          // Optional: Handle potential errors during proxying
          onError: (reply, error) => {
            fastify.log.error(
              error,
              `Proxy error for app ${appId} to ${targetUrl}`
            );
            // Avoid sending reply twice if headers already sent
            if (!reply.sent) {
              reply
                .code(500)
                .send({ message: "Proxy error", error: error.error });
            }
          },
        });
      } catch (error) {
        fastify.log.error(
          error,
          `Failed to process proxy request for app ID: ${appId}`
        );
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );
}

// Helper function to detect the current generation section
function detectSection(chunk: string): string | undefined {
  if (chunk.includes("<!-- HTML_START -->")) return "HTML";
  if (chunk.includes("<style>")) return "styles";
  if (chunk.includes("<body>")) return "HTML elements";
  if (chunk.includes("<script>")) return "app logic";
  if (chunk.includes("// DENO_START")) return "Backend logic";
  // console.log("No section found: ", chunk);
  return undefined;
}

// Helper function to run generation and update DB
async function executePromptAndUpdateDb(
  fastify: FastifyInstance,
  prisma: PrismaClient,
  appId: number,
  prompt: string
) {
  let fullOutput = ""; // Store the full AI output
  let generatedHtml: string | null = null;
  let generatedDenoCode: string | null = null;
  let generatedCharsCount = 0;
  let lastUpdateTime = 0; // Track last DB update time for throttling
  const throttleInterval = 1000; // Update DB at most every 1 second

  try {
    // Get the stream from the updated executePrompt
    const outputStream = executePrompt(prompt);

    let currentLine = "";
    // Process the stream chunk by chunk
    for await (const chunk of outputStream) {
      if (generatedCharsCount === 0) {
        // Mark as GENERATING once we get first chunk back
        await prisma.app.update({
          where: { id: appId },
          data: { state: AppState.GENERATING },
        });
        fastify.log.info(`App ${appId} state changed to GENERATING.`);
      }
      fullOutput += chunk;
      generatedCharsCount += chunk.length;
      currentLine += chunk;
      let detectedSection: string | undefined;

      while (true) {
        let newLineIndex = currentLine.indexOf("\n");
        if (newLineIndex < 0) {
          break;
        }
        const lineToCheck = currentLine.slice(0, newLineIndex + 1);
        currentLine = currentLine.slice(newLineIndex + 1);
        // Detect section
        //console.log("Checking line", lineToCheck);
        detectedSection = detectSection(lineToCheck) || detectedSection;
      }

      // Throttle DB updates (numChars and generatingSection)
      const now = Date.now();
      if (now - lastUpdateTime > throttleInterval || detectedSection) {
        try {
          await prisma.app.update({
            where: { id: appId },
            // Update numChars and potentially generatingSection
            data: {
              numChars: generatedCharsCount,
              generatingSection: detectedSection,
            },
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
            `Failed periodic DB update (numChars/section) for app ${appId}`
          );
        }
      }
    }

    // --- Parse the full output ---
    const htmlStartMarker = "<!-- HTML_START -->";
    const htmlEndMarker = "<!-- HTML_END -->";
    const denoStartMarker = "// DENO_START";
    const denoEndMarker = "// DENO_END";

    const htmlStartIndex = fullOutput.indexOf(htmlStartMarker);
    const htmlEndIndex = fullOutput.indexOf(htmlEndMarker);
    const denoStartIndex = fullOutput.indexOf(denoStartMarker);
    const denoEndIndex = fullOutput.indexOf(denoEndMarker);

    if (htmlStartIndex !== -1 && htmlEndIndex !== -1) {
      generatedHtml = fullOutput
        .substring(htmlStartIndex + htmlStartMarker.length, htmlEndIndex)
        .trim();
    } else {
      // Assume the whole output is HTML if markers are missing
      generatedHtml = fullOutput.trim();
    }

    if (denoStartIndex !== -1 && denoEndIndex !== -1) {
      generatedDenoCode = fullOutput
        .substring(denoStartIndex + denoStartMarker.length, denoEndIndex)
        .trim();
    }

    // Basic validation
    if (!generatedHtml || !generatedHtml.toLowerCase().includes("<html")) {
      throw new Error("Failed to extract valid HTML from the AI response.");
    }
    // --- End Parsing ---

    // Update state to REVIEWING before generating title/suggestions
    fastify.log.info(`App ${appId} updating state to REVIEWING.`);
    await prisma.app.update({
      where: { id: appId },
      data: {
        state: AppState.REVIEWING,
        html: generatedHtml, // Save extracted HTML
        numChars: generatedCharsCount, // Ensure count is saved before review
        denoCode: generatedDenoCode, // Save extracted Deno code (null if not generated)
        backendState: generatedDenoCode ? BackendState.STOPPED : undefined, // Set initial backend state if code exists
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
        title: generatedTitle,
        promptSuggestions: promptEvaluation,
        generatingSection: null, // Clear generating section on completion
      },
    });
    fastify.log.info(
      `App ${appId} generation COMPLETED. Deno code generated: ${!!generatedDenoCode}`
    );

    // Start Deno backend if code was generated
    if (generatedDenoCode) {
      // TODO: could consider enabling here
      /*fastify.log.info(`Triggering backend start for app ${appId}...`);
      // Don't await, let it run in the background
      denoManager.startAppBackend(appId).catch((err) => {
        fastify.log.error(
          err,
          `Error during initial backend start for app ${appId}`
        );
      });*/
    }
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

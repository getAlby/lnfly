import { nwc } from "@getalby/sdk"; // Import NWCClient
import { AppState, BackendState, PrismaClient, ZapType } from "@prisma/client"; // Import Prisma Client & Enums
import {
  FastifyInstance,
  FastifyPluginOptions,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import "websocket-polyfill";
import { z } from "zod"; // Import Zod for validation
import {
  evaluatePrompt,
  executePrompt,
  generateAppTitle,
  generateSystemPrompt,
} from "../ai/agent";
import { DenoManager } from "../deno_manager"; // Import DenoManager

// Define the expected options structure passed during registration
interface AppRoutesOptions extends FastifyPluginOptions {
  prisma: PrismaClient;
  denoManager: DenoManager; // Add denoManager
}

const activeGenerations = new Map<number, AbortController>(); // Map to store active AbortControllers

async function appRoutes(
  fastify: FastifyInstance,
  options: AppRoutesOptions // Use updated options type
) {
  const { prisma, denoManager } = options; // Destructure prisma and denoManager

  // --- Route Definitions ---

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
    title?: string | null; // Add title
    zapAmount: number; // Now directly from App model (will be 0 if none)
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
        let appsData: AppListItem[] = [];
        if (status === "completed") {
          // Fetch apps and include the stored zapAmount
          appsData = await prisma.app.findMany({
            where: { state: AppState.COMPLETED, published: true },
            select: {
              id: true,
              prompt: true,
              state: true,
              title: true,
              zapAmount: true, // Select the stored zap amount
              // Optionally include zap count if needed (requires separate aggregation or relation count)
              // _count: { select: { zaps: { where: { paid: true } } } } // Example for count
            },
            orderBy: {
              // Example: Allow sorting by zapAmount if needed later
              zapAmount: "desc",
              //updatedAt: "desc", // Default sort
            },
          });
          // Map to ensure structure matches AppListItem, handle potential nulls/defaults if necessary
          // (zapAmount defaults to 0 in schema, so it should exist)
        } else {
          // Handle other statuses or return empty
          appsData = [];
        }

        return reply.send(appsData);
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
        const controller = new AbortController();
        activeGenerations.set(app.id, controller);
        // We don't await this promise
        executePromptAndUpdateDb(
          fastify,
          prisma,
          app.id,
          prompt,
          undefined,
          controller.signal
        );
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
                systemPrompt: app.systemPrompt,
                nwcUrl: app.nwcUrl,
                nsec: app.nsec,
                ppqApiKey: app.ppqApiKey,
                fullOutput: app.fullOutput,
              }
            : {}),
          ...(app.published || request.query.editKey === app.editKey
            ? {
                // Publicly visible or previewable fields
                model: app.model, // Return model
                html: app.html,
                lightningAddress: app.lightningAddress,
                prompt: app.prompt,
                numChars: app.numChars,
                title: app.title,
                seed: app.seed,
                systemPromptSegmentNames: app.systemPromptSegmentNames
                  ?.split(",")
                  .map((name) => name.trim()),
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
    nwcUrl?: string; // Add nwcUrl field
    nsec?: string; // Add nsec field
    ppqApiKey?: string;
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
    const {
      published,
      lightningAddress,
      nwcUrl,
      nsec,
      ppqApiKey,
      title,
      state,
      errorMessage,
    } = request.body;
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
      lightningAddress === undefined &&
      nwcUrl === undefined &&
      nsec === undefined &&
      ppqApiKey === undefined &&
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

      if (state === AppState.FAILED) {
        const controller = activeGenerations.get(appId);
        if (controller) {
          fastify.log.info(
            `Cancelling active generation for app ${appId} via PUT request.`
          );
          controller.abort();
          activeGenerations.delete(appId); // Clean up controller
        }
      }

      // Update the app with the provided data
      const updatedApp = await prisma.app.update({
        where: { id: appId },
        data: {
          // Pass all potentially undefined fields directly
          published,
          lightningAddress,
          nwcUrl, // Add nwcUrl to update data
          nsec, // Add nsec to update data
          ppqApiKey,
          title,
          state,
          errorMessage,
        },
        select: {
          id: true,
          published: true,
          lightningAddress: true,
          nwcUrl: true, // Select updated nwcUrl
          nsec: true, // Select updated nsec
          ppqApiKey: true,
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
    model: string; // Add model to body
  }

  // Route to regenerate an app
  fastify.put<{
    Params: { id: string };
    Querystring: { editKey?: string };
    Body: RegenerateAppBody;
  }>("/:id/regenerate", async (request, reply) => {
    const { id } = request.params;
    const { editKey } = request.query;
    const { prompt, model } = request.body; // Extract model
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
    if (!model || typeof model !== "string" || model.trim() === "") {
      return reply.code(400).send({
        message: "Model is required and must be a non-empty string.",
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
          prompt,
          model,
          state: AppState.INITIALIZING,
          html: null, // Clear previous results
          numChars: 0,
          errorMessage: null,
          title: null,
          denoCode: null, // Clear deno code on regenerate
          backendState: BackendState.STOPPED, // Reset backend state
          backendPort: null,
          systemPrompt: null,
          systemPromptSegmentNames: null,
          fullOutput: null,
        },
      });

      // Stop any potentially running backend for this app before regenerating
      await denoManager.stopAppBackend(appId);

      // Clear storage as it might be out of date for the new prompt
      await denoManager.clearStorage(appId);

      fastify.log.info(`App ${appId} regeneration requested with new prompt.`);
      reply.code(202).send({ message: "App regeneration started." }); // 202 Accepted

      // Start generation in the background (fire and forget)
      const controller = new AbortController();
      activeGenerations.set(appId, controller);
      executePromptAndUpdateDb(
        fastify,
        prisma,
        appId,
        prompt,
        model,
        controller.signal
      ); // Pass model and signal
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

        if (
          app.state !== AppState.COMPLETED &&
          app.state !== AppState.REVIEWING
        ) {
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

        // Handle backend activity (reset timer or auto-start)
        // We don't need to block the view based on the result here.
        await handleBackendActivity(appId, app, denoManager, fastify.log);
        fastify.log.info(`App ${appId} processing HTML.`);
        // Send the HTML content
        let processedHtml = app.html; // Start with original HTML
        if (app.lightningAddress && process.env.DEFAULT_LIGHTNING_ADDRESS) {
          processedHtml = processedHtml.replaceAll(
            process.env.DEFAULT_LIGHTNING_ADDRESS,
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

  // Route to clear storage
  fastify.post<{ Params: { id: string }; Querystring: { editKey?: string } }>(
    "/:id/backend/clear_storage",
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

        await denoManager.clearStorage(appId);

        return reply.send({ message: "Storage cleared successfully" });
      } catch (error) {
        fastify.log.error(
          error,
          `Failed to clear storage for app ID: ${appId}`
        );
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );

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
        // Fetch app details needed for proxying and activity check
        const app = await prisma.app.findUnique({
          where: { id: appId },
          select: {
            backendPort: true,
            backendState: true,
            denoCode: true,
          },
        });

        if (!app) {
          return reply.code(404).send({ message: "App not found." });
        }

        // Handle backend activity and check readiness for proxying
        const activityStatus = await handleBackendActivity(
          appId,
          app,
          denoManager,
          fastify.log
        );

        switch (activityStatus) {
          case "READY":
            // Backend is running, proceed to proxy
            if (!app.backendPort) {
              // This case should theoretically not be reachable if status is READY
              fastify.log.error(
                `App ${appId} is RUNNING but has no backendPort assigned in proxy route!`
              );
              return reply
                .code(500)
                .send({ message: "Internal configuration error." });
            }
            break; // Continue to proxy logic below

          case "STARTING":
            // Backend was stopped, auto-start triggered
            return reply.code(503).send({
              message: "Backend starting, please retry shortly.",
              code: "BACKEND_STARTING",
            });

          case "BUSY":
            // Backend is STARTING or STOPPING
            return reply.code(503).send({
              message: `Backend is currently ${app.backendState}. Please wait.`,
              code: `BACKEND_${app.backendState}`, // e.g., BACKEND_STARTING
            });

          case "NO_BACKEND":
            // App has no backend code defined
            return reply
              .code(400)
              .send({ message: "Proxy request for app with no backend code." });

          default:
            // Should not happen
            fastify.log.error(
              `Unhandled BackendActivityStatus: ${activityStatus}`
            );
            return reply.code(500).send({ message: "Internal Server Error." });
        }

        // If we reach here, activityStatus must be 'READY' and app.backendPort must exist
        const targetUrl = `http://localhost:${app.backendPort}/${targetPath}`;

        fastify.log.info(
          `Proxying request for app ${appId}: ${request.method} ${request.url} -> ${targetUrl}`
        );

        // Forward the request using reply.from
        // It automatically handles method, headers, query string, and body
        return reply.from(targetUrl, {
          // Add headers to prevent caching
          rewriteRequestHeaders: (req, headers) => {
            return {
              ...headers,
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            };
          },
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

  // --- Zap Routes ---

  // Schema for creating a zap
  const CreateZapSchema = z.object({
    amount: z
      .number()
      .int()
      .positive("Amount must be a positive integer (sats)"),
    zapType: z.nativeEnum(ZapType),
    comment: z.string().optional(),
  });

  // Route to create a zap and generate an invoice
  fastify.post<{
    Params: { id: string };
    Body: z.infer<typeof CreateZapSchema>;
  }>("/:id/zaps", async (request, reply) => {
    const { id } = request.params;
    const appId = parseInt(id, 10);

    if (isNaN(appId)) {
      return reply.code(400).send({ message: "Invalid App ID format." });
    }

    // Validate request body
    const validationResult = CreateZapSchema.safeParse(request.body);
    if (!validationResult.success) {
      return reply.code(400).send({
        message: "Invalid request body.",
        errors: validationResult.error.errors,
      });
    }
    const { amount, zapType, comment } = validationResult.data;

    try {
      // Verify app exists
      const app = await prisma.app.findUnique({
        where: { id: appId },
        select: { id: true }, // Only need to confirm existence
      });
      if (!app) {
        return reply.code(404).send({ message: "App not found." });
      }

      // Get NWC URL from environment
      const nwcUrl = process.env.SERVICE_NWC_URL;
      if (!nwcUrl) {
        fastify.log.error("SERVICE_NWC_URL is not configured.");
        return reply
          .code(500)
          .send({ message: "NWC service is not configured." });
      }

      // Initialize NWC client
      const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });

      try {
        // Generate invoice
        const description = comment || `Zap for App #${appId} (${zapType})`;
        const invoiceResponse = await client.makeInvoice({
          amount: amount * 1000, // Convert sats to msats for NWC
          description: description,
          // Add expiry if needed, e.g., expiry: 3600 // 1 hour
        });

        if (!invoiceResponse || !invoiceResponse.invoice) {
          throw new Error("Failed to generate invoice via NWC.");
        }

        // Create Zap record in DB
        const zap = await prisma.zap.create({
          data: {
            appId: appId,
            amount: amount, // Store amount in sats
            type: zapType,
            comment: comment,
            invoice: invoiceResponse.invoice,
            paid: false,
          },
          select: {
            id: true,
            invoice: true,
          },
        });

        fastify.log.info(
          `Created Zap ${zap.id} for App ${appId}, amount: ${amount} sats.`
        );
        return reply.code(201).send({ invoice: zap.invoice, zapId: zap.id });
      } finally {
        client.close();
      }
    } catch (error) {
      fastify.log.error(error, `Failed to create zap for App ID: ${appId}`);
      // Check for specific NWC errors if possible/needed
      return reply.code(500).send({ message: "Internal Server Error." });
    }
  });

  // Route to get paid zaps for an app
  fastify.get<{ Params: { id: string } }>(
    "/:id/zaps",
    async (request, reply) => {
      const { id } = request.params;
      const appId = parseInt(id, 10);

      if (isNaN(appId)) {
        return reply.code(400).send({ message: "Invalid App ID format." });
      }

      try {
        // Verify app exists first (optional, but good practice)
        const appExists = await prisma.app.count({ where: { id: appId } });
        if (appExists === 0) {
          return reply.code(404).send({ message: "App not found." });
        }

        // Fetch paid zaps for the app, ordered by amount descending
        const zaps = await prisma.zap.findMany({
          where: {
            appId: appId,
            paid: true, // Only fetch paid zaps
          },
          select: {
            id: true,
            amount: true,
            type: true,
            comment: true,
            createdAt: true,
          },
          orderBy: {
            amount: "desc", // Order by highest amount first
          },
        });

        return reply.send(zaps);
      } catch (error) {
        fastify.log.error(error, `Failed to fetch zaps for App ID: ${appId}`);
        return reply.code(500).send({ message: "Internal Server Error." });
      }
    }
  );
  // Route to check zap payment status
  fastify.get<{ Params: { appId: string; zapId: string } }>(
    "/:appId/zaps/:zapId/status",
    async (request, reply) => {
      const { appId: appIdStr, zapId: zapIdStr } = request.params;
      const appId = parseInt(appIdStr, 10);
      const zapId = parseInt(zapIdStr, 10);

      if (isNaN(appId) || isNaN(zapId)) {
        return reply
          .code(400)
          .send({ message: "Invalid App ID or Zap ID format." });
      }

      try {
        // Fetch zap record
        // Fetch zap record including amount and type for potential update
        const zap = await prisma.zap.findUnique({
          where: { id: zapId },
          select: {
            id: true,
            appId: true,
            paid: true,
            invoice: true,
            amount: true,
            type: true,
          },
        });

        if (!zap) {
          return reply.code(404).send({ message: "Zap record not found." });
        }

        // Verify zap belongs to the correct app
        if (zap.appId !== appId) {
          return reply
            .code(403)
            .send({ message: "Zap does not belong to this app." });
        }

        // If already marked as paid, return immediately
        if (zap.paid) {
          return reply.send({ paid: true });
        }

        // Get NWC URL from environment
        const nwcUrl = process.env.SERVICE_NWC_URL;
        if (!nwcUrl) {
          fastify.log.error("SERVICE_NWC_URL is not configured.");
          return reply
            .code(500)
            .send({ message: "NWC service is not configured." });
        }

        // Initialize NWC client
        const client = new nwc.NWCClient({ nostrWalletConnectUrl: nwcUrl });

        let paid = false;
        try {
          // Look up invoice status
          const lookupResponse = await client.lookupInvoice({
            invoice: zap.invoice,
          });
          paid = !!lookupResponse.preimage;
        } finally {
          client.close();
        }

        // If NWC confirms payment AND the zap is not already marked paid in DB
        if (paid && !zap.paid) {
          const amountChange =
            zap.type === ZapType.UPZAP ? zap.amount : -zap.amount;

          try {
            // Use transaction to update both Zap and App atomically
            await prisma.$transaction([
              prisma.zap.update({
                where: { id: zapId },
                data: { paid: true },
              }),
              prisma.app.update({
                where: { id: appId },
                data: {
                  zapAmount: {
                    increment: amountChange,
                  },
                },
              }),
            ]);
            fastify.log.info(
              `Zap ${zapId} for App ${appId} marked as paid. App zapAmount updated by ${amountChange}.`
            );
          } catch (txError) {
            fastify.log.error(
              txError,
              `Transaction failed when updating paid status/zapAmount for Zap ID: ${zapId}`
            );
            // Don't block response, but log the error. The zap is paid according to NWC.
          }
        }
        // Return paid status based on NWC check
        return reply.send({ paid });
      } catch (error) {
        fastify.log.error(
          error,
          `Failed to check status for Zap ID: ${zapId}, App ID: ${appId}`
        );
        // Check for specific NWC errors if possible/needed
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
  prompt: string,
  model: string | undefined, // Add model parameter
  abortSignal: AbortSignal // Add AbortSignal parameter
) {
  let fullOutput = ""; // Store the full AI output
  let generatedHtml: string | null = null;
  let generatedDenoCode: string | null = null;
  let generatedCharsCount = 0;
  let lastUpdateTime = 0; // Track last DB update time for throttling
  const throttleInterval = 1000; // Update DB at most every 1 second
  const seed = Math.floor(Math.random() * 21_000_000);

  try {
    if (abortSignal.aborted) {
      fastify.log.info(
        `Generation for app ${appId} cancelled before starting.`
      );
      // Ensure state is FAILED if aborted.
      await prisma.app.update({
        where: { id: appId },
        data: {
          state: AppState.FAILED,
          errorMessage: "Generation cancelled by user.",
        },
      });
      return;
    }

    // based on the prompt we give it specific knowledge
    const { systemPrompt, segmentNames } = await generateSystemPrompt(
      prompt,
      seed,
      model // Pass model to system prompt generation
    );

    await prisma.app.update({
      where: { id: appId },
      data: {
        systemPrompt,
        systemPromptSegmentNames: segmentNames.join(","),
        model, // Save the model used for this generation
      },
    });

    // Get the stream from the updated executePrompt
    const outputStream = executePrompt(
      prompt,
      systemPrompt,
      seed,
      model,
      abortSignal
    ); // Pass model and abortSignal

    let currentLine = "";
    // Process the stream chunk by chunk
    for await (const chunk of outputStream) {
      if (abortSignal.aborted) {
        fastify.log.info(
          `Generation for app ${appId} was cancelled during streaming.`
        );
        // The state might have been set by the PUT route, or we set it here.
        const app = await prisma.app.findUnique({
          where: { id: appId },
          select: { state: true },
        });
        if (app && app.state !== AppState.FAILED) {
          await prisma.app.update({
            where: { id: appId },
            data: {
              state: AppState.FAILED,
              errorMessage: "Generation cancelled by user.",
            },
          });
        }
        return; // Exit the function
      }

      if (generatedCharsCount === 0) {
        // Mark as GENERATING once we get first chunk back
        await prisma.app.update({
          where: { id: appId },
          data: { state: AppState.GENERATING, seed },
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

    if (abortSignal.aborted) {
      fastify.log.info(
        `Generation for app ${appId} was cancelled after streaming finished but before final processing.`
      );
      const app = await prisma.app.findUnique({
        where: { id: appId },
        select: { state: true },
      });
      if (app && app.state !== AppState.FAILED) {
        await prisma.app.update({
          where: { id: appId },
          data: {
            state: AppState.FAILED,
            errorMessage: "Generation cancelled by user.",
          },
        });
      }
      return;
    }

    // --- Parse the full output ---
    const htmlStartMarker = "<html";
    const htmlEndMarker = "</html>";
    const denoStartMarker = "// DENO_START";
    const denoEndMarker = "// DENO_END";

    const htmlStartIndex = fullOutput.indexOf(htmlStartMarker);
    const htmlEndIndex = fullOutput.indexOf(htmlEndMarker);
    const denoStartIndex = fullOutput.indexOf(denoStartMarker);
    const denoEndIndex = fullOutput.indexOf(denoEndMarker);

    console.log("Full output", fullOutput);

    if (htmlStartIndex !== -1 && htmlEndIndex !== -1) {
      generatedHtml = fullOutput
        .substring(htmlStartIndex, htmlEndIndex + htmlEndMarker.length)
        .trim();
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
        fullOutput,
      },
    });

    // Generate title and evaluate prompt after successful HTML generation
    fastify.log.info(`App ${appId} generating title and evaluating prompt...`);
    const [generatedTitle, promptEvaluation] = await Promise.all([
      generateAppTitle(generatedHtml, seed, model), // Pass model
      evaluatePrompt(prompt, systemPrompt, seed, model), // Pass model
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
    // Check if cancellation was the cause
    if (abortSignal.aborted) {
      fastify.log.info(
        `Generation for app ${appId} was aborted, error caught: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // State should have been set to FAILED already by the abort check or the PUT route.
      // If not, set it here.
      const app = await prisma.app.findUnique({
        where: { id: appId },
        select: { state: true },
      });
      if (app && app.state !== AppState.FAILED) {
        await prisma.app.update({
          where: { id: appId },
          data: {
            state: AppState.FAILED,
            errorMessage: "Generation cancelled by user.",
          },
        });
      }
    } else {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
  } finally {
    // Always remove the controller from the map when generation finishes or is aborted
    activeGenerations.delete(appId);
    fastify.log.info(
      `Removed AbortController for app ${appId} from activeGenerations.`
    );
  }
}

export default appRoutes;

// --- Helper Function for Backend Activity ---

type BackendActivityStatus = "READY" | "STARTING" | "BUSY" | "NO_BACKEND";

/**
 * Checks backend status, resets inactivity timer if running,
 * or attempts to auto-start if stopped.
 * Returns a status indicating the backend's readiness for proxying.
 */
async function handleBackendActivity(
  appId: number,
  app: { denoCode: string | null; backendState: BackendState | null },
  denoManager: DenoManager,
  logger: FastifyInstance["log"]
): Promise<BackendActivityStatus> {
  if (!app.denoCode) {
    return "NO_BACKEND";
  }

  switch (app.backendState) {
    case BackendState.RUNNING:
      denoManager.resetInactivityTimer(appId);
      return "READY";

    case BackendState.STOPPED:
    case BackendState.FAILED_TO_START:
      logger.info(
        `Attempting to auto-start backend for app ${appId} due to activity.`
      );
      // Start backend (fire-and-forget)
      try {
        await denoManager.startAppBackend(appId);
        return "READY";
      } catch (err) {
        logger.error(
          err,
          `Error auto-starting backend for app ${appId} on activity`
        );
        // FIXME: use error status
        return "BUSY";
      }

    case BackendState.STARTING:
    case BackendState.STOPPING:
      logger.info(`Backend for app ${appId} is busy (${app.backendState}).`);
      return "BUSY";

    default:
      // Should not happen, but treat unknown/null state as busy
      logger.warn(
        `Unexpected backend state for app ${appId}: ${app.backendState}`
      );
      return "BUSY";
  }
}

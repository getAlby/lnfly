import { App, BackendState, PrismaClient } from "@prisma/client";
import { ChildProcess, spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
// We might need a port finding library later, e.g., 'get-port'
// import getPort from 'get-port';

interface RunningAppInfo {
  process: ChildProcess;
  port: number;
  tempFilePath: string;
  lastActivityTime: number; // Timestamp of the last known activity
  inactivityTimeoutId: NodeJS.Timeout | null; // Timer for automatic shutdown
}

// Constants
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

// Simple port management - find the next available port starting from a base
// WARNING: This is basic and might have race conditions in high concurrency.
// Consider using a library like 'get-port' for robustness.
let nextPort = 9000; // Starting port for Deno apps
async function findAvailablePort(): Promise<number> {
  // In a real scenario, we'd check if the port is actually free.
  // For now, just increment.
  const port = nextPort;
  nextPort++;
  return port;
}

export class DenoManager {
  private runningApps: Map<number, RunningAppInfo> = new Map();
  private prisma: PrismaClient;
  private readonly inactivityTimeoutMs: number;

  constructor(
    prisma: PrismaClient,
    inactivityTimeoutMs = INACTIVITY_TIMEOUT_MS
  ) {
    this.prisma = prisma;
    this.inactivityTimeoutMs = inactivityTimeoutMs;
    console.log(
      `DenoManager initialized with inactivity timeout: ${
        this.inactivityTimeoutMs / 1000 / 60
      } minutes.`
    );
  }

  async initializeManager(): Promise<void> {
    console.log("Initializing DenoManager: Resetting backend states...");
    try {
      const result = await this.prisma.app.updateMany({
        where: {
          backendState: {
            in: [
              BackendState.RUNNING,
              BackendState.STARTING,
              BackendState.STOPPING,
            ],
          },
        },
        data: {
          backendState: BackendState.STOPPED,
          backendPort: null,
        },
      });
      console.log(`Reset state for ${result.count} apps.`);
    } catch (error) {
      console.error(
        "Error resetting app backend states during initialization:",
        error
      );
    }
  }

  async startAppBackend(appId: number): Promise<void> {
    console.log(`Attempting to start backend for app ${appId}...`);

    if (this.runningApps.has(appId)) {
      console.log(
        `Backend for app ${appId} is already managed (likely running or starting).`
      );
      return;
    }

    let app: App | null = null;
    try {
      // 1. Fetch App Data
      app = await this.prisma.app.findUnique({
        where: { id: appId },
      });

      if (!app) {
        throw new Error(`App ${appId} not found.`);
      }

      if (!app.denoCode) {
        console.log(`App ${appId} has no Deno code. Skipping backend start.`);
        return;
      }

      if (
        app.backendState !== BackendState.STOPPED &&
        app.backendState !== BackendState.FAILED_TO_START
      ) {
        console.log(
          `App ${appId} backend state is ${app.backendState}, cannot start.`
        );
        // Potentially sync with runningApps map if inconsistent
        if (!this.runningApps.has(appId)) {
          console.warn(
            `DB state for ${appId} is ${app.backendState} but not tracked in manager. Resetting.`
          );
          await this.prisma.app.update({
            where: { id: appId },
            data: { backendState: BackendState.STOPPED, backendPort: null },
          });
        } else {
          return; // Already tracked, likely starting/running
        }
      }

      // 2. Update state to STARTING
      await this.prisma.app.update({
        where: { id: appId },
        data: { backendState: BackendState.STARTING, backendPort: null },
      });
      console.log(`App ${appId} state set to STARTING.`);

      // 3. Find Available Port
      const port = await findAvailablePort();
      console.log(`Assigning port ${port} to app ${appId}.`);

      // 4. Write Deno code to temporary file
      const tempDir = path.join(os.tmpdir(), "lnfly_deno_apps");
      await fs.mkdir(tempDir, { recursive: true });
      const tempFilePath = path.join(tempDir, `app_${appId}_${Date.now()}.ts`);

      let processedDenoCode = app.denoCode;
      // in case the AI is dumb and also adds the proxy on the backend too
      processedDenoCode = processedDenoCode.replaceAll("/PROXY/", "/");

      await fs.writeFile(tempFilePath, processedDenoCode);
      console.log(`Deno code for app ${appId} written to ${tempFilePath}`);

      // 5. Prepare Storage
      const workDir = process.env.WORK_DIR || "."; // Use WORK_DIR or fallback to current dir
      const storageDir = path.join(workDir, "apps", app.id.toString());
      const storagePath = path.join(storageDir, "storage.json");

      await fs.mkdir(storageDir, { recursive: true });
      console.log(`Ensured storage directory exists: ${storageDir}`);

      // 6. Spawn Deno Process
      const denoProcess = spawn(
        process.env.DENO_PATH || "deno",
        [
          "run",
          "--allow-net", // Network access (for fetch, NWC, etc.)
          `--allow-env=PORT,NWC_URL,STORAGE_PATH`, // Environment variables
          `--allow-read=${storagePath}`, // Read access ONLY to the storage file
          `--allow-write=${storagePath}`, // Write access ONLY to the storage file
          "--v8-flags=--max-heap-size=32,--max-old-space-size=32", // Resource limits
          tempFilePath, // The temporary script file
        ],
        {
          env: {
            ...process.env,
            PORT: port.toString(),
            // Use app-specific NWC URL if available, otherwise fallback to default
            NWC_URL: app.nwcUrl || process.env.DEFAULT_NWC_URL,
            STORAGE_PATH: storagePath, // Pass the storage path to the Deno app
          },
          stdio: ["ignore", "pipe", "pipe"], // Pipe stdout/stderr
        }
      );

      // Store process info immediately
      const appInfo: RunningAppInfo = {
        process: denoProcess,
        port,
        tempFilePath,
        lastActivityTime: Date.now(), // Initialize activity time
        inactivityTimeoutId: null, // Initialize timeout ID
      };
      this.runningApps.set(appId, appInfo);
      console.log(
        `Deno process spawned for app ${appId} (PID: ${denoProcess.pid})`
      );

      let startupTimeout: NodeJS.Timeout | null = null;
      let hasStarted = false;

      // Simple check: Assume started after a short delay if no immediate error
      await new Promise<void>((resolve, reject) => {
        startupTimeout = setTimeout(async () => {
          if (!hasStarted && !denoProcess.killed) {
            hasStarted = true;
            console.log(
              `App ${appId} assumed started successfully on port ${port}.`
            );
            try {
              await this.prisma.app.update({
                where: { id: appId },
                data: { backendState: BackendState.RUNNING, backendPort: port },
              });
              console.log(`App ${appId} state updated to RUNNING.`);
              // Start the inactivity timer now that the app is confirmed running
              this.scheduleInactivityCheck(appId);
              resolve();
            } catch (dbError) {
              console.error(
                `Failed to update app ${appId} state to RUNNING:`,
                dbError
              );
              // Attempt to kill process if DB update fails after start
              await this.stopAppBackend(appId);
              reject();
            }
          }
        }, 5000); // 5 second timeout for startup
      });

      // 6. Listen for process events
      denoProcess.stdout?.on("data", (data) => {
        console.log(`[App ${appId} STDOUT]: ${data.toString().trim()}`);
        // Potentially detect successful startup message here if Deno code logs one
      });

      denoProcess.stderr?.on("data", (data) => {
        // Just log stderr, don't treat it as an error here
        console.log(`[App ${appId} STDERR]: ${data.toString().trim()}`);
      });

      denoProcess.on("error", async (err) => {
        console.error(`Failed to spawn Deno process for app ${appId}:`, err);
        if (startupTimeout) clearTimeout(startupTimeout);
        hasStarted = true;
        await this.handleProcessExit(
          appId,
          1,
          tempFilePath,
          `Spawn Error: ${err.message}`
        );
      });

      denoProcess.on("close", async (code) => {
        const exitCode = code ?? 1; // Assume error if code is null
        console.log(
          `Deno process for app ${appId} exited with code ${exitCode}.`
        );
        if (startupTimeout) clearTimeout(startupTimeout);

        const wasStillStarting = !hasStarted;
        hasStarted = true; // Mark as definitely not starting anymore

        // Determine if this exit constitutes a startup failure
        // A non-zero exit code (excluding SIGTERM 143) before the startup timer completes means failure.
        const isStartupFailure =
          wasStillStarting && exitCode !== 0 && exitCode !== 143;

        let errorMessage: string | undefined = undefined;
        if (isStartupFailure) {
          errorMessage = `Startup Failure: Process exited with code ${exitCode} before startup timeout.`;
          console.error(`App ${appId} failed to start. ${errorMessage}`);
        }

        // Pass the specific error message only if it was a startup failure
        await this.handleProcessExit(
          appId,
          exitCode,
          tempFilePath,
          errorMessage
        );
      });
    } catch (error) {
      console.error(`Error starting backend for app ${appId}:`, error);
      // Ensure state is reset if failure occurred before process spawn
      if (appId && !this.runningApps.has(appId)) {
        try {
          await this.prisma.app.update({
            where: { id: appId },
            data: {
              backendState: BackendState.FAILED_TO_START,
              backendPort: null,
              // Optionally store error message if schema supports it
            },
          });
        } catch (dbError) {
          console.error(
            `Failed to update app ${appId} state to FAILED_TO_START after error:`,
            dbError
          );
        }
      }
      // If process was spawned but error occurred, rely on exit/error handlers
    }
  }

  async stopAppBackend(appId: number): Promise<void> {
    const appInfo = this.runningApps.get(appId);
    console.log(`Attempting to stop backend for app ${appId}...`);

    if (!appInfo) {
      console.log(
        `Backend for app ${appId} is not currently tracked as running.`
      );
      // Optional: Check DB state and update if inconsistent
      try {
        const app = await this.prisma.app.findUnique({
          where: { id: appId },
          select: { backendState: true },
        });
        if (
          app &&
          app.backendState !== BackendState.STOPPED &&
          app.backendState !== BackendState.FAILED_TO_START
        ) {
          console.warn(
            `App ${appId} state in DB is ${app.backendState}, but not tracked. Forcing STOPPED state.`
          );
          await this.prisma.app.update({
            where: { id: appId },
            data: { backendState: BackendState.STOPPED, backendPort: null },
          });
        }
      } catch (dbError) {
        console.error(
          `Error checking DB state for untracked app ${appId} during stop:`,
          dbError
        );
      }
      return;
    }

    // Clear any pending inactivity timeout before stopping
    if (appInfo.inactivityTimeoutId) {
      clearTimeout(appInfo.inactivityTimeoutId);
      appInfo.inactivityTimeoutId = null;
      console.log(`Cleared inactivity timer for app ${appId} during stop.`);
    }

    try {
      // 1. Update state to STOPPING
      // Avoid DB update if already stopped/failed
      const currentDbState = await this.prisma.app.findUnique({
        where: { id: appId },
        select: { backendState: true },
      });
      if (
        currentDbState?.backendState === BackendState.RUNNING ||
        currentDbState?.backendState === BackendState.STARTING
      ) {
        await this.prisma.app.update({
          where: { id: appId },
          data: { backendState: BackendState.STOPPING },
        });
        console.log(`App ${appId} state set to STOPPING.`);
      } else {
        console.log(
          `App ${appId} DB state is already ${currentDbState?.backendState}, skipping STOPPING update.`
        );
      }

      // 2. Terminate Process
      console.log(`Killing process ${appInfo.process.pid} for app ${appId}.`);
      appInfo.process.kill("SIGTERM"); // Send SIGTERM first

      // Optional: Add a timeout and SIGKILL if SIGTERM doesn't work
      const killTimeout = setTimeout(() => {
        if (!appInfo.process.killed) {
          console.warn(
            `Process ${appInfo.process.pid} for app ${appId} did not exit after SIGTERM, sending SIGKILL.`
          );
          appInfo.process.kill("SIGKILL");
        }
      }, 5000); // 5 seconds grace period

      // Process exit handler ('close' event) will call handleProcessExit
      // which removes from map and cleans up file. We ensure timeout is cleared there.
      appInfo.process.on("close", () => clearTimeout(killTimeout));
    } catch (error) {
      console.error(`Error stopping backend for app ${appId}:`, error);
      // Attempt to cleanup map entry even if DB update or kill fails
      if (this.runningApps.has(appId)) {
        this.runningApps.delete(appId);
        console.log(
          `Removed app ${appId} from tracking due to error during stop.`
        );
        // Attempt to cleanup temp file if path is known
        if (appInfo?.tempFilePath) {
          this.cleanupTempFile(appInfo.tempFilePath);
        }
      }
      // Optionally try to set DB state to STOPPED as a fallback
      try {
        await this.prisma.app.update({
          where: { id: appId },
          data: { backendState: BackendState.STOPPED, backendPort: null },
        });
      } catch (dbError) {
        console.error(
          `Failed fallback DB update to STOPPED for app ${appId}:`,
          dbError
        );
      }
    }
  }

  private async handleProcessExit(
    appId: number,
    exitCode: number,
    tempFilePath: string,
    errorMessage?: string
  ): Promise<void> {
    console.log(
      `Handling exit for app ${appId}. Exit code: ${exitCode}. Error: ${errorMessage}`
    );
    const appInfo = this.runningApps.get(appId); // Get info *before* deleting

    // Clear inactivity timer if it exists (e.g., unexpected exit)
    if (appInfo?.inactivityTimeoutId) {
      clearTimeout(appInfo.inactivityTimeoutId);
      // No need to set appInfo.inactivityTimeoutId = null, as appInfo is removed below
      console.log(
        `Cleared inactivity timer for app ${appId} during exit handling.`
      );
    }

    // Remove from tracking map
    this.runningApps.delete(appId);
    console.log(`Removed app ${appId} from running apps tracking.`);

    // Cleanup temp file
    this.cleanupTempFile(tempFilePath);

    // Update DB state based on exit code
    const finalState =
      exitCode === 0 || exitCode === 143 // 0 = clean exit, 143 = SIGTERM
        ? BackendState.STOPPED
        : BackendState.FAILED_TO_START; // Treat any other non-zero exit as failure

    try {
      await this.prisma.app.update({
        where: { id: appId },
        data: {
          backendState: finalState,
          backendPort: null,
          // Optionally add errorMessage if schema supports it
        },
      });
      console.log(`App ${appId} final state set to ${finalState} in DB.`);
    } catch (dbError) {
      console.error(
        `Failed to update final DB state for app ${appId} after exit:`,
        dbError
      );
    }
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`Cleaned up temporary file: ${filePath}`);
    } catch (error: any) {
      // Ignore file not found errors (might happen if cleanup runs twice)
      if (error.code !== "ENOENT") {
        console.error(`Error deleting temporary file ${filePath}:`, error);
      }
    }
  }

  async getBackendStatus(appId: number): Promise<BackendState | null> {
    // Primarily rely on DB state as the source of truth, but check map consistency
    try {
      const app = await this.prisma.app.findUnique({
        where: { id: appId },
        select: { backendState: true },
      });

      if (!app) return null;

      // Consistency check (optional but helpful)
      const trackedInfo = this.runningApps.get(appId);
      if (
        trackedInfo &&
        (app.backendState === BackendState.STOPPED ||
          app.backendState === BackendState.FAILED_TO_START)
      ) {
        console.warn(
          `App ${appId} is tracked but DB state is ${app.backendState}. Removing from tracking.`
        );
        this.runningApps.delete(appId);
        this.cleanupTempFile(trackedInfo.tempFilePath);
      } else if (
        !trackedInfo &&
        (app.backendState === BackendState.RUNNING ||
          app.backendState === BackendState.STARTING ||
          app.backendState === BackendState.STOPPING)
      ) {
        console.warn(
          `App ${appId} is not tracked but DB state is ${app.backendState}. Resetting DB state.`
        );
        await this.prisma.app.update({
          where: { id: appId },
          data: { backendState: BackendState.STOPPED, backendPort: null },
        });
        return BackendState.STOPPED;
      }

      return app.backendState;
    } catch (error) {
      console.error(`Error fetching backend status for app ${appId}:`, error);
      return null; // Or rethrow, depending on desired error handling
    }
  }

  async stopAllBackends(): Promise<void> {
    console.log("Stopping all managed Deno backends...");
    const stopPromises: Promise<void>[] = [];
    // Create a copy of keys to avoid issues while iterating and modifying the map
    const appIds = Array.from(this.runningApps.keys());
    for (const appId of appIds) {
      stopPromises.push(this.stopAppBackend(appId));
    }
    try {
      await Promise.all(stopPromises);
      console.log("Finished stopping all backends.");
    } catch (error) {
      console.error("Error during stopAllBackends:", error);
    }
  }

  // --- Inactivity Timer Methods ---

  /**
   * Resets the inactivity timer for a given app.
   * Should be called whenever there's activity related to the app (e.g., proxy request, view).
   */
  public resetInactivityTimer(appId: number): void {
    const appInfo = this.runningApps.get(appId);
    if (appInfo) {
      appInfo.lastActivityTime = Date.now();
      console.log(`Resetting inactivity timer for app ${appId}.`);
      this.scheduleInactivityCheck(appId); // Reschedule the check
    } else {
      // This might happen if the app stopped between the check and the reset call, which is fine.
      console.log(
        `Attempted to reset inactivity timer for non-running app ${appId}.`
      );
    }
  }

  /**
   * Schedules the next inactivity check for an app. Clears any existing timeout.
   */
  private scheduleInactivityCheck(appId: number): void {
    const appInfo = this.runningApps.get(appId);
    if (!appInfo) {
      console.warn(
        `Cannot schedule inactivity check for non-running app ${appId}.`
      );
      return;
    }

    // Clear existing timer if any
    if (appInfo.inactivityTimeoutId) {
      clearTimeout(appInfo.inactivityTimeoutId);
    }

    console.log(
      `Scheduling inactivity check for app ${appId} in ${
        this.inactivityTimeoutMs / 1000
      } seconds.`
    );

    appInfo.inactivityTimeoutId = setTimeout(() => {
      this.handleInactivityTimeout(appId);
    }, this.inactivityTimeoutMs);

    // Allow the Node.js process to exit even if this timer is pending
    appInfo.inactivityTimeoutId.unref();
  }

  /**
   * Handles the timeout event when an app becomes inactive.
   */
  private handleInactivityTimeout(appId: number): void {
    console.log(
      `Inactivity timeout reached for app ${appId}. Stopping backend...`
    );
    // Check if app is still running before stopping (might have been stopped manually)
    if (this.runningApps.has(appId)) {
      this.stopAppBackend(appId).catch((error) => {
        console.error(
          `Error stopping inactive app ${appId} from timeout handler:`,
          error
        );
      });
    } else {
      console.log(
        `App ${appId} was already stopped when inactivity timeout fired.`
      );
    }
  }
}

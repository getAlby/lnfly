import LNFlyHeading from "@/components/LNFlyHeading"; // Import LNFlyHeading
import { Button } from "@/components/ui/button"; // Import Button
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Import Card components
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/clipboard";
import { CopyIcon, InfoIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

// Define the expected structure of the app data from the API
interface AppData {
  id: number;
  title: string | null;
  // prompt: string; // We might not need the full prompt here
  state: "INITIALIZING" | "GENERATING" | "COMPLETED" | "FAILED";
  numChars?: number;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  lightningAddress?: string | null;
}

const POLLING_INTERVAL = 3000; // Poll every 3 seconds

function AppStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightningAddress, setLightningAddress] = useState("");
  const [showLearnMoreModal, setShowLearnMoreModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID

  const editKey = window.localStorage.getItem(`app_${id}_editKey`);
  const previewKey = window.localStorage.getItem(`app_${id}_previewKey`);

  const setAppPublished = async (published: boolean) => {
    if (!id || !editKey) {
      console.error("Cannot publish: Missing App ID or edit key.");
      alert("Error: Missing App ID or edit key.");
      return;
    }
    if (
      published &&
      !confirm("By publishing your app will be visible on the home page.")
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          published,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to publish app: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      // App published successfully, refetch status to update UI
      toast(
        `App ${id} ${published ? "published" : "unpublished"} successfully.`
      );
      fetchStatus(); // Refetch status to update the UI
    } catch (error) {
      console.error("Error publishing app:", error);
      alert(
        `Error publishing app: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  const saveLightningAddress = async () => {
    if (!id || !editKey) {
      console.error("Cannot set address: Missing App ID or edit key.");
      alert("Error: Missing App ID or edit key.");
      return;
    }
    // Basic validation (optional: add more robust validation)
    if (!lightningAddress || !lightningAddress.includes("@")) {
      alert(
        "Please enter a valid Lightning Address (e.g., yourname@getalby.com)."
      );
      return;
    }

    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lightningAddress }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to set Lightning Address: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      toast(`Lightning Address updated successfully.`);
    } catch (error) {
      console.error("Error setting Lightning Address:", error);
      alert(
        `Error setting Lightning Address: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  const fetchStatus = useCallback(
    async (isInitialLoad = false) => {
      if (!isInitialLoad && !isLoading) setIsLoading(true); // Show loading indicator on subsequent polls unless already loading
      if (isInitialLoad) setError(null); // Clear error on initial load attempt

      try {
        const response = await fetch(`/api/apps/${id}?editKey=${editKey}`);
        if (!response.ok) {
          // Stop polling on 404 Not Found
          if (response.status === 404) {
            setError(`App with ID ${id} not found.`);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return; // Exit fetch function
          }
          const errorText = await response.text();
          throw new Error(
            `HTTP error! status: ${response.status} - ${
              errorText || "Failed to fetch status."
            }`
          );
        }
        const data: AppData = await response.json();
        if (data.state === "COMPLETED" && appData?.state === "GENERATING") {
          toast("App ready!");
        }
        setAppData(data);
        if (!lightningAddress) {
          setLightningAddress(data.lightningAddress || ""); // Initialize input with fetched data
        }
        setError(null); // Clear error on successful fetch

        // Stop polling if the process is finished (completed or failed)
        if (data.state === "COMPLETED" || data.state === "FAILED") {
          if (intervalRef.current) {
            console.log(`Polling stopped for App ${id}, state: ${data.state}`);
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      } catch (err) {
        console.error("Failed to fetch app status:", err);
        // Don't set error state on polling errors unless it's the initial load,
        // to avoid flickering UI if there's a temporary network issue.
        // Keep polling unless it's a fatal error like 404 handled above.
        if (isInitialLoad) {
          setError(
            err instanceof Error ? err.message : "An unknown error occurred."
          );
        }
      } finally {
        // Only set loading to false if it was set to true for this fetch
        setIsLoading(false);
      }
    },
    [appData?.state, editKey, id, isLoading]
  );

  const shouldPoll =
    appData?.state === "GENERATING" || appData?.state === "INITIALIZING";
  useEffect(() => {
    if (!id) {
      setError("No App ID provided.");
      setIsLoading(false);
      return;
    }

    console.log(`Starting status check for App ${id}`);
    fetchStatus(true); // Initial fetch

    // Set up polling only if not already completed/failed initially
    // We check appData state inside the interval callback as well
    intervalRef.current = setInterval(() => {
      // Check state *before* fetching again
      if (!shouldPoll) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
      } else {
        console.log(`Polling status for App ${id}...`);
        fetchStatus();
      }
    }, POLLING_INTERVAL);

    // Cleanup function to clear interval when component unmounts
    return () => {
      if (intervalRef.current) {
        console.log(`Clearing polling interval for App ${id} on unmount.`);
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus, id, shouldPoll]); // Rerun effect if ID changes

  // --- Render Logic ---

  if (isLoading && !appData) {
    // Show initial loading state
    return <div className="p-4 text-center">Loading app status...</div>;
  }

  if (error && !appData) {
    // Show error only if we have no data at all
    return <div className="p-4 text-red-500 text-center">Error: {error}</div>;
  }

  if (!appData) {
    // Should not happen if loading/error handled, but good fallback
    return <div className="p-4 text-center">Could not load app data.</div>;
  }

  // Determine status display and button state
  let statusMessage: string; // Explicitly type as string
  let statusColor = "text-gray-600";

  const buttonDisabled =
    appData.state !== "COMPLETED" || (!appData.published && !previewKey);

  // Set display strings/styles based on the actual state
  switch (appData.state) {
    case "INITIALIZING":
      statusMessage = "Initializing...";
      statusColor = "text-yellow-600";
      break;
    case "GENERATING":
      statusMessage = "Generating...";
      statusColor = "text-blue-600 animate-pulse"; // Add pulse animation
      break;
    case "COMPLETED":
      statusMessage = "Completed";
      statusColor = "text-green-600";
      break;
    case "FAILED":
      statusMessage = "Failed";
      statusColor = "text-red-600";
      break;
  }

  return (
    <div className="font-sans flex flex-col items-center min-h-screen py-8 px-4">
      <main className="flex-1 w-full flex-grow flex flex-col items-center justify-center">
        <LNFlyHeading />
        <div className="container mx-auto p-4 max-w-2xl">
          {" "}
          {/* Center content */}
          <Card>
            <CardHeader>
              <CardTitle>App {appData.id}</CardTitle>
              <CardDescription>Status for App ID: {appData.id}</CardDescription>
              {/* Display error alongside data if polling fails temporarily */}
              {error && (
                <p className="text-sm text-red-500 mt-2">Warning: {error}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Label className="pt-2">Prompt:</Label>
                  <div className="flex-grow relative">
                    <Textarea
                      value={appData.prompt}
                      readOnly
                      className="pr-10" // Add padding for the button
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-1 right-1 h-7 w-7" // Position button
                      onClick={() => copyToClipboard(appData.prompt || "")}
                      title="Copy prompt"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p>
                  Status:{" "}
                  <span className={`font-semibold ${statusColor}`}>
                    {statusMessage}
                  </span>
                </p>
                <p>
                  Published:{" "}
                  <span
                    className={`font-semibold ${
                      appData.published ? "text-green-500" : "text-gray-500"
                    }`}
                  >
                    {appData.published.toString()}
                  </span>
                </p>
                {!!appData.numChars && (
                  <p>
                    Characters Generated: {appData.numChars.toLocaleString()}
                  </p>
                )}
                {/* Progress component removed */}
                <p>Created: {new Date(appData.createdAt).toLocaleString()}</p>
                <p>
                  Last Update: {new Date(appData.updatedAt).toLocaleString()}
                </p>
              </div>

              {/* Lightning Address Input */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="lightning-address">Lightning Address</Label>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowLearnMoreModal(true)}
                  >
                    <InfoIcon className="w-4 h-4" />
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    id="lightning-address"
                    placeholder="yourname@getalby.com"
                    value={lightningAddress}
                    onChange={(e) => setLightningAddress(e.target.value)}
                  />
                  <Button onClick={saveLightningAddress}>Set</Button>
                </div>
              </div>

              {appData.state === "COMPLETED" && (
                <a
                  href={
                    buttonDisabled
                      ? "#"
                      : `/api/apps/${id}/view${
                          appData.published ? "" : `?previewKey=${previewKey}`
                        }`
                  }
                >
                  <Button
                    disabled={buttonDisabled}
                    className="mt-4 w-full" // Make button full width
                    size="lg" // Make button larger
                  >
                    {appData.published ? "View app" : "Preview unpublished app"}
                  </Button>
                </a>
              )}
              {!appData.published &&
                appData.state === "COMPLETED" &&
                editKey && (
                  <Button
                    disabled={buttonDisabled}
                    className="mt-4 w-full" // Make button full width
                    size="lg" // Make button larger
                    onClick={() => setAppPublished(true)}
                  >
                    Publish app
                  </Button>
                )}
              {appData.published &&
                appData.state === "COMPLETED" &&
                editKey && (
                  <Button
                    disabled={buttonDisabled}
                    variant="destructive"
                    className="mt-4 w-full" // Make button full width
                    size="lg" // Make button larger
                    onClick={() => setAppPublished(false)}
                  >
                    Unpublish app
                  </Button>
                )}
            </CardContent>
          </Card>
        </div>
      </main>
      {/* Learn More Modal */}
      {showLearnMoreModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">
              What is a Lightning Address?
            </h3>
            <p className="mb-4">
              Set your lightning address to earn when users pay within your app.
              You can get a lightning address at:
            </p>
            <ul className="list-disc list-inside mb-4">
              <li>
                <a
                  href="https://getalby.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  https://getalby.com
                </a>
              </li>
              <li>
                <a
                  href="https://coinos.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  https://coinos.io
                </a>
              </li>
            </ul>
            <Button
              onClick={() => setShowLearnMoreModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppStatusPage;

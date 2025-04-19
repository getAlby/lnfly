import { Button } from "@/components/ui/button"; // Import Button
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"; // Import Card components
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

// Define the expected structure of the app data from the API
interface AppData {
  id: number;
  title: string | null;
  // prompt: string; // We might not need the full prompt here
  state: "INITIALIZING" | "GENERATING" | "COMPLETED" | "FAILED";
  numChars: number;
  createdAt: string;
  updatedAt: string;
}

const POLLING_INTERVAL = 3000; // Poll every 3 seconds

function AppStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null); // Ref to store interval ID

  const fetchStatus = async (isInitialLoad = false) => {
    if (!isInitialLoad && !isLoading) setIsLoading(true); // Show loading indicator on subsequent polls unless already loading
    if (isInitialLoad) setError(null); // Clear error on initial load attempt

    try {
      const response = await fetch(`/api/apps/${id}`);
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
      setAppData(data);
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
  };

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
      if (
        appData &&
        (appData.state === "COMPLETED" || appData.state === "FAILED")
      ) {
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
  }, [id]); // Rerun effect if ID changes

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
  let buttonDisabled = true;
  let buttonText = "View App (Processing...)"; // Default button text

  // Set display strings/styles based on the actual state
  switch (appData.state) {
    case "INITIALIZING":
      statusMessage = "Initializing...";
      statusColor = "text-yellow-600";
      buttonText = "View App (Initializing...)";
      break;
    case "GENERATING":
      statusMessage = "Generating...";
      statusColor = "text-blue-600 animate-pulse"; // Add pulse animation
      buttonText = "View App (Generating...)";
      break;
    case "COMPLETED":
      statusMessage = "Completed";
      statusColor = "text-green-600";
      buttonDisabled = false; // Enable button only on success
      buttonText = "View App";
      break;
    case "FAILED":
      statusMessage = "Failed";
      statusColor = "text-red-600";
      buttonText = "Generation Failed"; // Update button text for failure
      break;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      {" "}
      {/* Center content */}
      <Card>
        <CardHeader>
          <CardTitle>App Status</CardTitle>
          <CardDescription>Status for App ID: {appData.id}</CardDescription>
          {/* Display error alongside data if polling fails temporarily */}
          {error && (
            <p className="text-sm text-red-500 mt-2">Warning: {error}</p>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>
              Status:{" "}
              <span className={`font-semibold ${statusColor}`}>
                {statusMessage}
              </span>
            </p>
            <p>Characters Generated: {appData.numChars.toLocaleString()}</p>
            {/* Progress component removed */}
            <p>Created: {new Date(appData.createdAt).toLocaleString()}</p>
            <p>Last Update: {new Date(appData.updatedAt).toLocaleString()}</p>
          </div>

          <Button
            asChild // Use asChild to render an anchor tag
            disabled={buttonDisabled}
            className="mt-4 w-full" // Make button full width
            size="lg" // Make button larger
          >
            <a
              href={`/api/apps/${id}/view`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {buttonText}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default AppStatusPage;

import LNFlyHeading from "@/components/LNFlyHeading"; // Import LNFlyHeading
import { Badge } from "@/components/ui/badge"; // Import Badge
import { Button } from "@/components/ui/button"; // Import Button
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Import Card components
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"; // Import Dialog components
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Import Select components
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/clipboard";
import { CopyIcon, InfoIcon, PencilIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

// Define the expected structure of the app data from the API
// Define possible backend states from Prisma enum
type BackendState =
  | "STOPPED"
  | "STARTING"
  | "RUNNING"
  | "STOPPING"
  | "FAILED_TO_START";

interface AppData {
  id: number;
  title: string | null;
  state: "INITIALIZING" | "GENERATING" | "REVIEWING" | "COMPLETED" | "FAILED";
  numChars?: number;
  html?: string;
  prompt?: string;
  errorMessage?: string;
  promptSuggestions?: string | null;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  lightningAddress?: string | null;
  nwcUrl?: string | null; // Add nwcUrl field
  nsec?: string | null; // Add nsec field
  ppqApiKey?: string | null;
  // Backend related fields (only present if editKey matches)
  denoCode?: string | null;
  backendState?: BackendState | null;
  backendPort?: number | null;
  generatingSection?: string | null; // Add generating section
  systemPrompt?: string;
  systemPromptSegmentNames?: string[];
  seed?: number;
  fullOutput?: string;
  model?: string; // Add model field
}

const POLLING_INTERVAL = 3000; // Poll every 3 seconds
const AVAILABLE_MODELS = [
  "deepseek/deepseek-chat:free",
  "google/gemini-2.5-pro-preview",
  "openai/gpt-4.1",
  "anthropic/claude-sonnet-4",
  "meta-llama/llama-4-maverick",
  "x-ai/grok-3-beta",
];

function AppStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [appData, setAppData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState(true); // General loading for initial fetch/polling
  const [isBackendLoading, setIsBackendLoading] = useState(false); // Specific loading for backend actions
  const [error, setError] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const [lightningAddress, setLightningAddress] = useState("");
  const [nwcUrl, setNwcUrl] = useState(""); // Add state for NWC URL
  const [nsec, setNsec] = useState(""); // Add state for nsec
  const [ppqApiKey, setPpqApiKey] = useState(""); // Add state for ppqApiKey
  const [showLightningAddressModal, setShowLightningAddressModal] =
    useState(false);
  const [showNWCModal, setShowNWCModal] = useState(false);
  const [showNsecModal, setShowNsecModal] = useState(false);
  const [showPpqApiKeyModal, setShowPpqApiKeyModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false); // State for System Prompt modal
  const [showFullOutputModal, setShowFullOutputModal] = useState(false); // State for System Prompt modal
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref to hold the latest appData for use in interval callbacks
  const appDataRef = useRef(appData);
  useEffect(() => {
    appDataRef.current = appData;
  }, [appData]);
  const [showEditTitleModal, setShowEditTitleModal] = useState(false);
  const [appTitle, setAppTitle] = useState("");
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [showBackendModal, setShowBackendModal] = useState(false);
  const [showBackendStatusModal, setShowBackendStatusModal] = useState(false); // State for Backend Status modal

  const editKey = window.localStorage.getItem(`app_${id}_editKey`);
  const previewKey = window.localStorage.getItem(`app_${id}_previewKey`);

  // Chatwoot
  useEffect(() => {
    const script = document.createElement("script");

    script.async = true;
    script.appendChild(
      document.createTextNode(`(function (d, t) {
        var BASE_URL = "https://app.chatwoot.com";
        var g = d.createElement(t),
          s = d.getElementsByTagName(t)[0];
        g.src = BASE_URL + "/packs/js/sdk.js";
        g.defer = true;
        g.async = true;
        s.parentNode.insertBefore(g, s);
        g.onload = function () {
          window.chatwootSDK.run({
            websiteToken: "JU92KTCPm16NEGc7uCAGEMsm",
            baseUrl: BASE_URL,
          });
        };
      })(document, "script");`)
    );

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
      fetchStatus();
    } catch (error) {
      console.error("Error setting Lightning Address:", error);
      alert(
        `Error setting Lightning Address: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  const saveNwcUrl = async () => {
    if (!id || !editKey) {
      console.error("Cannot set NWC URL: Missing App ID or edit key.");
      alert("Error: Missing App ID or edit key.");
      return;
    }
    // Basic validation (optional: add more robust validation)
    if (!nwcUrl || !nwcUrl.startsWith("nostr+walletconnect://")) {
      alert("Please enter a valid NWC URL (e.g., nostr+walletconnect://...).");
      return;
    }

    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nwcUrl }), // Send nwcUrl
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to set NWC URL: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      toast(`NWC URL updated successfully.`);
      fetchStatus();
    } catch (error) {
      console.error("Error setting NWC URL:", error);
      alert(
        `Error setting NWC URL: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  const saveNsec = async () => {
    if (!id || !editKey) {
      console.error("Cannot set nsec: Missing App ID or edit key.");
      alert("Error: Missing App ID or edit key.");
      return;
    }
    // Basic validation (optional: add more robust validation)
    if (!nsec || !nsec.startsWith("nsec1")) {
      alert("Please enter a valid nsec (e.g., nsec1...).");
      return;
    }

    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nsec }), // Send nsec
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to set nsec: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      toast(`Nsec updated successfully.`);
      fetchStatus();
    } catch (error) {
      console.error("Error setting nsec:", error);
      alert(
        `Error setting nsec: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  const savePpqApiKey = async () => {
    if (!id || !editKey) {
      console.error("Cannot set nsec: Missing App ID or edit key.");
      alert("Error: Missing App ID or edit key.");
      return;
    }
    // Basic validation (optional: add more robust validation)
    if (!ppqApiKey || !ppqApiKey.startsWith("sk-")) {
      alert("Please enter a valid ppq.ai api key (e.g., sk-...).");
      return;
    }

    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ppqApiKey }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to set ppq api key: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      toast(`PPQ.ai API key updated successfully.`);
      fetchStatus();
    } catch (error) {
      console.error("Error setting ppqApiKey:", error);
      alert(
        `Error setting PPQ.ai API key: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  const openRegenerateModal = () => {
    if (!appData) return;
    if (appData.published) {
      toast.error("Regeneration is only possible for unpublished apps.");
      return;
    }
    if (!promptText.trim()) {
      toast.error("Prompt cannot be empty.");
      return;
    }
    setSelectedModel(appData.model || AVAILABLE_MODELS[0]);
    setShowRegenerateModal(true);
  };

  const handleConfirmRegenerate = async () => {
    if (!id || !editKey || !appData) {
      console.error("Cannot regenerate: Missing ID/key or appData.");
      return;
    }

    setShowRegenerateModal(false);
    setIsLoading(true); // Indicate loading state
    try {
      const response = await fetch(
        `/api/apps/${id}/regenerate?editKey=${editKey}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: promptText, model: selectedModel }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to regenerate app: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      // Optimistically update state and restart polling
      setAppData((prev) =>
        prev
          ? {
              ...prev,
              state: "GENERATING",
              errorMessage: undefined,
              model: selectedModel,
            }
          : null
      );
      setError(null); // Clear previous errors
      toast.info(`App ${id} regeneration started with model ${selectedModel}.`);
      fetchStatus(true); // Immediately fetch status and restart polling if needed
    } catch (error) {
      console.error("Error regenerating app:", error);
      toast.error(
        `Error regenerating app: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
      setIsLoading(false); // Stop loading indicator on error
    }
    // setIsLoading will be set to false by fetchStatus in the finally block
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
        // Initialize or update promptText state only if it hasn't been edited by the user yet
        if (isInitialLoad && !promptText) {
          setPromptText(data.prompt || "");
        }
        setAppData(data);
        if (!lightningAddress) {
          setLightningAddress(data.lightningAddress || ""); // Initialize input with fetched data
        }
        if (!nwcUrl) {
          setNwcUrl(data.nwcUrl || ""); // Initialize NWC URL input
        }
        if (!nsec) {
          setNsec(data.nsec || ""); // Initialize nsec input
        }
        if (!ppqApiKey) {
          setPpqApiKey(data.ppqApiKey || ""); // Initialize nsec input
        }
        if (data.model && isInitialLoad) {
          setSelectedModel(data.model);
        }
        setError(null); // Clear error on successful fetch

        // Stop polling if the process is finished (completed or failed)
        if (
          (data.state === "COMPLETED" && data.backendState !== "STARTING") ||
          data.state === "FAILED"
        ) {
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
    [
      appData?.state,
      editKey,
      id,
      isLoading,
      lightningAddress,
      nwcUrl,
      nsec,
      ppqApiKey,
      promptText,
    ]
  );

  const saveAppTitle = async () => {
    if (!id || !editKey) {
      console.error("Cannot save title: Missing App ID or edit key.");
      toast.error("Error: Missing App ID or edit key.");
      return;
    }
    if (!appTitle.trim()) {
      toast.error("Title cannot be empty.");
      return;
    }

    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT", // Or PATCH if preferred on backend
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: appTitle }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to save title: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      // Update local state optimistically or refetch
      setAppData((prev) => (prev ? { ...prev, title: appTitle } : null));
      toast.success(`App title updated successfully.`);
      setShowEditTitleModal(false); // Close modal on success
    } catch (error) {
      console.error("Error saving app title:", error);
      toast.error(
        `Error saving title: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    }
  };

  // --- Backend Control Handlers ---
  const handleBackendAction = async (
    action: "start" | "stop" | "force_stop" | "clear_storage"
  ) => {
    if (!id || !editKey || !appData?.denoCode) {
      toast.error("Cannot perform backend action: Missing ID, key, or code.");
      return;
    }

    let force = false;
    if (action === "force_stop") {
      action = "stop";
      force = true;
    }

    setIsBackendLoading(true);
    try {
      const response = await fetch(
        `/api/apps/${id}/backend/${action}?editKey=${editKey}&force=${force}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: response.statusText }));
        throw new Error(
          `Failed to ${action} backend: ${response.status} - ${errorData.message}`
        );
      }

      const result = await response.json();
      toast.success(`Backend ${action} request sent successfully.`);

      // Update local state immediately based on expected result or refetch
      setAppData((prev) =>
        prev
          ? {
              ...prev,
              backendState:
                result.backendState ||
                (action === "start" ? "STARTING" : "STOPPING"), // Optimistic update
              backendPort: action === "stop" ? null : prev.backendPort, // Clear port on stop
            }
          : null
      );
      // Optionally trigger a fetchStatus() after a short delay to confirm
      setTimeout(() => fetchStatus(), 1000);
    } catch (error) {
      console.error(`Error ${action}ing backend:`, error);
      toast.error(
        `Error ${action}ing backend: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    } finally {
      setIsBackendLoading(false);
    }
  };

  const handleStartBackend = () => handleBackendAction("start");
  const handleStopBackend = () => handleBackendAction("stop");
  const handleForceStopBackend = () => handleBackendAction("force_stop");
  const handleClearBackendStorage = () => handleBackendAction("clear_storage");
  // --- End Backend Control Handlers ---

  const cancelGeneration = async () => {
    if (!id || !editKey || appData?.state !== "GENERATING") {
      console.error(
        "Cannot cancel: Missing ID/key or not in GENERATING state."
      );
      toast.error("Cancellation is only possible during generation.");
      return;
    }

    setIsLoading(true); // Indicate loading state
    try {
      const response = await fetch(`/api/apps/${id}?editKey=${editKey}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: "FAILED",
          errorMessage: "Cancelled by user",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to cancel generation: ${response.status} - ${
            errorText || response.statusText
          }`
        );
      }

      // Optimistically update state and stop polling
      setAppData((prev) =>
        prev
          ? {
              ...prev,
              state: "FAILED",
              errorMessage: "Cancelled by user",
            }
          : null
      );
      setError(null); // Clear previous errors
      toast.info(`App ${id} generation cancelled.`);
      if (intervalRef.current) {
        clearInterval(intervalRef.current); // Stop polling immediately
        intervalRef.current = null;
      }
    } catch (error) {
      console.error("Error cancelling generation:", error);
      toast.error(
        `Error cancelling generation: ${
          error instanceof Error ? error.message : "An unknown error occurred."
        }`
      );
    } finally {
      setIsLoading(false); // Stop loading indicator
    }
  };

  const shouldPoll =
    appData?.state === "GENERATING" ||
    appData?.state === "INITIALIZING" ||
    appData?.state === "REVIEWING" ||
    appData?.backendState === "STARTING" || // Poll while backend is starting/stopping
    appData?.backendState === "STOPPING";
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
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
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
  }, [fetchStatus, id, shouldPoll]); // Rerun effect if backend state changes too

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

  const buttonDisabled = false; //appData.state !== "COMPLETED" || (!appData.published && !previewKey);

  // Set display strings/styles based on the actual state
  switch (appData.state) {
    case "INITIALIZING":
      statusMessage = "Initializing...";
      statusColor = "text-yellow-600";
      break;
    case "GENERATING":
      statusMessage = `Generating${
        appData.generatingSection ? `: ${appData.generatingSection}` : "..."
      }`;
      statusColor = "text-blue-600 animate-pulse"; // Add pulse animation
      break;
    case "REVIEWING": // Add case for REVIEWING state
      statusMessage = "Reviewing...";
      statusColor = "text-purple-600 animate-pulse"; // Use a different color/style
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
              <CardTitle>
                {appData.title
                  ? appData.title
                  : appData.state === "COMPLETED" || appData.state === "FAILED"
                  ? "Untitled App"
                  : "Loading Title..."}

                {appData.state === "COMPLETED" &&
                  editKey && ( // Only show if editKey exists
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-6 w-6" // Adjust size and margin
                      onClick={() => {
                        setAppTitle(appData.title || ""); // Initialize editing title
                        setShowEditTitleModal(true);
                      }}
                      title="Edit title"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </Button>
                  )}
              </CardTitle>
              {/* <CardDescription>App {appData.id}</CardDescription> */}
              {/* Display error alongside data if polling fails temporarily */}
              {error && (
                <p className="text-sm text-red-500 mt-2">Warning: {error}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Prompt:</Label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(appData.prompt || "")}
                      title="Copy prompt"
                    >
                      <CopyIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={promptText} // Use state for value
                    onChange={(e) => setPromptText(e.target.value)} // Update state on change
                    readOnly={appData.published} // Editable only if unpublished
                    className={appData.published ? "bg-muted" : ""} // Adjust style when read-only
                  />
                </div>
                {/* Action Buttons: Regenerate, Suggestions, System Prompt, HTML, Backend */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {" "}
                  {/* Use flex-wrap for better responsiveness */}
                  {!appData.published &&
                    editKey &&
                    (appData.state === "COMPLETED" ||
                      appData.state === "FAILED") && (
                      <Button
                        onClick={openRegenerateModal}
                        disabled={isLoading}
                        variant="outline"
                        size="sm"
                      >
                        🪄 Regenerate
                      </Button>
                    )}
                  {/* Suggestions Button */}
                  {editKey &&
                    appData.state === "COMPLETED" &&
                    !!appData.promptSuggestions && (
                      <Button
                        onClick={() => setShowSuggestionsModal(true)}
                        variant="outline"
                        size="sm"
                      >
                        ✨ Suggestions
                      </Button>
                    )}
                  {editKey &&
                    (appData.state === "COMPLETED" ||
                      appData.state === "REVIEWING") &&
                    !!appData.html && (
                      <Button
                        onClick={() => setShowHtmlModal(true)} // Update onClick
                        variant="outline"
                        size="sm"
                      >
                        🧑‍💻️ View HTML
                      </Button>
                    )}
                  {editKey &&
                    (appData.state === "COMPLETED" ||
                      appData.state === "REVIEWING") &&
                    !!appData.denoCode && (
                      <Button
                        onClick={() => setShowBackendModal(true)} // Update onClick
                        variant="outline"
                        size="sm"
                      >
                        🦖 View Deno
                      </Button>
                    )}
                  {/* Manage Backend Button */}
                  {editKey &&
                    (appData.state === "COMPLETED" ||
                      appData.state === "REVIEWING") &&
                    !!appData.denoCode && (
                      <Button
                        onClick={() => setShowBackendStatusModal(true)} // Show backend status modal
                        variant="outline"
                        size="sm"
                      >
                        ⚙️ Manage Backend
                      </Button>
                    )}
                  {/* View System Prompt Button */}
                  {editKey && appData.systemPrompt && (
                    <Button
                      onClick={() => setShowSystemPromptModal(true)}
                      variant="outline"
                      size="sm"
                    >
                      📄 View System Prompt
                    </Button>
                  )}
                  {appData.fullOutput && (
                    <Button
                      onClick={() => setShowFullOutputModal(true)}
                      variant="outline"
                      size="sm"
                    >
                      📄 Full Output
                    </Button>
                  )}
                </div>
                {appData.state !== "COMPLETED" && (
                  <p className="mt-2">
                    {" "}
                    {/* Add margin top to separate from badges */}
                    Status:{" "}
                    <span className={`font-semibold ${statusColor}`}>
                      {statusMessage}
                      {appData.state === "FAILED" && !!appData.errorMessage && (
                        <span className="text-sm">
                          : {appData.errorMessage}
                        </span>
                      )}
                    </span>
                    {/* Cancel Button */}
                    {appData.state === "GENERATING" && editKey && (
                      <Button
                        onClick={cancelGeneration}
                        disabled={isLoading}
                        variant="destructive"
                        size="sm"
                        className="ml-2"
                      >
                        Cancel
                      </Button>
                    )}
                  </p>
                )}
                {!!appData.numChars && appData.state === "GENERATING" && (
                  <p>
                    Characters Generated: {appData.numChars.toLocaleString()}
                  </p>
                )}
                {/* <p>Seed: {appData.seed || "undefined"}</p> */}
                {/* <p>
                  Published:{" "}
                  <span
                    className={`font-semibold ${
                      appData.published ? "text-green-500" : "text-gray-500"
                    }`}
                  >
                    {appData.published.toString()}
                  </span>
                </p> */}
                <p className="text-sm mt-2">
                  Created: {new Date(appData.createdAt).toLocaleString()}
                </p>
                <p className="text-sm">
                  Updated: {new Date(appData.updatedAt).toLocaleString()}
                </p>
              </div>

              {/* --- Backend Status Section Removed (Moved to Modal) --- */}

              {/* Lightning Address Input - Wrapped with conditional logic */}
              {editKey && appData.html?.includes("new LightningAddress(") && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="lightning-address">Lightning Address</Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowLightningAddressModal(true)}
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
              )}
              {/* End Lightning Address Input */}

              {/* NWC URL Input - Added */}
              {editKey && appData.denoCode?.includes("NWC_URL") && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="nwc-url" className="block">
                      NWC URL
                      <span className="text-destructive font-bold inline">
                        *
                      </span>
                    </Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowNWCModal(true)}
                    >
                      <InfoIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="nwc-url"
                      placeholder="nostr+walletconnect://..."
                      value={nwcUrl}
                      onChange={(e) => setNwcUrl(e.target.value)}
                    />
                    <Button onClick={saveNwcUrl}>Set</Button>
                  </div>
                </div>
              )}
              {/* End NWC URL Input */}

              {/* Nsec Input - Added */}
              {editKey && appData.denoCode?.includes("NSEC") && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="nsec" className="block">
                      Nostr Private Key (nsec)
                      <span className="text-destructive font-bold inline">
                        *
                      </span>
                    </Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowNsecModal(true)}
                    >
                      <InfoIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="nsec"
                      placeholder="nsec1..."
                      value={nsec}
                      onChange={(e) => setNsec(e.target.value)}
                    />
                    <Button onClick={saveNsec}>Set</Button>
                  </div>
                </div>
              )}
              {/* End Nsec Input */}

              {/* PPQ.ai Input - Added */}
              {editKey && appData.denoCode?.includes("PPQ_API_KEY") && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center">
                    <Label htmlFor="ppqApiKey" className="block">
                      PPQ.ai API key
                      <span className="text-destructive font-bold inline">
                        *
                      </span>
                    </Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowPpqApiKeyModal(true)}
                    >
                      <InfoIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      id="ppqApiKey"
                      placeholder="sk-..."
                      value={ppqApiKey}
                      onChange={(e) => setPpqApiKey(e.target.value)}
                    />
                    <Button onClick={savePpqApiKey}>Set</Button>
                  </div>
                </div>
              )}
              {/* End PPQ API key Input */}

              {(appData.state === "COMPLETED" ||
                appData.state === "REVIEWING") &&
                (appData.nwcUrl ||
                  !appData.denoCode?.includes("NWC_URL") ||
                  import.meta.env.VITE_ALLOW_EMPTY_NWC_URL === "true") &&
                (appData.nsec || !appData.denoCode?.includes("NSEC")) &&
                (appData.ppqApiKey ||
                  !appData.denoCode?.includes("PPQ_API_KEY")) && (
                  <a
                    href={
                      buttonDisabled
                        ? "#"
                        : `/api/apps/${id}/view${
                            appData.published ? "" : `?previewKey=${previewKey}`
                          }`
                    }
                    target="_blank"
                  >
                    <Button
                      disabled={buttonDisabled}
                      className="mt-4 w-full" // Make button full width
                      size="lg" // Make button larger
                    >
                      {appData.published
                        ? "View app"
                        : "Preview unpublished app"}
                    </Button>
                  </a>
                )}
              {!appData.published &&
                appData.state === "COMPLETED" &&
                (appData.nwcUrl ||
                  !appData.denoCode?.includes("NWC_URL") ||
                  import.meta.env.VITE_ALLOW_EMPTY_NWC_URL === "true") &&
                (appData.nsec || !appData.denoCode?.includes("NSEC")) &&
                (appData.ppqApiKey ||
                  !appData.denoCode?.includes("PPQ_API_KEY")) &&
                editKey && (
                  <Button
                    variant="secondary"
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
      {showLightningAddressModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">
              What is a Lightning Address?
            </h3>
            <p className="mb-4">
              A lightning address is like an email address, but for receiving
              money. Set your lightning address to earn when users pay within
              your app. You can get a lightning address at:
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
              onClick={() => setShowLightningAddressModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}
      {showNWCModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">
              What is a NWC Connection Secret?
            </h3>
            <p className="mb-4">
              NWC gives an app permissioned access to your lightning wallet.
              Your Deno backend needs a NWC wallet to function. You can get a
              NWC-enabled wallet at:
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
            <Button onClick={() => setShowNWCModal(false)} className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}
      {showNsecModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">
              What is a Nostr Private Key (nsec)?
            </h3>
            <p className="mb-4">
              A Nostr private key (nsec) allows your app to post notes and
              interact with the Nostr network on your behalf. Your Deno backend
              needs an nsec to function with Nostr features. You can generate
              one at:
            </p>
            <ul className="list-disc list-inside mb-4">
              <li>
                <a
                  href="https://nostrtool.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  https://nostrtool.com
                </a>
              </li>
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
            </ul>
            <Button onClick={() => setShowNsecModal(false)} className="w-full">
              Close
            </Button>
          </div>
        </div>
      )}

      {showPpqApiKeyModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">What is PPQ.ai?</h3>
            <p className="mb-4">
              PPQ.ai is an openai-compatible AI service provider that accepts
              bitcoin payments. Top up your account and get your API key at{" "}
              <a
                href="https://ppq.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                https://ppq.ai
              </a>
            </p>
            <Button
              onClick={() => setShowPpqApiKeyModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Prompt Suggestions Modal */}
      {showSuggestionsModal && appData?.promptSuggestions && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Prompt Suggestions</h3>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded mb-4">
              {appData.promptSuggestions}
            </pre>
            <Button
              onClick={() => setShowSuggestionsModal(false)}
              className="w-full"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Edit Title Modal */}
      {showEditTitleModal && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Edit App Title</h3>
            <div className="space-y-2 mb-4">
              <Label htmlFor="edit-title-input">App Title</Label>
              <Input
                id="edit-title-input"
                value={appTitle}
                onChange={(e) => setAppTitle(e.target.value)}
                placeholder="Enter a title for your app"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditTitleModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveAppTitle}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* View HTML Modal */}
      {showHtmlModal && appData?.html && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">View HTML</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(appData.html || "")}
                title="Copy HTML"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded mb-4 overflow-auto flex-grow">
              {appData.html}
            </pre>
            <Button
              onClick={() => setShowHtmlModal(false)}
              className="w-full mt-auto"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* View Backend Code Modal */}
      {showBackendModal && appData?.denoCode && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">View Backend Code</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(appData.denoCode || "")}
                title="Copy Backend Code"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded mb-4 overflow-auto flex-grow">
              {appData.denoCode}
            </pre>
            <Button
              onClick={() => setShowBackendModal(false)}
              className="w-full mt-auto"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* View System Prompt Modal */}
      {showSystemPromptModal && appData?.systemPrompt && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">View System Prompt</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(appData.systemPrompt || "")}
                title="Copy System Prompt"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>
            {editKey && appData.systemPromptSegmentNames && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mr-1 inline-block">
                  System Knowledge
                </h4>
                <div className="flex-wrap gap-1 inline-flex">
                  {appData.systemPromptSegmentNames.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {appData.model && (
              <div className="mb-3">
                <h4 className="text-sm font-medium mr-1 inline-block">Model</h4>
                <Badge variant="secondary">{appData.model}</Badge>
              </div>
            )}
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded mb-4 overflow-auto flex-grow">
              {appData.systemPrompt}
            </pre>
            <Button
              onClick={() => setShowSystemPromptModal(false)}
              className="w-full mt-auto"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* View Full Output Modal */}
      {showFullOutputModal && appData?.fullOutput && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">View Full Output</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(appData.fullOutput || "")}
                title="Copy System Prompt"
              >
                <CopyIcon className="h-4 w-4" />
              </Button>
            </div>

            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded mb-4 overflow-auto flex-grow">
              {appData.fullOutput}
            </pre>
            <Button
              onClick={() => setShowFullOutputModal(false)}
              className="w-full mt-auto"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Backend Status Modal */}
      {showBackendStatusModal && appData?.denoCode && (
        <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-primary-foreground p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Manage Backend</h3>
            <div className="space-y-3">
              <p>
                State:{" "}
                <span className="font-medium">
                  {appData.backendState || "Unknown"}
                </span>
                {appData.backendState === "RUNNING" && appData.backendPort && (
                  <span> (Port: {appData.backendPort})</span>
                )}
              </p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Button
                  onClick={handleStartBackend}
                  disabled={
                    isBackendLoading ||
                    appData.backendState === "RUNNING" ||
                    appData.backendState === "STARTING" ||
                    appData.backendState === "STOPPING"
                  }
                  size="sm"
                  variant="outline"
                >
                  {isBackendLoading &&
                  (appData.backendState === "STARTING" || !appData.backendState)
                    ? "Starting..."
                    : "Start Backend"}
                </Button>
                <Button
                  onClick={handleStopBackend}
                  disabled={
                    isBackendLoading ||
                    appData.backendState === "STOPPED" ||
                    appData.backendState === "STOPPING" ||
                    appData.backendState === "FAILED_TO_START"
                  }
                  size="sm"
                  variant="destructive"
                >
                  {isBackendLoading && appData.backendState === "STOPPING"
                    ? "Stopping..."
                    : "Stop Backend"}
                </Button>
                <Button
                  onClick={handleForceStopBackend}
                  size="sm"
                  variant="destructive"
                  //disabled={appData.backendState !== "STOPPING"}
                >
                  Force Stop
                </Button>
                <Button
                  onClick={handleClearBackendStorage}
                  disabled={
                    isBackendLoading || appData.backendState === "RUNNING"
                  }
                  size="sm"
                  variant="secondary"
                >
                  Clear Storage
                </Button>
              </div>
            </div>
            <Button
              onClick={() => setShowBackendStatusModal(false)}
              className="w-full mt-6"
              variant="outline"
            >
              Close
            </Button>
          </div>
        </div>
      )}

      {/* Regenerate App Modal */}
      {showRegenerateModal && (
        <Dialog
          open={showRegenerateModal}
          onOpenChange={setShowRegenerateModal}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Regenerate App</DialogTitle>
              <DialogDescription>
                Are you sure you wish to re-generate the app? The current app
                will be lost.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="model-select" className="text-right pt-2.5">
                  Model
                </Label>
                <div className="col-span-3">
                  <Select
                    value={selectedModel}
                    onValueChange={setSelectedModel}
                  >
                    <SelectTrigger id="model-select">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS.map((model) => (
                        <SelectItem key={model} value={model}>
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowRegenerateModal(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmRegenerate}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default AppStatusPage;

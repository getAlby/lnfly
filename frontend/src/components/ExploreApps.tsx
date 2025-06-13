import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { launchPaymentModal } from "@getalby/bitcoin-connect-react"; // Import Bitcoin Connect
import { useEffect, useRef, useState } from "react"; // Added useRef
import { toast } from "sonner"; // Import toast for notifications
import ZapModal from "./ZapModal"; // Import the ZapModal component

// Define ZapType locally or import if defined elsewhere
type ZapType = "UPZAP" | "DOWNZAP";

interface App {
  title?: string;
  id: number;
  prompt: string;
  status: string; // Assuming status is a string like 'completed'
  zapAmount?: number; // Added for the Zap button
  // Add other potential fields like title, description if available
}

interface ExploreAppsProps {
  onFork: (prompt: string) => void;
}

function ExploreApps({ onFork }: ExploreAppsProps) {
  const [completedApps, setCompletedApps] = useState<App[]>([]);
  const [isAppsLoading, setIsAppsLoading] = useState(true);
  const [appsError, setAppsError] = useState<string | null>(null);
  const [isZapModalOpen, setIsZapModalOpen] = useState(false);
  const [selectedAppForZap, setSelectedAppForZap] = useState<App | null>(null);
  const [isZapping, setIsZapping] = useState(false); // Loading state for zap process

  // Ref to store the interval ID for clearing later
  const paymentCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear interval on component unmount
  useEffect(() => {
    return () => {
      if (paymentCheckIntervalRef.current) {
        clearInterval(paymentCheckIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchCompletedApps = async () => {
      try {
        const response = await fetch("/api/apps?status=completed");
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: App[] = await response.json();
        setCompletedApps(data);
      } catch (err) {
        console.error("Failed to fetch completed apps:", err);
        setAppsError("Failed to load completed apps.");
      } finally {
        setIsAppsLoading(false);
      }
    };

    fetchCompletedApps();
  }, []); // Empty dependency array means this effect runs once on mount

  const handleFork = (prompt: string) => {
    onFork("");
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    setTimeout(() => {
      onFork(prompt); // Call the prop function to update the prompt in the parent
    }, 500);
  };

  // Function to handle the submission from the ZapModal
  const handleZapSubmit = async (details: {
    amount: number; // sats
    zapType: ZapType;
    appId: number;
    comment?: string;
  }) => {
    setIsZapping(true);
    toast.info("Generating invoice...");

    // Clear any previous interval
    if (paymentCheckIntervalRef.current) {
      clearInterval(paymentCheckIntervalRef.current);
      paymentCheckIntervalRef.current = null;
    }

    try {
      // 1. Call backend to create zap and get invoice
      const response = await fetch(`/api/apps/${details.appId}/zaps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: details.amount,
          zapType: details.zapType,
          comment: details.comment,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `Failed to create zap (HTTP ${response.status})`
        );
      }

      const { invoice, zapId } = await response.json();

      if (!invoice || !zapId) {
        throw new Error(
          "Invalid response from server: missing invoice or zapId"
        );
      }

      // 2. Close modal
      setIsZapModalOpen(false);
      toast.success("Invoice generated! Opening payment modal...");

      // 3. Launch Bitcoin Connect
      let backendRegisteredZap = false;
      const { setPaid } = launchPaymentModal({
        invoice: invoice,
        onPaid: () => {
          if (!backendRegisteredZap) {
            return;
          }
          toast.success("Payment successful!");
          if (paymentCheckIntervalRef.current) {
            clearInterval(paymentCheckIntervalRef.current);
            paymentCheckIntervalRef.current = null;
          }
          // setPaid is called automatically by BC internally if preimage is provided
          // We might still want to call it here if the backend confirms payment first via polling
          // but the callback is usually the primary confirmation.
          // setPaid({ preimage: paidResponse.preimage });
        },
        onCancelled: () => {
          console.log("Payment cancelled");
          toast.info("Payment cancelled.");
          if (paymentCheckIntervalRef.current) {
            clearInterval(paymentCheckIntervalRef.current);
            paymentCheckIntervalRef.current = null;
          }
        },
      });

      // 4. Start polling backend for payment confirmation
      paymentCheckIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(
            `/api/apps/${details.appId}/zaps/${zapId}/status`
          );
          // Stop polling if request fails (e.g., server down)
          if (!statusRes.ok) {
            console.error("Failed to check payment status, stopping polling.");
            if (paymentCheckIntervalRef.current) {
              clearInterval(paymentCheckIntervalRef.current);
              paymentCheckIntervalRef.current = null;
            }
            // Optionally notify user
            // toast.error("Could not confirm payment status.");
            return;
          }

          const statusData = await statusRes.json();

          if (statusData.paid) {
            console.log("Payment confirmed via polling. Backend updated.");
            if (paymentCheckIntervalRef.current) {
              clearInterval(paymentCheckIntervalRef.current);
              paymentCheckIntervalRef.current = null;
            }

            // Update local state to reflect the new zap amount immediately
            setCompletedApps((prevApps) =>
              prevApps.map((app) => {
                if (app.id === details.appId) {
                  const currentAmount = app.zapAmount || 0;
                  const change =
                    details.zapType === "UPZAP"
                      ? details.amount
                      : -details.amount;
                  return { ...app, zapAmount: currentAmount + change };
                }
                return app;
              })
            );

            // If BC modal is still open, inform it payment is complete.
            // Using a dummy preimage as we don't get the real one here.
            // The onPaid callback is the primary way to update the BC modal UI with the correct preimage.
            backendRegisteredZap = true;
            setPaid({ preimage: "dummy" }); // Attempt to update BC modal
            toast.success("Payment confirmed!"); // Notify user payment is confirmed backend-side
          } else {
            console.log("Polling: Payment not confirmed yet.");
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
          // Stop polling on unexpected errors
          if (paymentCheckIntervalRef.current) {
            clearInterval(paymentCheckIntervalRef.current);
            paymentCheckIntervalRef.current = null;
          }
        }
      }, 3000); // Poll every 3 seconds
    } catch (error) {
      console.error("Zap submission failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to initiate zap."
      );
      setIsZapModalOpen(false); // Close modal on error too
    } finally {
      setIsZapping(false);
    }
  };

  if (isAppsLoading) {
    return <div>Loading completed apps...</div>;
  }

  if (appsError) {
    return <div className="text-red-500">Error: {appsError}</div>;
  }

  return (
    <div className="mt-32 w-full max-w-lg">
      {" "}
      {/* Added margin-top and width */}
      <h2 className="text-2xl font-bold mb-4">Explore Apps</h2>{" "}
      {/* Title outside the card */}
      {completedApps.length === 0 && (
        <div className="text-muted-foreground">No completed apps found.</div>
      )}
      <ul className="space-y-4">
        {" "}
        {/* Added space between card items */}
        {completedApps.map((app) => (
          <li key={app.id}>
            <Card>
              <CardHeader>
                <CardTitle>{app.title || "Untitled App"}</CardTitle>
              </CardHeader>
              {/* Each app is a card */}
              <CardContent className="flex flex-col">
                {" "}
                {/* Changed to flex-col */}
                <span
                  className="text-sm mb-4 overflow-hidden text-ellipsis text-muted-foreground"
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {" "}
                  {/* Smaller text, truncate prompt to 3 lines, added mb-4 */}
                  {app.prompt}
                </span>
                <div className="flex gap-2 justify-end items-center">
                  {" "}
                  {/* Right-align buttons */}
                  {window.localStorage.getItem(`app_${app.id}_editKey`) && (
                    <a href={`/apps/${app.id}`} target="_blank">
                      <Button size="sm" variant="destructive">
                        Manage
                      </Button>
                    </a>
                  )}
                  <a href={`/apps/${app.id}/view`} target="_blank">
                    <Button size="sm">View</Button>
                  </a>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleFork(app.prompt)}
                  >
                    Fork
                  </Button>
                  {/* Zap Button */}
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedAppForZap(app);
                      setIsZapModalOpen(true);
                    }}
                    className="bg-yellow-800"
                    disabled={isZapping} // Disable button while processing
                  >
                    {isZapping && selectedAppForZap?.id === app.id
                      ? "Zapping..."
                      : `⚡ ${app.zapAmount || 0}`}
                    {/* Display zap amount if available and non-zero */}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
      {/* Render the Zap Modal */}
      {selectedAppForZap && (
        <ZapModal
          isOpen={isZapModalOpen}
          onClose={() => setIsZapModalOpen(false)}
          onSubmit={handleZapSubmit}
          appName={selectedAppForZap.title || "Untitled App"}
          appId={selectedAppForZap.id}
        />
      )}
    </div>
  );
}

export default ExploreApps;

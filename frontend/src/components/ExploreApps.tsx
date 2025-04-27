import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface App {
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
              {" "}
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
                <div className="flex gap-2 justify-end">
                  {" "}
                  {/* Right-align buttons */}
                  {window.localStorage.getItem(`app_${app.id}_editKey`) && (
                    <a href={`/apps/${app.id}`} target="_blank">
                      <Button size="sm" variant="destructive">
                        Manage
                      </Button>
                    </a>
                  )}
                  <a href={`/api/apps/${app.id}/view`} target="_blank">
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
                    style={{ backgroundColor: "#facc15", color: "black" }} // Yellow background
                    onClick={() => alert("Coming soon!")} // Placeholder alert
                  >
                    Zap {app.zapAmount ? `(${app.zapAmount})` : ""}{" "}
                    {/* Display zap amount if available */}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ExploreApps;

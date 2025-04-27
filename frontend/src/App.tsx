import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import Logo from "./assets/logo.svg";

import ExploreApps from "@/components/ExploreApps"; // Import the new component
import LNFlyHeading from "@/components/LNFlyHeading"; // Import the new component
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingButton } from "@/components/ui/loading-button";
import { Textarea } from "@/components/ui/textarea";
import { suggestions } from "@/lib/suggestions";

function App() {
  const [prompt, setPrompt] = useState("");
  // const [generatedHtml, setGeneratedHtml] = useState<string | null>(null); // Remove generatedHtml state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); // Get navigate function

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    // setGeneratedHtml(null); // Remove
    console.log("Submitting prompt:", prompt);

    try {
      const response = await fetch("/api/apps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      // Expecting 202 Accepted status now
      if (response.status !== 202) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status} - ${
            errorText || "Failed to start app generation."
          }`
        );
      }

      // Expecting { id: number } in the response
      const result = (await response.json()) as {
        id: string;
        editKey: string;
        previewKey: string;
      };
      console.log("API Response:", result);
      window.localStorage.setItem(`app_${result.id}_editKey`, result.editKey);
      window.localStorage.setItem(
        `app_${result.id}_previewKey`,
        result.previewKey
      );

      if (result && typeof result.id === "number") {
        // Redirect to the app status page
        navigate(`/apps/${result.id}`);
        // Don't clear prompt here, user might want to see it on the next page (or we clear it there)
      } else {
        console.error("Unexpected API response format:", result);
        setError("Received unexpected data format from the server.");
      }
      // setPrompt(""); // Don't clear prompt here
    } catch (err) {
      console.error("Failed to submit prompt:", err);
      setError(
        err instanceof Error ? err.message : "An unknown error occurred."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="font-sans flex flex-col items-center min-h-screen py-8 px-4">
      <img
        src={Logo}
        alt="LNFly Logo"
        className="w-screen h-screen object-cover fixed top-0 left-0 -z-10 opacity-15 object-center "
      />
      <main className="flex-1 w-full flex-grow flex flex-col items-center justify-center">
        {/* Add the heading here */}
        <LNFlyHeading />
        {/* Added heading */}
        {/* Form is now always visible */}
        <div className="w-full max-w-lg">
          <Card className="w-full">
            <CardContent>
              <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-md gap-2 items-end pt-6" // Added pt-6 for padding
              >
                <Textarea
                  placeholder="Enter prompt to generate an app..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="max-h-64"
                  disabled={isLoading}
                  required
                />
                <LoadingButton
                  type="submit"
                  loading={isLoading}
                  className="h-16"
                >
                  Generate
                </LoadingButton>
              </form>
              {/* Keep example button */}
              {!isLoading && (
                <div className="mt-4 flex gap-2 flex-wrap">
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion.title}
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setPrompt(suggestion.prompt);
                      }}
                    >
                      {suggestion.title}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        {/* Error display */}
        {error && (
          <div className="text-red-500 bg-red-100 border border-red-400 rounded p-3 mt-4 w-full max-w-md">
            {" "}
            {/* Added margin-top */}
            <strong>Error:</strong> {error}
          </div>
        )}
        {/* Removed iframe display */}
        {/* Add the ExploreApps component here */}
        <ExploreApps onFork={setPrompt} />{" "}
        {/* Pass setPrompt as the onFork prop */}
      </main>
    </div>
  );
}

export default App;

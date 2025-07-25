import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate

import { Constellation } from "@/components/Constellation";
import ExploreApps from "@/components/ExploreApps"; // Import the new component
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import Header from "@/components/Header"; // Import the new component
import { Hero } from "@/components/Hero";

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
    <div className="font-sans flex flex-col items-center min-h-screen px-4">
      <Constellation />
      <Header />
      <main className="flex-1 w-full flex-grow flex flex-col items-center justify-center">
        <Hero
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          prompt={prompt}
          setPrompt={setPrompt}
        />
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
        <Features />
      </main>
      <Footer />
    </div>
  );
}

export default App;

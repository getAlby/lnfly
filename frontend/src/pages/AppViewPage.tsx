import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function AppViewPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const previewKey = searchParams.get("previewKey");
  
  const [countdown, setCountdown] = useState(5);
  const [appHtml, setAppHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApp, setShowApp] = useState(false);

  const fetchAppContent = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const url = previewKey 
        ? `/api/apps/${id}/view?previewKey=${previewKey}`
        : `/api/apps/${id}/view`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load app: ${response.statusText}`);
      }
      
      const html = await response.text();
      setAppHtml(html);
      setShowApp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load app");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAppNow = () => {
    fetchAppContent();
  };

  // Countdown timer effect
  useEffect(() => {
    if (countdown > 0 && !showApp) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && !showApp) {
      // Auto-load the app when countdown reaches 0
      fetchAppContent();
    }
  }, [countdown, showApp]);

  // If we're showing the actual app, render it
  if (showApp && appHtml) {
    return (
      <div
        className="w-full h-screen"
        dangerouslySetInnerHTML={{ __html: appHtml }}
      />
    );
  }

  // Show intermediate loading page
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="text-center shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-800">
              <Link 
                to="/" 
                className="text-blue-600 hover:text-blue-800 transition-colors no-underline"
              >
                App created with LNFly
              </Link>
            </CardTitle>
            <p className="text-gray-600 text-sm mt-2">
              AI-powered app generation platform
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm font-medium">
                ⚠️ Apps on LNFly are vibe coded with AI. Use at your own risk.
              </p>
            </div>
            
            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
                <Button 
                  className="mt-3 w-full"
                  onClick={handleViewAppNow}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Try Again"}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {countdown > 0 ? (
                  <>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600 mb-2">
                        {countdown}
                      </div>
                      <p className="text-gray-600 text-sm">
                        Loading app in {countdown} second{countdown !== 1 ? 's' : ''}...
                      </p>
                    </div>
                    <Button 
                      className="w-full"
                      onClick={handleViewAppNow}
                      disabled={isLoading}
                    >
                      {isLoading ? "Loading..." : "View App Now"}
                    </Button>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="text-blue-600 mb-2">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    <p className="text-gray-600 text-sm">Loading app...</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default AppViewPage;
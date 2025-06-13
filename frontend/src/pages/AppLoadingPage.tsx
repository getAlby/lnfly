import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Logo from "@/assets/logo.svg";

interface AppLoadingPageProps {}

function AppLoadingPage({}: AppLoadingPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  // Get preview key from URL params
  const previewKey = searchParams.get('previewKey');
  
  // Build the actual app URL with preview key if needed
  const appUrl = `/api/apps/${id}/view${previewKey ? `?previewKey=${previewKey}` : ''}`;

  useEffect(() => {
    // Update countdown every second
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Countdown finished, redirect to actual app
          window.location.href = appUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [appUrl]);

  const handleViewNow = () => {
    // Immediately redirect to the app
    window.location.href = appUrl;
  };

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <div className="font-sans flex flex-col items-center min-h-screen py-4 px-4 sm:py-8">
      {/* Background logo */}
      <img
        src={Logo}
        alt="LNFly Logo"
        className="w-screen h-screen object-cover fixed top-0 left-0 -z-10 opacity-15 object-center"
      />
      
      <main className="flex-1 w-full flex-grow flex flex-col items-center justify-center">
        <div className="w-full max-w-md mx-auto">
          <Card className="w-full shadow-lg">
            <CardContent className="pt-6 text-center">
              {/* Main heading */}
              <h1 className="text-xl sm:text-2xl font-bold mb-4 leading-tight">
                App created with{" "}
                <button 
                  onClick={handleGoHome}
                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer transition-colors"
                >
                  LNFly
                </button>
              </h1>

              {/* Subtitle explaining what LNFly is */}
              <p className="text-base sm:text-lg text-muted-foreground mb-4">
                AI-powered app creation platform
              </p>

              {/* Warning message */}
              <div className="text-sm text-orange-600 bg-orange-50 border border-orange-200 rounded-lg p-3 mb-6 text-left">
                <p className="font-medium mb-1">⚠️ Important Notice</p>
                <p>Apps on LNFly are vibe coded with AI. Use at your own risk.</p>
              </div>

              {/* Countdown display */}
              <div className="mb-6">
                <p className="text-base sm:text-lg mb-3">
                  Automatically loading app in:
                </p>
                <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-4 tabular-nums">
                  {countdown}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-1000 ease-linear shadow-sm"
                    style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">
                  {countdown > 0 ? `${countdown} second${countdown !== 1 ? 's' : ''} remaining` : 'Redirecting...'}
                </p>
              </div>

              {/* Action button */}
              <Button 
                onClick={handleViewNow}
                className="w-full text-base sm:text-lg py-3 bg-blue-600 hover:bg-blue-700 transition-colors"
                size="lg"
              >
                View App Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default AppLoadingPage;
import { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";

export default function AppLoadingPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [countdown, setCountdown] = useState(5);

  // Extract query parameters from the URL
  const queryParams = new URLSearchParams(location.search);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Replace the current page content with the actual app, preserving query params
      const targetUrl = `/api/apps/${id}/view${location.search}`;
      window.location.replace(targetUrl);
    }
  }, [countdown, id, location.search]);

  const handleViewNow = () => {
    const targetUrl = `/api/apps/${id}/view${location.search}`;
    window.location.replace(targetUrl);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
        {/* LNFly Branding */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            App created with{" "}
            <a 
              href="/" 
              className="text-orange-600 hover:text-orange-700 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              LNFly
            </a>
          </h1>
          <p className="text-gray-600 text-sm">
            Lightning-fast AI-powered app creation platform
          </p>
        </div>

        {/* Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 text-sm font-medium">
            ⚠️ Apps on LNFly are vibe coded with AI. Use at your own risk.
          </p>
        </div>

        {/* Countdown */}
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-2">
              <span className="text-2xl font-bold text-orange-600">{countdown}</span>
            </div>
            <p className="text-gray-600">
              {countdown > 0 
                ? `Loading app in ${countdown} second${countdown !== 1 ? 's' : ''}...`
                : 'Loading app...'
              }
            </p>
          </div>

          {/* Loading animation */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-600 h-2 rounded-full transition-all duration-1000"
              style={{ width: `${((5 - countdown) / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleViewNow}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
        >
          View App Now
        </button>

        {/* Footer */}
        <div className="text-xs text-gray-500 border-t pt-4">
          <p>
            Built with ⚡ Lightning Network integration
          </p>
        </div>
      </div>
    </div>
  );
}
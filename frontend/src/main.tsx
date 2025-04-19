import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom"; // Import necessary router components
import App from "./App.tsx";
import AppStatusPage from "./pages/AppStatusPage.tsx"; // Import status page component
// No need to import AppViewPage
import { Toaster } from "./components/ui/sonner.tsx";

import "./fonts.css";
import "./index.css";

// Create the browser router configuration
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // Main page component
  },
  {
    path: "/apps/:id",
    element: <AppStatusPage />, // App status page
  },
  // Remove the route for /apps/:id/view as it will be handled by the backend directly
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Provide the router instance */}
    <RouterProvider router={router} />
    <Toaster />
  </StrictMode>
);

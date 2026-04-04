import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import { AuthProvider } from "./pages/contexts/auth";
import { initMasters } from "./services/masters/seedMasters";
import { syncService } from "./services/sync";

console.log("🚀 Starting GST Billing App...");

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ Root element not found!");
  document.body.innerHTML =
    '<div style="padding: 20px; font-family: Arial;"><h1>Error: Root element not found</h1><p>Please check that index.html has a div with id="root"</p></div>';
  throw new Error("Root element not found");
}

const renderApp = () => {
  console.log("✅ Root element found, rendering app...");
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary>
          <Provider store={store}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </Provider>
        </ErrorBoundary>
      </React.StrictMode>
    );
    console.log("✅ App rendered successfully!");
  } catch (error) {
    console.error("❌ Error rendering app:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: Arial;">
        <h1>Error Loading App</h1>
        <p>${error instanceof Error ? error.message : "Unknown error"}</p>
        <p>Check the browser console for more details.</p>
      </div>
    `;
  }
};

const bootstrap = async () => {
  try {
    await initMasters();
  } catch (error) {
    console.error("⚠️ Failed to initialize master data:", error);
  }

  try {
    syncService.init();
    console.log("✅ Sync service initialized");
  } catch (error) {
    console.error("⚠️ Failed to initialize sync service:", error);
  }

  renderApp();
};

bootstrap();

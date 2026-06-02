import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import "./styles/theme.css";
import { AuthProvider } from "./pages/contexts/auth";
import { initMasters } from "./services/masters/seedMasters";
import { syncService } from "./services/sync";

console.log("🚀 Starting PVE InvoicePro 360...");

const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error("❌ Root element not found!");
  document.body.innerHTML =
    '<div style="padding: 20px; font-family: Arial;"><h1>Error: Root element not found</h1><p>Please check that index.html has a div with id="root"</p></div>';
  throw new Error("Root element not found");
}

/** Single React 18 root — never call replaceChildren() (breaks fiber / causes "Should have a queue"). */
let appRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

function getAppRoot() {
  if (!appRoot) {
    appRoot = ReactDOM.createRoot(rootElement!);
  }
  return appRoot;
}

const appTree = (
  <div data-react-mounted style={{ height: "100%", width: "100%" }}>
    <React.StrictMode>
      <ErrorBoundary>
        <Provider store={store}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  </div>
);

const renderApp = () => {
  console.log("✅ Root element found, rendering app...");
  try {
    getAppRoot().render(appTree);
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

renderApp();

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    renderApp();
  });
}

void (async () => {
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
})();

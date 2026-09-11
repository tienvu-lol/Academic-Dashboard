import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import App from "./App";
import {ErrorBoundary} from "./shared/ErrorBoundary";
import "../index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {staleTime: Infinity, retry: false, refetchOnWindowFocus: false},
  },
});

// Another browser tab may edit the same local database.
window.addEventListener("storage", () => void queryClient.invalidateQueries());
window.addEventListener("academic-data-changed", () => void queryClient.invalidateQueries({queryKey: ["academic-storage-summary"]}));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

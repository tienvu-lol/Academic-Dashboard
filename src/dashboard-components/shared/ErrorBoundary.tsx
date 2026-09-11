import {Check, Copy, RefreshCw} from "lucide-react";
import {Component, type ErrorInfo, type ReactNode} from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  componentStack: string;
  copyStatus: "idle" | "copied" | "failed";
};

const initialState: ErrorBoundaryState = {
  error: null,
  componentStack: "",
  copyStatus: "idle",
};

function getErrorStack(error: Error) {
  return error.stack || `${error.name}: ${error.message}`;
}

function formatErrorReport(error: Error, componentStack: string) {
  const lines = [
    "App crashed while rendering.",
    `Time: ${new Date().toISOString()}`,
    `URL: ${window.location.href}`,
    `User agent: ${navigator.userAgent}`,
    "",
    "Error stack:",
    getErrorStack(error),
  ];

  if (componentStack.trim()) {
    lines.push("", "React component stack:", componentStack.trim());
  }

  return lines.join("\n");
}

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the textarea path below. Some embedded contexts expose
    // navigator.clipboard but reject writes via permissions policy.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("document.execCommand('copy') returned false");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state = initialState;

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {error, copyStatus: "idle"};
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({componentStack: errorInfo.componentStack ?? ""});
    console.error("App render error", error, errorInfo.componentStack);
  }

  copyErrorReport = async () => {
    const {error, componentStack} = this.state;
    if (!error) {
      return;
    }

    try {
      await copyText(formatErrorReport(error, componentStack));
      this.setState({copyStatus: "copied"});
    } catch (copyError) {
      console.error("Unable to copy error report", copyError);
      this.setState({copyStatus: "failed"});
    }
  };

  reload = () => {
    window.location.reload();
  };

  render() {
    const {error, componentStack, copyStatus} = this.state;

    if (!error) {
      return this.props.children;
    }

    const report = formatErrorReport(error, componentStack);

    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
        <section
          role="alert"
          className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center gap-6 text-center"
        >
          <div className="space-y-3">
            <div
              className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-2xl"
              aria-hidden="true"
            >
              😵‍💫
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
              Please reload the page. If it doesn’t help, copy these details and send them to the agent.
            </p>
          </div>

          <div className="w-full overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-medium text-card-foreground">Error details</h2>
                <p className="mt-1 text-xs text-muted-foreground">Stack trace and React component stack.</p>
              </div>
              <button
                type="button"
                onClick={this.copyErrorReport}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {copyStatus === "copied" ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Unable to copy" : "Copy details"}
              </button>
            </div>
            <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap break-words bg-muted/60 p-4 font-mono text-xs leading-5 text-muted-foreground">
              {report}
            </pre>
          </div>

          <button
            type="button"
            onClick={this.reload}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Reload
          </button>
        </section>
      </main>
    );
  }
}

import { Toaster } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import Backtest from "./components/Backtest";
import Dashboard from "./components/Dashboard";
import Logs from "./components/Logs";
import OpenTrades from "./components/OpenTrades";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import TradeHistory from "./components/TradeHistory";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

type NavTab =
  | "dashboard"
  | "trades"
  | "history"
  | "logs"
  | "backtest"
  | "settings";

function AppContent() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-end border-b border-border bg-card/50 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-xs font-semibold text-foreground">
                Alex Carter
              </div>
              <div className="text-[10px] text-muted-foreground">
                Administrator
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-xs font-bold text-muted-foreground">
              AC
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "dashboard" && <Dashboard />}
          {activeTab === "trades" && <OpenTrades />}
          {activeTab === "history" && <TradeHistory />}
          {activeTab === "logs" && <Logs />}
          {activeTab === "backtest" && <Backtest />}
          {activeTab === "settings" && <Settings />}
        </div>
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "bg-card border-border text-foreground",
            description: "text-muted-foreground",
          },
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

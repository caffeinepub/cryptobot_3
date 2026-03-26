import { cn } from "@/lib/utils";
import {
  FlaskConical,
  History,
  LayoutDashboard,
  ScrollText,
  Settings,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useBotState } from "../hooks/useQueries";

type NavTab =
  | "dashboard"
  | "trades"
  | "history"
  | "logs"
  | "backtest"
  | "settings";

interface SidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

const navItems: {
  id: NavTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "trades", label: "Open Trades", icon: TrendingUp },
  { id: "history", label: "History", icon: History },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "backtest", label: "Backtest", icon: FlaskConical },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const { data: botState } = useBotState();
  const isRunning = botState?.isRunning ?? false;

  return (
    <aside
      className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-border bg-sidebar"
      style={{ boxShadow: "4px 0 20px rgba(0,0,0,0.3)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/10">
          <Zap className="h-4 w-4 text-success" />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-foreground">
            APEX TRADER
          </div>
          <div className="text-[10px] text-muted-foreground">Automated Bot</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              type="button"
              key={item.id}
              data-ocid={`nav.${item.id}.link`}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-success/10 text-success"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? "text-success" : "")} />
              <span>{item.label}</span>
              {isActive && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-success" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bot Status */}
      <div className="border-t border-border px-4 py-4">
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Bot Status
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                isRunning ? "bg-success pulse-green" : "bg-danger",
              )}
            />
            <span
              className={cn(
                "text-xs font-bold tracking-wider",
                isRunning ? "text-success" : "text-danger",
              )}
            >
              {isRunning ? "RUNNING" : "STOPPED"}
            </span>
          </div>
          {botState && (
            <div className="mt-2 text-[11px] text-muted-foreground">
              Losses:{" "}
              <span
                className={cn(
                  "font-medium",
                  Number(botState.consecutiveLosses) >= 3
                    ? "text-warning"
                    : "text-foreground",
                )}
              >
                {Number(botState.consecutiveLosses)}/5
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <div className="text-[10px] text-muted-foreground">
          © {new Date().getFullYear()}.{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground"
          >
            caffeine.ai
          </a>
        </div>
      </div>
    </aside>
  );
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { RefreshCw, ScrollText, Trash2 } from "lucide-react";
import { useState } from "react";
import type { LogEntry } from "../backend.d";
import { useClearLogs, useLogs } from "../hooks/useQueries";

type LevelFilter = "all" | "info" | "warning" | "error";

function formatTimestamp(ts: bigint): string {
  return new Date(Number(ts / 1_000_000n)).toLocaleString();
}

function LevelBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  const variants: Record<string, string> = {
    info: "bg-primary/15 text-primary border-primary/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    error: "bg-danger/15 text-danger border-danger/30",
  };
  const cls =
    variants[normalized] ?? "bg-muted/30 text-muted-foreground border-border";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px] uppercase tracking-wider px-2 py-0.5",
        cls,
      )}
    >
      {level}
    </Badge>
  );
}

const SKELETONS = [0, 1, 2, 3, 4, 5];

export default function Logs() {
  const { data: logs = [], isLoading, refetch, isFetching } = useLogs();
  const clearLogs = useClearLogs();
  const [filter, setFilter] = useState<LevelFilter>("all");

  const filtered =
    filter === "all"
      ? logs
      : logs.filter((e: LogEntry) => e.level.toLowerCase() === filter);

  const filterButtons: { id: LevelFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "info", label: "Info" },
    { id: "warning", label: "Warning" },
    { id: "error", label: "Error" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Activity Logs
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bot events and error tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-ocid="logs.refresh.button"
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8 border-border bg-card/60 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", isFetching && "animate-spin")}
            />
          </Button>

          {logs.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  data-ocid="logs.clear.open_modal_button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-danger/40 bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Logs
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent
                data-ocid="logs.clear.dialog"
                className="border-border bg-card text-foreground"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all logs?</AlertDialogTitle>
                  <AlertDialogDescription className="text-muted-foreground">
                    This will permanently delete all {logs.length} log entries.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel
                    data-ocid="logs.clear.cancel_button"
                    className="border-border bg-muted/30 text-foreground hover:bg-muted/50"
                  >
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    data-ocid="logs.clear.confirm_button"
                    onClick={() => clearLogs.mutate()}
                    className="bg-danger text-white hover:bg-danger/80"
                  >
                    Clear Logs
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1.5">
        {filterButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            data-ocid="logs.filter.tab"
            onClick={() => setFilter(btn.id)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-all duration-150",
              filter === btn.id
                ? "border-success/50 bg-success/10 text-success"
                : "border-border bg-card/50 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
            )}
          >
            {btn.label}
            {btn.id !== "all" && (
              <span className="ml-1.5 rounded-sm bg-muted/40 px-1 text-[10px]">
                {
                  logs.filter((e: LogEntry) => e.level.toLowerCase() === btn.id)
                    .length
                }
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card/60">
        {isLoading ? (
          <div data-ocid="logs.loading_state" className="space-y-2 p-4">
            {SKELETONS.map((n) => (
              <Skeleton
                key={n}
                className="h-10 w-full rounded-lg bg-muted/20"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            data-ocid="logs.empty_state"
            className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground"
          >
            <ScrollText className="h-10 w-10 opacity-20" />
            <p className="text-sm">No log entries</p>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="text-xs text-success/70 hover:text-success"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <ScrollArea className="h-[520px]">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-48 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Timestamp
                  </TableHead>
                  <TableHead className="w-28 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Level
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Message
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry: LogEntry, idx: number) => (
                  <TableRow
                    // biome-ignore lint/suspicious/noArrayIndexKey: log entries have no stable id
                    key={idx}
                    data-ocid={`logs.item.${idx + 1}`}
                    className="border-border transition-colors hover:bg-muted/10"
                  >
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={entry.level} />
                    </TableCell>
                    <TableCell className="text-sm text-foreground/90">
                      {entry.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

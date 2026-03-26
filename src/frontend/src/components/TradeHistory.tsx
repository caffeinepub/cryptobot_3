import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { History } from "lucide-react";
import { motion } from "motion/react";
import type { Trade } from "../backend.d";
import { useAllTrades, usePnLSummary } from "../hooks/useQueries";

function formatTime(nanos: bigint | undefined): string {
  if (!nanos) return "—";
  const ms = Number(nanos) / 1_000_000;
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(openNs: bigint, closeNs: bigint | undefined): string {
  if (!closeNs) return "—";
  const diff = Number(closeNs - openNs) / 1_000_000;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function TradeHistory() {
  const { data: allTrades, isLoading } = useAllTrades();
  const { data: pnl } = usePnLSummary();

  const closedTrades = (allTrades ?? []).filter(
    (t: Trade) => t.status === "closed",
  );

  return (
    <div className="space-y-6" data-ocid="history.panel">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">
          Trade History
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          All closed positions
        </p>
      </div>

      {/* Summary stats */}
      {pnl && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          {[
            {
              label: "Total Trades",
              value: String(Number(pnl.totalTrades)),
              neutral: true,
            },
            {
              label: "Total PnL",
              value: `${pnl.totalPnL >= 0 ? "+" : ""}$${pnl.totalPnL.toFixed(2)}`,
              up: pnl.totalPnL >= 0,
            },
            {
              label: "Win Rate",
              value: `${pnl.winRate.toFixed(2)}%`,
              neutral: true,
            },
            {
              label: "Wins",
              value: `${Number(pnl.winningTrades)} / ${Number(pnl.totalTrades)}`,
              neutral: true,
            },
          ].map((stat) => (
            <div key={stat.label} className="card-panel p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </div>
              <div
                className={cn(
                  "mt-1 text-xl font-bold mono",
                  stat.neutral
                    ? "text-foreground"
                    : stat.up
                      ? "text-success"
                      : "text-danger",
                )}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="card-panel overflow-hidden"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
            Closed Trades
          </h2>
        </div>

        {isLoading ? (
          <div
            className="flex h-40 items-center justify-center"
            data-ocid="history.loading_state"
          >
            <div className="text-sm text-muted-foreground">
              Loading history...
            </div>
          </div>
        ) : closedTrades.length === 0 ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-3"
            data-ocid="history.empty_state"
          >
            <History className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">
              No closed trades yet
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pair
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Entry
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Exit
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Size
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    PnL
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Reason
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Duration
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedTrades.map((trade: Trade, i: number) => {
                  const pnlVal = trade.pnl ?? 0;
                  return (
                    <TableRow
                      key={String(trade.id)}
                      data-ocid={`history.row.item.${i + 1}`}
                      className="border-border hover:bg-muted/20 transition-colors"
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {formatTime(trade.openTime)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground">
                        {trade.pair}
                      </TableCell>
                      <TableCell className="mono text-xs text-foreground">
                        ${trade.entryPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="mono text-xs text-muted-foreground">
                        {trade.exitPrice
                          ? `$${trade.exitPrice.toFixed(2)}`
                          : "—"}
                      </TableCell>
                      <TableCell className="mono text-xs text-muted-foreground">
                        {trade.size.toFixed(6)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "mono text-xs font-bold",
                          pnlVal >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {pnlVal >= 0 ? "+" : ""}${pnlVal.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "text-[10px]",
                            trade.closeReason === "take_profit"
                              ? "bg-success/10 text-success border-success/30"
                              : trade.closeReason === "stop_loss"
                                ? "bg-danger/10 text-danger border-danger/30"
                                : "bg-warning/10 text-warning border-warning/30",
                          )}
                        >
                          {trade.closeReason ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDuration(trade.openTime, trade.closeTime)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>
    </div>
  );
}

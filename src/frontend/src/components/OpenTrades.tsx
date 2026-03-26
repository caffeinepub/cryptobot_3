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
import { TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import type { Trade } from "../backend.d";
import { useBotState, useOpenTrades } from "../hooks/useQueries";

function formatDuration(openTimeBigInt: bigint): string {
  const openTime = Number(openTimeBigInt) / 1_000_000; // nanoseconds to ms
  const now = Date.now();
  const diff = now - openTime;
  if (diff < 0) return "—";
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  return `${mins}m`;
}

export default function OpenTrades() {
  const { data: trades, isLoading } = useOpenTrades();
  const { data: botState } = useBotState();

  const currentPrice = botState?.lastPrice ?? 0;

  return (
    <div className="space-y-6" data-ocid="trades.panel">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">
          Open Trades
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {trades
            ? `${trades.length} active position${trades.length !== 1 ? "s" : ""}`
            : "Loading..."}
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="card-panel overflow-hidden"
      >
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
            Active Positions
          </h2>
        </div>

        {isLoading ? (
          <div
            className="flex h-40 items-center justify-center"
            data-ocid="trades.loading_state"
          >
            <div className="text-sm text-muted-foreground">
              Loading trades...
            </div>
          </div>
        ) : !trades || trades.length === 0 ? (
          <div
            className="flex h-40 flex-col items-center justify-center gap-3"
            data-ocid="trades.empty_state"
          >
            <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
            <div className="text-sm text-muted-foreground">No open trades</div>
            <div className="text-xs text-muted-foreground/60">
              Bot will open positions when conditions are met
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  ID
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pair
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Entry Price
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Price
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Size
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Unrealized PnL
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Time Open
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade: Trade, i: number) => {
                const unrealizedPnl =
                  currentPrice > 0
                    ? (currentPrice - trade.entryPrice) * trade.size
                    : null;
                return (
                  <TableRow
                    key={String(trade.id)}
                    data-ocid={`trades.row.item.${i + 1}`}
                    className="border-border hover:bg-muted/20 transition-colors"
                  >
                    <TableCell className="mono text-xs text-muted-foreground">
                      #{String(trade.id)}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-foreground">
                      {trade.pair}
                    </TableCell>
                    <TableCell className="mono text-xs text-foreground">
                      ${trade.entryPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="mono text-xs text-foreground">
                      ${currentPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="mono text-xs text-muted-foreground">
                      {trade.size.toFixed(6)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "mono text-xs font-semibold",
                        unrealizedPnl === null
                          ? "text-muted-foreground"
                          : unrealizedPnl >= 0
                            ? "text-success"
                            : "text-danger",
                      )}
                    >
                      {unrealizedPnl !== null
                        ? `${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDuration(trade.openTime)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-success/10 text-success border-success/30 text-[10px]">
                        OPEN
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </motion.div>
    </div>
  );
}

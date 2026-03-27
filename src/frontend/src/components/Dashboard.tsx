import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart2,
  DollarSign,
  Play,
  RefreshCw,
  Square,
  TrendingUp,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";
import {
  useBotState,
  useManualTick,
  usePnLSummary,
  useStartBot,
  useStopBot,
} from "../hooks/useQueries";

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="card-panel p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div
        className={cn(
          "mono text-2xl font-bold",
          trend === "up"
            ? "text-success"
            : trend === "down"
              ? "text-danger"
              : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </motion.div>
  );
}

function SimpleLineChart({
  price,
  ema50,
  ema200,
}: { price: number; ema50: number; ema200: number }) {
  const points = useMemo(() => {
    const base = price * 0.95;
    const range = price * 0.07;
    const result: number[] = [];
    for (let i = 0; i < 60; i++) {
      const t = i / 59;
      const noise =
        Math.sin(i * 1.3) * 0.4 +
        Math.sin(i * 0.7) * 0.3 +
        Math.cos(i * 2.1) * 0.3;
      result.push(base + range * t + noise * range * 0.3);
    }
    result[result.length - 1] = price;
    return result;
  }, [price]);

  const allValues = [...points, ema50, ema200];
  const minVal = Math.min(...allValues) * 0.999;
  const maxVal = Math.max(...allValues) * 1.001;
  const span = maxVal - minVal || 1;

  const W = 800;
  const H = 180;
  const pad = { left: 60, right: 20, top: 10, bottom: 30 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const toX = (i: number) => pad.left + (i / (points.length - 1)) * iW;
  const toY = (v: number) => pad.top + iH - ((v - minVal) / span) * iH;

  const pathD = points
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`,
    )
    .join(" ");
  const fillD = `${pathD} L ${toX(points.length - 1)} ${H - pad.bottom} L ${toX(0)} ${H - pad.bottom} Z`;

  const ema50Y = toY(ema50);
  const ema200Y = toY(ema200);

  const yTicks = [
    minVal,
    minVal + span * 0.25,
    minVal + span * 0.5,
    minVal + span * 0.75,
    maxVal,
  ];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 180 }}
      aria-label="Price chart"
      role="img"
    >
      <title>Price Chart</title>
      {yTicks.map((v) => (
        <g key={v.toFixed(0)}>
          <line
            x1={pad.left}
            y1={toY(v)}
            x2={W - pad.right}
            y2={toY(v)}
            stroke="oklch(0.27 0.014 222)"
            strokeWidth="1"
          />
          <text
            x={pad.left - 6}
            y={toY(v) + 4}
            textAnchor="end"
            fontSize="9"
            fill="oklch(0.68 0.015 220)"
            fontFamily="JetBrains Mono"
          >
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      <path d={fillD} fill="oklch(0.73 0.19 152 / 0.06)" />
      <path
        d={pathD}
        fill="none"
        stroke="oklch(0.73 0.19 152)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <line
        x1={pad.left}
        y1={ema200Y}
        x2={W - pad.right}
        y2={ema200Y}
        stroke="oklch(0.64 0.22 25)"
        strokeWidth="1.5"
        strokeDasharray="6,3"
      />
      <text
        x={W - pad.right + 2}
        y={ema200Y + 4}
        fontSize="8"
        fill="oklch(0.64 0.22 25)"
        fontFamily="JetBrains Mono"
      >
        EMA200
      </text>
      <line
        x1={pad.left}
        y1={ema50Y}
        x2={W - pad.right}
        y2={ema50Y}
        stroke="oklch(0.85 0.16 80)"
        strokeWidth="1.5"
        strokeDasharray="6,3"
      />
      <text
        x={W - pad.right + 2}
        y={ema50Y + 4}
        fontSize="8"
        fill="oklch(0.85 0.16 80)"
        fontFamily="JetBrains Mono"
      >
        EMA50
      </text>
      <circle
        cx={toX(points.length - 1)}
        cy={toY(price)}
        r="4"
        fill="oklch(0.73 0.19 152)"
        stroke="oklch(0.20 0.013 222)"
        strokeWidth="2"
      />
    </svg>
  );
}

function RSIBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    value > 70
      ? "oklch(0.64 0.22 25)"
      : value < 45
        ? "oklch(0.73 0.19 152)"
        : "oklch(0.85 0.16 80)";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">RSI (14)</span>
        <span className="mono font-semibold" style={{ color }}>
          {value.toFixed(2)}
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/50">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${clamped}%`, background: color }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: "45%",
            width: 1,
            background: "oklch(0.73 0.19 152 / 0.5)",
          }}
        />
        <div
          className="absolute inset-y-0"
          style={{
            left: "70%",
            width: 1,
            background: "oklch(0.64 0.22 25 / 0.5)",
          }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0</span>
        <span style={{ marginLeft: "calc(45% - 8px)" }}>45</span>
        <span style={{ marginLeft: "calc(25% - 8px)" }}>70</span>
        <span>100</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: botState, isLoading: stateLoading } = useBotState();
  const { data: pnl } = usePnLSummary();
  const startBot = useStartBot();
  const stopBot = useStopBot();
  const manualTick = useManualTick();

  const handleStart = async () => {
    try {
      await startBot.mutateAsync();
      toast.success("Bot started successfully");
    } catch (e) {
      toast.error(`Failed to start bot: ${e}`);
    }
  };

  const handleStop = async () => {
    try {
      await stopBot.mutateAsync();
      toast.success("Bot stopped");
    } catch (e) {
      toast.error(`Failed to stop bot: ${e}`);
    }
  };

  const handleTick = async () => {
    try {
      const result = await manualTick.mutateAsync();
      toast.success(`Tick: ${result}`);
    } catch (e) {
      toast.error(`Tick failed: ${e}`);
    }
  };

  const isBullish = botState ? botState.ema50 > botState.ema200 : false;
  const priceNearEma50 = botState
    ? Math.abs((botState.lastPrice - botState.ema50) / botState.ema50) < 0.01
    : false;

  const pnlTrend = (botState?.totalPnL ?? 0) >= 0 ? "up" : "down";
  const pnlFormatted = botState
    ? `${botState.totalPnL >= 0 ? "+" : ""}$${botState.totalPnL.toFixed(2)}`
    : "$0.00";

  const rsiInRange = botState
    ? botState.rsi >= 45 && botState.rsi <= 70
    : false;

  return (
    <div className="space-y-6" data-ocid="dashboard.panel">
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">
          Dashboard
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Overview ·{" "}
          <span className="font-medium text-foreground">
            {botState ? "BTC/USDT" : "—"}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <MetricCard
          index={0}
          label="Capital"
          value={
            botState
              ? `$${botState.capital.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "—"
          }
          sub="Available balance"
          icon={DollarSign}
          trend="neutral"
        />
        <MetricCard
          index={1}
          label="Total PnL"
          value={stateLoading ? "—" : pnlFormatted}
          sub={pnl ? `${Number(pnl.totalTrades)} trades` : undefined}
          icon={TrendingUp}
          trend={pnlTrend}
        />
        <MetricCard
          index={2}
          label="Win Rate"
          value={pnl ? `${pnl.winRate.toFixed(2)}%` : "—"}
          sub={pnl ? `${Number(pnl.winningTrades)} wins` : undefined}
          icon={Activity}
          trend="neutral"
        />
        <MetricCard
          index={3}
          label="Open Trades"
          value={botState ? String(Number(botState.openTradesCount)) : "—"}
          sub="Max 10 concurrent"
          icon={BarChart2}
          trend="neutral"
        />
      </div>

      {/* Indicators panel */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
        className="card-panel p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
            Market Indicators
          </h2>
          <Badge
            className={cn(
              "text-[10px] font-bold uppercase tracking-wider",
              isBullish
                ? "border-success/30 bg-success/10 text-success"
                : "border-danger/30 bg-danger/10 text-danger",
            )}
          >
            {isBullish ? "● BULLISH" : "● BEARISH"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">BTC Price</span>
              <span className="mono text-sm font-semibold text-foreground">
                ${botState?.lastPrice.toFixed(2) ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: "oklch(0.85 0.16 80)" }}
                />
                <span className="text-xs text-muted-foreground">EMA 50</span>
              </div>
              <span className="mono text-sm font-semibold text-warning">
                ${botState?.ema50.toFixed(2) ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ background: "oklch(0.64 0.22 25)" }}
                />
                <span className="text-xs text-muted-foreground">EMA 200</span>
              </div>
              <span className="mono text-sm font-semibold text-danger">
                ${botState?.ema200.toFixed(2) ?? "—"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Price near EMA50
              </span>
              <Badge
                className={cn(
                  "text-[10px]",
                  priceNearEma50
                    ? "border-success/30 bg-success/10 text-success"
                    : "bg-muted/50 text-muted-foreground",
                )}
              >
                {priceNearEma50 ? "YES" : "NO"}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            {botState ? (
              <RSIBar value={botState.rsi} />
            ) : (
              <div className="text-sm text-muted-foreground">
                Loading indicators...
              </div>
            )}
            <div className="space-y-1.5 rounded-lg bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Signal Analysis
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Trend (EMA50 &gt; EMA200)
                  </span>
                  <span className={isBullish ? "text-success" : "text-danger"}>
                    {isBullish ? "✓ Bullish" : "✗ Bearish"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    RSI Entry Signal (45–70)
                  </span>
                  <span
                    className={
                      rsiInRange ? "text-success" : "text-muted-foreground"
                    }
                  >
                    {botState ? (rsiInRange ? "✓ Ready" : "✗ Wait") : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Price chart */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="card-panel p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
            Price Chart
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <div
                className="h-0.5 w-4"
                style={{ background: "oklch(0.73 0.19 152)" }}
              />
              Price
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: "oklch(0.85 0.16 80)" }}
              />
              EMA50
            </div>
            <div className="flex items-center gap-1">
              <div
                className="h-0.5 w-4 border-t-2 border-dashed"
                style={{ borderColor: "oklch(0.64 0.22 25)" }}
              />
              EMA200
            </div>
          </div>
        </div>
        {botState ? (
          <SimpleLineChart
            price={botState.lastPrice}
            ema50={botState.ema50}
            ema200={botState.ema200}
          />
        ) : (
          <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
            Waiting for price data...
          </div>
        )}
      </motion.div>

      {/* Bot Controls */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.48 }}
        className="card-panel p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
            Bot Controls
          </h2>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                botState?.isRunning ? "bg-success pulse-green" : "bg-danger",
              )}
            />
            <span
              className={cn(
                "text-xs font-bold tracking-wider",
                botState?.isRunning ? "text-success" : "text-danger",
              )}
            >
              {botState?.isRunning ? "RUNNING" : "STOPPED"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            data-ocid="bot.start.primary_button"
            onClick={handleStart}
            disabled={botState?.isRunning || startBot.isPending}
            className="gap-2 border border-success/30 bg-success/10 text-success hover:bg-success/20 disabled:opacity-40"
            variant="ghost"
          >
            {startBot.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start Bot
          </Button>

          <Button
            data-ocid="bot.stop.secondary_button"
            onClick={handleStop}
            disabled={!botState?.isRunning || stopBot.isPending}
            className="gap-2 border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-40"
            variant="ghost"
          >
            {stopBot.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            Stop Bot
          </Button>

          <Button
            data-ocid="bot.tick.button"
            onClick={handleTick}
            disabled={manualTick.isPending}
            variant="ghost"
            className="gap-2 border border-border text-muted-foreground hover:text-foreground"
          >
            {manualTick.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Manual Tick
          </Button>

          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <div>
              Consecutive Losses:{" "}
              <span
                className={cn(
                  "mono font-semibold",
                  Number(botState?.consecutiveLosses ?? 0) >= 3
                    ? "text-warning"
                    : "text-foreground",
                )}
              >
                {Number(botState?.consecutiveLosses ?? 0)}/5
              </span>
            </div>
            {Number(botState?.consecutiveLosses ?? 0) >= 5 && (
              <Badge className="border-danger/30 bg-danger/10 text-[10px] text-danger">
                TRADING HALTED
              </Badge>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

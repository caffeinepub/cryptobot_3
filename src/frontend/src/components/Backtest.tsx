import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  FlaskConical,
  Loader2,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";

// ---- Types ----

interface Candle {
  open: number;
  close: number;
  high: number;
  low: number;
  time: number;
}

interface Trade {
  entryIndex: number;
  entryPrice: number;
  exitPrice: number;
  exitIndex: number;
  pnlDollar: number;
  pnlPct: number;
  reason: "TP" | "SL" | "TRAIL";
  size: number; // dollars invested
}

interface BacktestResults {
  startingBalance: number;
  finalBalance: number;
  totalProfitPct: number;
  numTrades: number;
  winRate: number;
  maxDrawdown: number;
  profitFactor: number;
  avgDuration: number;
  trades: Trade[];
}

type Coin = "BTC" | "ETH" | "SOL";

const COIN_SYMBOLS: Record<Coin, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  SOL: "SOLUSDT",
};

// ---- Indicator calculations ----

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = new Array(closes.length).fill(0);
  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  ema[period - 1] = sum / period;
  for (let i = period; i < closes.length; i++) {
    ema[i] = closes[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(50);
  if (closes.length < period + 1) return rsi;

  // Initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss += -diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = 100 - 100 / (1 + rs0);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi[i] = 100 - 100 / (1 + rs);
  }
  return rsi;
}

// ---- Simulation ----

function runSimulation(candles: Candle[]): BacktestResults {
  const TRADING_FEE = 0.001; // 0.1% per side
  const SLIPPAGE = 0.0005; // 0.05% per side
  // TOTAL_COST = 0.15% per side, 0.3% round-trip

  const closes = candles.map((c) => c.close);
  const opens = candles.map((c) => c.open);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi = calcRSI(closes, 14);

  const STARTING_BALANCE = 10000;
  let balance = STARTING_BALANCE;
  const equityCurve: number[] = [STARTING_BALANCE];

  interface OpenPos {
    entryIndex: number;
    entryPrice: number; // slippage-adjusted effective entry price
    highestPrice: number;
    size: number; // dollars
  }

  const openPositions: OpenPos[] = [];
  const closedTrades: Trade[] = [];
  let consecutiveLosses = 0;

  const START_INDEX = 210; // ensure EMA200 seeded

  let lastTradeIndex = -1; // cooldown tracking

  for (let i = START_INDEX; i < candles.length; i++) {
    const price = closes[i];
    const e50 = ema50[i];
    const e200 = ema200[i];
    const r = rsi[i];

    // Check exit for all open positions
    for (let p = openPositions.length - 1; p >= 0; p--) {
      const pos = openPositions[p];
      let exitReason: "TP" | "SL" | "TRAIL" | null = null;

      // Update highest price seen
      if (price > pos.highestPrice) pos.highestPrice = price;

      if (price >= pos.entryPrice * 1.055) exitReason = "TP";
      else if (price <= pos.entryPrice * 0.965) exitReason = "SL";
      else {
        // Trailing stop: activate at +3%, trail 1.5% below highest
        const profitPct = (price - pos.entryPrice) / pos.entryPrice;
        if (profitPct >= 0.03 && price <= pos.highestPrice * 0.985) {
          exitReason = "TRAIL";
        }
      }

      if (exitReason) {
        // Apply exit slippage — effective exit price is worse (lower)
        const effectiveExitPrice = price * (1 - SLIPPAGE);
        const pnlPct = (effectiveExitPrice - pos.entryPrice) / pos.entryPrice;
        let pnlDollar = pos.size * pnlPct;
        // Deduct exit fee on position value + profit
        const exitFee = (pos.size + Math.max(0, pnlDollar)) * TRADING_FEE;
        pnlDollar -= exitFee;
        balance += pos.size + pnlDollar;

        if (pnlDollar < 0) consecutiveLosses++;
        else consecutiveLosses = 0;

        closedTrades.push({
          entryIndex: pos.entryIndex,
          entryPrice: pos.entryPrice,
          exitPrice: effectiveExitPrice,
          exitIndex: i,
          pnlDollar,
          pnlPct: pnlPct * 100,
          reason: exitReason,
          size: pos.size,
        });

        openPositions.splice(p, 1);
      }
    }

    // Entry check — strong breakout above 8-candle HIGH
    if (i > START_INDEX + 8) {
      // Breakout level = highest HIGH of the last 8 candles (excluding current)
      const breakoutLevel = Math.max(
        ...candles.slice(i - 8, i).map((c) => c.high),
      );
      // Momentum filter: candle body must be at least 0.5% of price (clearly bullish)
      const candleBody = Math.abs(closes[i] - opens[i]);
      const bodyPct = candleBody / opens[i];

      // Choppy market filter: avg body of last 3 candles must be >= 0.15% of price
      const avgBodyLast3 =
        (Math.abs(closes[i - 1] - opens[i - 1]) +
          Math.abs(closes[i - 2] - opens[i - 2]) +
          Math.abs(closes[i - 3] - opens[i - 3])) /
        3;
      const avgBodyPctLast3 = avgBodyLast3 / price;

      if (
        consecutiveLosses < 5 &&
        openPositions.length < 5 &&
        e50 > e200 && // EMA50 > EMA200 (bullish trend)
        price > e50 && // price above EMA50
        price > breakoutLevel && // close must be above 8-candle high
        price >= breakoutLevel * 1.002 && // at least 0.2% above previous high (real breakout)
        closes[i] > opens[i] && // breakout candle must be bullish
        bodyPct >= 0.005 && // clearly bullish: body >= 0.5% of price
        avgBodyPctLast3 >= 0.0015 && // choppy filter: last 3 candles not tiny/sideways
        r >= 45 &&
        r <= 65 && // RSI between 45 and 65
        i - lastTradeIndex > 5 // cooldown
      ) {
        const size = balance * 0.03;
        const effectiveEntryPrice = price * (1 + SLIPPAGE);
        balance -= size;
        balance -= size * TRADING_FEE;
        openPositions.push({
          entryIndex: i,
          entryPrice: effectiveEntryPrice,
          highestPrice: price,
          size,
        });
        lastTradeIndex = i;
      }
    }

    equityCurve.push(balance + openPositions.reduce((s, p) => s + p.size, 0));
  }

  // Close remaining open positions at last price
  const lastPrice = closes[closes.length - 1];
  for (const pos of openPositions) {
    const effectiveExitPrice = lastPrice * (1 - SLIPPAGE);
    const pnlPct = (effectiveExitPrice - pos.entryPrice) / pos.entryPrice;
    let pnlDollar = pos.size * pnlPct;
    const exitFee = (pos.size + Math.max(0, pnlDollar)) * TRADING_FEE;
    pnlDollar -= exitFee;
    balance += pos.size + pnlDollar;
    closedTrades.push({
      entryIndex: pos.entryIndex,
      entryPrice: pos.entryPrice,
      exitPrice: effectiveExitPrice,
      exitIndex: candles.length - 1,
      pnlDollar,
      pnlPct: pnlPct * 100,
      reason: "TRAIL",
      size: pos.size,
    });
  }

  // Max drawdown from equity curve
  let peak = equityCurve[0];
  let maxDD = 0;
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq;
    const dd = (peak - eq) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  const wins = closedTrades.filter((t) => t.pnlDollar > 0);
  const losses = closedTrades.filter((t) => t.pnlDollar <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnlDollar, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlDollar, 0));
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

  const avgDuration =
    closedTrades.length > 0
      ? closedTrades.reduce((s, t) => s + (t.exitIndex - t.entryIndex), 0) /
        closedTrades.length
      : 0;

  return {
    startingBalance: STARTING_BALANCE,
    finalBalance: balance,
    totalProfitPct: ((balance - STARTING_BALANCE) / STARTING_BALANCE) * 100,
    numTrades: closedTrades.length,
    winRate:
      closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
    maxDrawdown: maxDD * 100,
    profitFactor,
    avgDuration,
    trades: closedTrades,
  };
}

// ---- Data fetching ----

async function fetchAllCandles(
  symbol: string,
  onProgress: (batch: number, total: number) => void,
  signal: AbortSignal,
): Promise<Candle[]> {
  const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;
  const INTERVAL_MS = 15 * 60 * 1000; // 15m
  const BATCH = 1000;
  const totalCandles = Math.ceil(MS_PER_YEAR / INTERVAL_MS);
  const totalBatches = Math.ceil(totalCandles / BATCH);

  let startTime = Date.now() - MS_PER_YEAR;
  const now = Date.now();
  const candles: Candle[] = [];
  let batchNum = 0;

  while (startTime < now) {
    if (signal.aborted) throw new Error("Aborted");
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=${BATCH}&startTime=${startTime}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = await res.json();
    if (!data.length) break;

    for (const k of data) {
      candles.push({
        time: Number(k[0]),
        open: Number.parseFloat(k[1]),
        close: Number.parseFloat(k[4]),
        high: Number.parseFloat(k[2]),
        low: Number.parseFloat(k[3]),
      });
    }

    startTime = Number(data[data.length - 1][6]) + 1; // closeTime + 1ms
    batchNum++;
    onProgress(batchNum, totalBatches);

    // small yield to keep UI responsive
    await new Promise((r) => setTimeout(r, 0));
  }

  return candles;
}

// ---- Stat card ----

function StatCard({
  label,
  value,
  sub,
  color,
  index,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "green" | "red" | "amber" | "neutral";
  index: number;
}) {
  const colorClass =
    color === "green"
      ? "text-success"
      : color === "red"
        ? "text-danger"
        : color === "amber"
          ? "text-warning"
          : "text-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
      className="card-panel p-5"
    >
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={cn("mono text-2xl font-bold", colorClass)}>{value}</div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      )}
    </motion.div>
  );
}

// ---- Main component ----

export default function Backtest() {
  const [status, setStatus] = useState<
    "idle" | "fetching" | "simulating" | "done" | "error"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<Coin>("BTC");
  const abortRef = useRef<AbortController | null>(null);

  const symbol = COIN_SYMBOLS[selectedCoin];
  const pairLabel = `${selectedCoin}/USDT`;

  const handleRun = async () => {
    setStatus("fetching");
    setProgress(0);
    setProgressText("Fetching data...");
    setResults(null);
    setErrorMsg("");

    abortRef.current = new AbortController();
    try {
      const candles = await fetchAllCandles(
        symbol,
        (batch, total) => {
          setProgress(Math.round((batch / total) * 80));
          setProgressText(`Fetching data... batch ${batch}/${total}`);
        },
        abortRef.current.signal,
      );

      setStatus("simulating");
      setProgress(85);
      setProgressText(
        `Running simulation on ${candles.length.toLocaleString()} candles...`,
      );

      // yield to let UI update
      await new Promise((r) => setTimeout(r, 30));

      const res = runSimulation(candles);

      setProgress(100);
      setProgressText("Done!");
      setResults(res);
      setStatus("done");
    } catch (e: unknown) {
      if ((e as Error)?.message === "Aborted") {
        setStatus("idle");
      } else {
        setErrorMsg((e as Error)?.message ?? "Unknown error");
        setStatus("error");
      }
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  const isRunning = status === "fetching" || status === "simulating";

  const reasonBadge = (r: "TP" | "SL" | "TRAIL") => {
    if (r === "TP")
      return (
        <Badge className="border-success/30 bg-success/10 text-[10px] text-success">
          TP
        </Badge>
      );
    if (r === "SL")
      return (
        <Badge className="border-danger/30 bg-danger/10 text-[10px] text-danger">
          SL
        </Badge>
      );
    if (r === "TRAIL")
      return (
        <Badge className="border-warning/30 bg-warning/10 text-[10px] text-warning">
          Trail
        </Badge>
      );
    return null;
  };

  return (
    <div className="space-y-6" data-ocid="backtest.panel">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">
          Backtest
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Simulate the strategy on 1 year of {pairLabel} 15m historical data
        </p>
      </div>

      {/* Config summary */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="card-panel p-5"
      >
        <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Simulation Parameters
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
          {[
            ["Symbol", pairLabel],
            ["Timeframe", "15m"],
            ["Period", "1 year"],
            ["Starting Balance", "$10,000"],
            ["Position Size", "3% of balance"],
            ["Max Open Trades", "5"],
            ["Entry RSI", "45 – 65"],
            ["Breakout Filter", "Close > 8-Candle HIGH"],
            ["Min Breakout Margin", "0.2% above high"],
            ["Momentum Body", "Body ≥ 0.5% (clearly bullish)"],
            ["Choppy Filter", "Last 3 candles avg body ≥ 0.15%"],
            ["Candle Type", "Bullish (Close > Open)"],
            ["Trend Filter", "EMA50 > EMA200"],
            ["Momentum", "Price > EMA50"],
            ["Trailing Stop", "+3% activate"],
            ["Trail Distance", "1.5% below high"],
            ["Take Profit", "+5.5%"],
            ["Stop Loss", "-3.5%"],
            ["Trading Fee", "0.1% / side"],
            ["Slippage", "0.05% / side"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-muted/30 px-3 py-2">
              <div className="text-muted-foreground">{k}</div>
              <div className="mono mt-0.5 font-semibold text-foreground">
                {v}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Coin selector + Run button */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="card-panel p-5"
      >
        <div className="mb-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            Select Coin
          </div>
          <ToggleGroup
            type="single"
            value={selectedCoin}
            onValueChange={(v) => {
              if (v) setSelectedCoin(v as Coin);
            }}
            disabled={isRunning}
            className="justify-start gap-2"
            data-ocid="backtest.toggle"
          >
            {(["BTC", "ETH", "SOL"] as Coin[]).map((coin) => (
              <ToggleGroupItem
                key={coin}
                value={coin}
                data-ocid={`backtest.${coin.toLowerCase()}.tab`}
                className={cn(
                  "mono h-9 w-20 rounded-lg border text-xs font-bold tracking-wider transition-all",
                  selectedCoin === coin
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {coin}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button
            data-ocid="backtest.primary_button"
            onClick={isRunning ? handleCancel : handleRun}
            disabled={false}
            className={cn(
              "gap-2 font-semibold tracking-wider",
              isRunning
                ? "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                : "border border-success/30 bg-success/10 text-success hover:bg-success/20",
            )}
            variant="ghost"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Cancel
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4" />
                Run Backtest
              </>
            )}
          </Button>

          {isRunning && (
            <div className="flex-1 space-y-1.5">
              <div className="text-xs text-muted-foreground">
                {progressText}
              </div>
              <Progress
                data-ocid="backtest.loading_state"
                value={progress}
                className="h-2"
              />
            </div>
          )}

          {status === "done" && results && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Simulation complete — {results.numTrades} trades analyzed on{" "}
              {pairLabel}
            </div>
          )}

          {status === "error" && (
            <div
              data-ocid="backtest.error_state"
              className="flex items-center gap-2 text-sm text-danger"
            >
              <AlertCircle className="h-4 w-4" />
              {errorMsg}
            </div>
          )}
        </div>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {status === "done" && results && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                index={0}
                label="Starting Balance"
                value="$10,000"
                color="neutral"
              />
              <StatCard
                index={1}
                label="Final Balance"
                value={`$${results.finalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                color={results.finalBalance >= 10000 ? "green" : "red"}
              />
              <StatCard
                index={2}
                label="Total Profit"
                value={`${results.totalProfitPct >= 0 ? "+" : ""}${results.totalProfitPct.toFixed(2)}%`}
                color={results.totalProfitPct >= 0 ? "green" : "red"}
                sub={`$${(results.finalBalance - 10000).toFixed(2)}`}
              />
              <StatCard
                index={3}
                label="Num Trades"
                value={String(results.numTrades)}
                color="neutral"
              />
              <StatCard
                index={4}
                label="Win Rate"
                value={`${results.winRate.toFixed(1)}%`}
                color={
                  results.winRate >= 55
                    ? "green"
                    : results.winRate >= 45
                      ? "amber"
                      : "red"
                }
                sub={`${Math.round((results.winRate / 100) * results.numTrades)} wins / ${results.numTrades - Math.round((results.winRate / 100) * results.numTrades)} losses`}
              />
              <StatCard
                index={5}
                label="Max Drawdown"
                value={`-${results.maxDrawdown.toFixed(2)}%`}
                color={
                  results.maxDrawdown < 10
                    ? "green"
                    : results.maxDrawdown < 20
                      ? "amber"
                      : "red"
                }
              />
              <StatCard
                index={6}
                label="Profit Factor"
                value={results.profitFactor.toFixed(2)}
                color={
                  results.profitFactor >= 1.5
                    ? "green"
                    : results.profitFactor >= 1
                      ? "amber"
                      : "red"
                }
                sub="gross profit / gross loss"
              />
              <StatCard
                index={7}
                label="Avg Trade Duration"
                value={`${results.avgDuration.toFixed(0)} candles`}
                sub={`≈ ${((results.avgDuration * 15) / 60).toFixed(1)} hours`}
                color="neutral"
              />
            </div>

            {/* Trade table */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="card-panel"
            >
              <div className="border-b border-border px-5 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-foreground">
                    Trade Log — {pairLabel}
                  </h2>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-success" />
                      {results.trades.filter((t) => t.pnlDollar > 0).length}{" "}
                      wins
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-danger" />
                      {results.trades.filter((t) => t.pnlDollar <= 0).length}{" "}
                      losses
                    </span>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        #
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Entry Price
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Exit Price
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        PnL $
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        PnL %
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Reason
                      </TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Duration
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.trades.map((trade, idx) => (
                      <TableRow
                        key={`${trade.entryIndex}-${trade.exitIndex}`}
                        data-ocid={`backtest.trade.item.${idx + 1}`}
                        className="border-border"
                      >
                        <TableCell className="mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="mono text-xs">
                          ${trade.entryPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="mono text-xs">
                          ${trade.exitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "mono text-xs font-semibold",
                            trade.pnlDollar >= 0
                              ? "text-success"
                              : "text-danger",
                          )}
                        >
                          {trade.pnlDollar >= 0 ? "+" : ""}
                          {trade.pnlDollar.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "mono text-xs font-semibold",
                            trade.pnlPct >= 0 ? "text-success" : "text-danger",
                          )}
                        >
                          {trade.pnlPct >= 0 ? "+" : ""}
                          {trade.pnlPct.toFixed(2)}%
                        </TableCell>
                        <TableCell>{reasonBadge(trade.reason)}</TableCell>
                        <TableCell className="mono text-xs text-muted-foreground">
                          {trade.exitIndex - trade.entryIndex} candles
                        </TableCell>
                      </TableRow>
                    ))}
                    {results.trades.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-8 text-center text-sm text-muted-foreground"
                          data-ocid="backtest.trade.empty_state"
                        >
                          <XCircle className="mx-auto mb-2 h-8 w-8 opacity-30" />
                          No trades triggered. Strategy conditions may be too
                          strict.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Idle state */}
      {status === "idle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-panel flex flex-col items-center justify-center py-16 text-center"
          data-ocid="backtest.empty_state"
        >
          <BarChart2 className="mb-4 h-12 w-12 text-muted-foreground opacity-30" />
          <div className="text-sm font-medium text-foreground">
            Ready to backtest
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Click{" "}
            <span className="font-semibold text-success">Run Backtest</span> to
            fetch 1 year of {pairLabel} 15m candles and simulate the strategy.
          </div>
        </motion.div>
      )}
    </div>
  );
}

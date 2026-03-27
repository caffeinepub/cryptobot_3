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
  RefreshCw,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

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
  size: number;
  coin?: string;
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

interface CoinBreakdown {
  coin: string;
  numTrades: number;
  winRate: number;
  totalProfitPct: number;
  finalBalance: number;
  coinNetPnl: number;
}

interface PortfolioResults extends BacktestResults {
  perCoin: CoinBreakdown[];
}

type Coin = "ETH" | "ADA";
type Selection = Coin | "PORTFOLIO";

const COIN_SYMBOLS: Record<Coin, string> = {
  ETH: "ETHUSDT",
  ADA: "ADAUSDT",
};

const ALL_COINS: Coin[] = ["ETH", "ADA"];
const PORTFOLIO_COINS: Coin[] = ["ETH", "ADA"];
// Kept for UI display only — not used in simulation logic
const PORTFOLIO_WEIGHTS: Record<string, number> = {
  ETH: 0.5,
  ADA: 0.5,
};
const STARTING_BALANCE = 10000;

// Portfolio selection: per-coin max concurrent trades
const MAX_TRADES_PER_COIN: Record<string, number> = {
  ETH: 5,
  ADA: 5,
};

// ---- Indicator calculations ----

function calcEMA(closes: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = new Array(closes.length).fill(0);
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
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) avgGain += change;
    else avgLoss -= change;
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

// ---- Single-coin simulation ----

function runSimulation(
  candles: Candle[],
  startingBalance = STARTING_BALANCE,
  coinLabel?: string,
): BacktestResults {
  const TRADING_FEE = 0.001;
  const SLIPPAGE = 0.0005;

  const closes = candles.map((c) => c.close);
  const ema50 = calcEMA(closes, 50);
  const ema200 = calcEMA(closes, 200);
  const rsi14 = calcRSI(closes);

  let balance = startingBalance;
  const equityCurve: number[] = [startingBalance];

  interface OpenPos {
    entryIndex: number;
    entryPrice: number;
    highestPrice: number;
    size: number;
  }

  const openPositions: OpenPos[] = [];
  const closedTrades: Trade[] = [];
  let consecutiveLosses = 0;

  const START_INDEX = 210;
  let lastTradeIndex = -1;

  for (let i = START_INDEX; i < candles.length; i++) {
    const price = closes[i];
    const e50 = ema50[i];
    const e200 = ema200[i];

    for (let p = openPositions.length - 1; p >= 0; p--) {
      const pos = openPositions[p];
      let exitReason: "TP" | "SL" | "TRAIL" | null = null;

      if (price > pos.highestPrice) pos.highestPrice = price;

      if (price >= pos.entryPrice * 1.07) exitReason = "TP";
      else if (price <= pos.entryPrice * 0.97) exitReason = "SL";
      else {
        const profitPct = (price - pos.entryPrice) / pos.entryPrice;
        // Break-even trailing: if profit >= 3%, stop loss moves to entry price
        if (profitPct >= 0.03 && price <= pos.entryPrice) {
          exitReason = "TRAIL";
        }
      }

      if (exitReason) {
        const effectiveExitPrice = price * (1 - SLIPPAGE);
        const pnlPct = (effectiveExitPrice - pos.entryPrice) / pos.entryPrice;
        let pnlDollar = pos.size * pnlPct;
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
          coin: coinLabel,
        });

        openPositions.splice(p, 1);
      }
    }

    if (i > START_INDEX + 20) {
      const candle = candles[i];

      // Pullback entry strategy:
      // trend_up = EMA50 > EMA200 AND close > EMA50
      // pullback = low <= EMA50 AND close >= EMA50
      // rsi_ok = RSI > 45 AND RSI < 60 AND RSI rising
      // bullish_candle = close > open AND body > 50% of range
      const rsiVal = rsi14[i];
      const prevRsiVal = rsi14[i - 1];
      const trendUp = e50 > e200 && price > e50;
      const pullback = candle.low <= e50 && candle.close >= e50;
      const rsiOk = rsiVal > 45 && rsiVal < 60 && rsiVal > prevRsiVal;
      const range = candle.high - candle.low;
      const bullishCandle =
        candle.close > candle.open &&
        range > 0 &&
        candle.close - candle.open > range * 0.5;
      if (
        trendUp &&
        pullback &&
        rsiOk &&
        bullishCandle &&
        consecutiveLosses < 5 &&
        openPositions.length < 10 &&
        i - lastTradeIndex > 3
      ) {
        const size = balance * 0.09;
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
      coin: coinLabel,
    });
  }

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
    startingBalance,
    finalBalance: balance,
    totalProfitPct: ((balance - startingBalance) / startingBalance) * 100,
    numTrades: closedTrades.length,
    winRate:
      closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
    maxDrawdown: maxDD * 100,
    profitFactor,
    avgDuration,
    trades: closedTrades,
  };
}

// ---- Portfolio simulation (shared balance) ----

function runPortfolioSimulation(
  allCandlesByCoins: { coin: string; candles: Candle[] }[],
  startingBalance = STARTING_BALANCE,
): PortfolioResults {
  const TRADING_FEE = 0.001;
  const SLIPPAGE = 0.0005;
  const START_INDEX = 210;

  // Precompute indicators for each coin
  const coinData = allCandlesByCoins.map(({ coin, candles }) => {
    const closes = candles.map((c) => c.close);
    return {
      coin,
      candles,
      closes,
      ema50: calcEMA(closes, 50),
      ema200: calcEMA(closes, 200),
      rsi14: calcRSI(closes),
    };
  });

  // Build merged event list sorted by time
  interface Event {
    time: number;
    coinIdx: number;
    candleIdx: number;
  }
  const events: Event[] = [];
  for (let ci = 0; ci < coinData.length; ci++) {
    const { candles } = coinData[ci];
    for (let i = START_INDEX; i < candles.length; i++) {
      events.push({ time: candles[i].time, coinIdx: ci, candleIdx: i });
    }
  }
  events.sort((a, b) => a.time - b.time || a.coinIdx - b.coinIdx);

  // Shared state
  let balance = startingBalance;
  interface OpenPos {
    coin: string;
    entryIndex: number;
    entryPrice: number;
    highestPrice: number;
    size: number;
  }
  const openPositions: OpenPos[] = [];
  const closedTrades: Trade[] = [];
  let consecutiveLosses = 0;
  const lastTradeIndex: Record<string, number> = {};
  for (const { coin } of coinData) lastTradeIndex[coin] = -1;

  // Drawdown tracking
  let peakBalance = startingBalance;
  let maxDrawdown = 0;

  const getEquity = () =>
    balance + openPositions.reduce((s, p) => s + p.size, 0);

  for (const ev of events) {
    const { coinIdx, candleIdx: i } = ev;
    const cd = coinData[coinIdx];
    const { coin, candles, closes, ema50, ema200, rsi14 } = cd;
    const price = closes[i];

    // --- Process exits for this coin ---
    for (let p = openPositions.length - 1; p >= 0; p--) {
      const pos = openPositions[p];
      if (pos.coin !== coin) continue;

      let exitReason: "TP" | "SL" | "TRAIL" | null = null;
      if (price > pos.highestPrice) pos.highestPrice = price;

      if (price >= pos.entryPrice * 1.07) exitReason = "TP";
      else if (price <= pos.entryPrice * 0.97) exitReason = "SL";
      else {
        const profitPct = (price - pos.entryPrice) / pos.entryPrice;
        // Break-even trailing: if profit >= 3%, stop loss moves to entry price
        if (profitPct >= 0.03 && price <= pos.entryPrice) {
          exitReason = "TRAIL";
        }
      }

      if (exitReason) {
        const effectiveExitPrice = price * (1 - SLIPPAGE);
        const pnlPct = (effectiveExitPrice - pos.entryPrice) / pos.entryPrice;
        let pnlDollar = pos.size * pnlPct;
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
          coin,
        });

        openPositions.splice(p, 1);

        // Update drawdown
        const equity = getEquity();
        if (equity > peakBalance) peakBalance = equity;
        const dd = (peakBalance - equity) / peakBalance;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }
    }

    // --- Process entry for this coin ---
    if (i > START_INDEX + 20) {
      const candle = candles[i];
      const e50 = ema50[i];
      const e200 = ema200[i];
      const rsiVal = rsi14[i];
      const prevRsiVal = rsi14[i - 1];

      // Per-coin open trade count
      const coinOpenCount = openPositions.filter((p) => p.coin === coin).length;
      const maxForCoin = MAX_TRADES_PER_COIN[coin] ?? 2;

      // trend_up = EMA50 > EMA200 AND close > EMA50
      // pullback = low <= EMA50 AND close >= EMA50
      // rsi_ok = RSI > 45 AND RSI < 60 AND RSI rising
      // bullish_candle = close > open AND body > 50% of range
      const trendUp = e50 > e200 && price > e50;
      const pullback = candle.low <= e50 && candle.close >= e50;
      const rsiOk = rsiVal > 45 && rsiVal < 60 && rsiVal > prevRsiVal;
      const range = candle.high - candle.low;
      const bullishCandle =
        candle.close > candle.open &&
        range > 0 &&
        candle.close - candle.open > range * 0.5;

      if (
        trendUp &&
        pullback &&
        rsiOk &&
        bullishCandle &&
        consecutiveLosses < 5 &&
        openPositions.length < 10 &&
        coinOpenCount < maxForCoin &&
        i - lastTradeIndex[coin] > 3
      ) {
        // Position size: 9% of total portfolio equity
        const totalEquity = getEquity();
        const size = totalEquity * 0.09;

        if (size <= balance) {
          const effectiveEntryPrice = price * (1 + SLIPPAGE);
          balance -= size;
          balance -= size * TRADING_FEE;
          openPositions.push({
            coin,
            entryIndex: i,
            entryPrice: effectiveEntryPrice,
            highestPrice: price,
            size,
          });
          lastTradeIndex[coin] = i;
        }
      }
    }
  }

  // Force-close remaining open positions at each coin's last price
  for (let p = openPositions.length - 1; p >= 0; p--) {
    const pos = openPositions[p];
    const cd = coinData.find((d) => d.coin === pos.coin);
    if (!cd) continue;
    const lastPrice = cd.closes[cd.closes.length - 1];
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
      exitIndex: cd.candles.length - 1,
      pnlDollar,
      pnlPct: pnlPct * 100,
      reason: "TRAIL",
      size: pos.size,
      coin: pos.coin,
    });
    openPositions.splice(p, 1);
  }

  // Summary stats
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

  // Per-coin breakdown
  const numCoins = allCandlesByCoins.length;
  const perCoin: CoinBreakdown[] = allCandlesByCoins.map(({ coin }) => {
    const coinTrades = closedTrades.filter((t) => t.coin === coin);
    const coinWins = coinTrades.filter((t) => t.pnlDollar > 0);
    const coinNetPnl = coinTrades.reduce((s, t) => s + t.pnlDollar, 0);
    return {
      coin,
      numTrades: coinTrades.length,
      winRate:
        coinTrades.length > 0 ? (coinWins.length / coinTrades.length) * 100 : 0,
      totalProfitPct: (coinNetPnl / startingBalance) * 100,
      finalBalance: startingBalance / numCoins + coinNetPnl,
      coinNetPnl,
    };
  });

  return {
    startingBalance,
    finalBalance: balance,
    totalProfitPct: ((balance - startingBalance) / startingBalance) * 100,
    numTrades: closedTrades.length,
    winRate:
      closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
    maxDrawdown: maxDrawdown * 100,
    profitFactor,
    avgDuration,
    trades: closedTrades,
    perCoin,
  };
}

// ---- Data fetching ----

async function fetchAllCandles(
  symbol: string,
  onProgress: (batch: number, total: number) => void,
  signal: AbortSignal,
): Promise<Candle[]> {
  const MS_PER_5_YEARS = 5 * 365 * 24 * 60 * 60 * 1000;
  const INTERVAL_MS = 15 * 60 * 1000; // 15m candles
  const BATCH = 1000;
  const totalCandles = Math.ceil(MS_PER_5_YEARS / INTERVAL_MS);
  const totalBatches = Math.ceil(totalCandles / BATCH);

  let startTime = Date.now() - MS_PER_5_YEARS;
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

    startTime = Number(data[data.length - 1][6]) + 1;
    batchNum++;
    onProgress(batchNum, totalBatches);

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

// ---- Per-coin mini card ----

function CoinCard({
  breakdown,
  index,
}: {
  breakdown: CoinBreakdown;
  index: number;
}) {
  const profitColor =
    breakdown.totalProfitPct >= 0 ? "text-success" : "text-danger";
  const netPnl = breakdown.coinNetPnl;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.55 + index * 0.08 }}
      className="card-panel p-4 flex flex-col gap-2"
    >
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {breakdown.coin}/USDT
      </div>
      <div className={cn("mono text-xl font-bold", profitColor)}>
        {breakdown.totalProfitPct >= 0 ? "+" : ""}
        {breakdown.totalProfitPct.toFixed(2)}%
      </div>
      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        <span>{breakdown.numTrades} trades</span>
        <span>Win rate: {breakdown.winRate.toFixed(1)}%</span>
        <span
          className={cn("mono", netPnl >= 0 ? "text-success" : "text-danger")}
        >
          Net: {netPnl >= 0 ? "+" : ""}$
          {netPnl.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="text-[10px] opacity-60">Contribution</span>
      </div>
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
  const [portfolioResults, setPortfolioResults] =
    useState<PortfolioResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedCoin, setSelectedCoin] = useState<Selection>("ETH");
  const [resetKey, setResetKey] = useState(0);
  const [lastReset, setLastReset] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Clear cached simulation data on mount
  useEffect(() => {
    setResults(null);
    setPortfolioResults(null);
    setStatus("idle");
  }, []);

  const isPortfolio = selectedCoin === "PORTFOLIO";
  const pairLabel = isPortfolio
    ? "ETH, ADA (shared $10,000 balance)"
    : `${selectedCoin}/USDT`;

  const handleReset = () => {
    abortRef.current?.abort();
    setResults(null);
    setPortfolioResults(null);
    setStatus("idle");
    setErrorMsg("");
    setProgress(0);
    setLastReset(new Date());
    setResetKey((prev) => prev + 1);
  };

  const handleRun = async () => {
    setStatus("fetching");
    setProgress(0);
    setProgressText("Fetching data...");
    setResults(null);
    setPortfolioResults(null);
    setErrorMsg("");

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      if (isPortfolio) {
        const coinProgress: Record<string, { batch: number; total: number }> =
          {};
        for (const coin of PORTFOLIO_COINS) {
          coinProgress[coin] = { batch: 0, total: 1 };
        }

        const updatePortfolioProgress = () => {
          let totalBatches = 0;
          let doneBatches = 0;
          for (const coin of PORTFOLIO_COINS) {
            totalBatches += coinProgress[coin].total;
            doneBatches += coinProgress[coin].batch;
          }
          const pct =
            totalBatches > 0
              ? Math.round((doneBatches / totalBatches) * 80)
              : 0;
          setProgress(pct);
        };

        // Fetch coins sequentially to avoid rate limits
        const allCandlesResult: Candle[][] = [];
        for (let i = 0; i < PORTFOLIO_COINS.length; i++) {
          const coin = PORTFOLIO_COINS[i];
          setProgressText(
            `Fetching ${coin} data... (${i + 1}/${PORTFOLIO_COINS.length})`,
          );
          const candles = await fetchAllCandles(
            COIN_SYMBOLS[coin],
            (batch, total) => {
              coinProgress[coin] = { batch, total };
              updatePortfolioProgress();
            },
            signal,
          );
          allCandlesResult.push(candles);
          // Small delay between coins to respect rate limits
          if (i < PORTFOLIO_COINS.length - 1) {
            await new Promise((r) => setTimeout(r, 200));
          }
        }

        setStatus("simulating");
        setProgress(85);
        setProgressText(
          `Running shared portfolio simulation on ${PORTFOLIO_COINS.join(", ")}...`,
        );
        await new Promise((r) => setTimeout(r, 30));

        const portfolioRes = runPortfolioSimulation(
          PORTFOLIO_COINS.map((coin, idx) => ({
            coin,
            candles: allCandlesResult[idx],
          })),
          STARTING_BALANCE,
        );

        setProgress(100);
        setProgressText("Done!");
        setPortfolioResults(portfolioRes);
        setStatus("done");
      } else {
        // --- Single coin mode ---
        const symbol = COIN_SYMBOLS[selectedCoin as Coin];
        const candles = await fetchAllCandles(
          symbol,
          (batch, total) => {
            setProgress(Math.round((batch / total) * 80));
            setProgressText(`Fetching data... batch ${batch}/${total}`);
          },
          signal,
        );

        setStatus("simulating");
        setProgress(85);
        setProgressText(
          `Running simulation on ${candles.length.toLocaleString()} candles...`,
        );
        await new Promise((r) => setTimeout(r, 30));

        const res = runSimulation(candles);
        setProgress(100);
        setProgressText("Done!");
        setResults(res);
        setStatus("done");
      }
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

  const activeResults = isPortfolio ? portfolioResults : results;

  const showResetBanner = lastReset !== null && status === "idle";

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

  // Suppress unused warning — PORTFOLIO_WEIGHTS kept for potential future UI use
  void PORTFOLIO_WEIGHTS;

  return (
    <div className="space-y-6" data-ocid="backtest.panel" key={resetKey}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold uppercase tracking-widest text-foreground">
          Backtest
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Simulate the strategy on 5 years of {pairLabel} 15m historical data
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
            [
              "Symbols",
              isPortfolio ? "ETH, ADA (shared $10,000 balance)" : pairLabel,
            ],
            ["Timeframe", "15m"],
            ["Period", "5 years"],
            ["Starting Balance", "$10,000"],
            ["Position Size", "9% of total equity"],
            ["Max Open Trades", "10 (global) · ETH: 5 · ADA: 5"],
            ["Asset Priority", "ETH (1st) · ADA (2nd)"],
            ["Strategy", "Pullback in Uptrend"],
            ["Trend Filter", "EMA50 > EMA200 · Close > EMA50"],
            ["Entry", "Low ≤ EMA50 · Close ≥ EMA50 (pullback touch)"],
            ["Trigger", "Bullish candle (body > 50% of range)"],
            ["RSI Filter", "45–60 (rising only)"],
            ["Trailing Stop", "Break even at +3%"],
            ["Trail Distance", "Stop moves to entry price"],
            ["Take Profit", "+7%"],
            ["Stop Loss", "-3%"],
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
              if (v) setSelectedCoin(v as Selection);
            }}
            disabled={isRunning}
            className="justify-start gap-2 flex-wrap"
            data-ocid="backtest.toggle"
          >
            {ALL_COINS.map((coin) => (
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
            <ToggleGroupItem
              value="PORTFOLIO"
              data-ocid="backtest.portfolio.tab"
              className={cn(
                "mono h-9 rounded-lg border px-4 text-xs font-bold tracking-wider transition-all",
                selectedCoin === "PORTFOLIO"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
              )}
            >
              Portfolio
            </ToggleGroupItem>
          </ToggleGroup>

          {isPortfolio && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary"
            >
              Portfolio mode runs ETH and ADA simultaneously with a single
              shared $10,000 balance. Max 10 open trades across all coins
              combined. Position size is 9% of total portfolio equity at entry
              time.
            </motion.div>
          )}
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
                {isPortfolio ? "Run Portfolio Backtest" : "Run Backtest"}
              </>
            )}
          </Button>

          <Button
            data-ocid="backtest.secondary_button"
            onClick={handleReset}
            disabled={isRunning}
            variant="ghost"
            className="gap-2 font-semibold tracking-wider border border-border text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
          >
            <RefreshCw className="h-4 w-4" />
            Reset Dataset
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

          {status === "done" && activeResults && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" />
              Simulation complete — {activeResults.numTrades} trades analyzed on{" "}
              {isPortfolio ? "ETH, ADA" : pairLabel}
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

      {/* Reset banner */}
      <AnimatePresence>
        {showResetBanner && (
          <motion.div
            key="reset-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-primary"
            data-ocid="backtest.success_state"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">
                Dataset reset — fetching fresh 5-year data on next run. Cached
                simulations cleared.
              </span>
              <span className="text-[11px] opacity-70">
                Reset at{" "}
                {lastReset.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {status === "done" && activeResults && (
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
                value={`$${activeResults.finalBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                color={activeResults.finalBalance >= 10000 ? "green" : "red"}
              />
              <StatCard
                index={2}
                label="Total Profit"
                value={`${activeResults.totalProfitPct >= 0 ? "+" : ""}${activeResults.totalProfitPct.toFixed(2)}%`}
                color={activeResults.totalProfitPct >= 0 ? "green" : "red"}
                sub={`$${(activeResults.finalBalance - 10000).toFixed(2)}`}
              />
              <StatCard
                index={3}
                label="Num Trades"
                value={String(activeResults.numTrades)}
                color="neutral"
                sub={undefined}
              />
              <StatCard
                index={4}
                label="Win Rate"
                value={`${activeResults.winRate.toFixed(1)}%`}
                color={
                  activeResults.winRate >= 55
                    ? "green"
                    : activeResults.winRate >= 45
                      ? "amber"
                      : "red"
                }
                sub={`${Math.round((activeResults.winRate / 100) * activeResults.numTrades)} wins / ${activeResults.numTrades - Math.round((activeResults.winRate / 100) * activeResults.numTrades)} losses`}
              />
              <StatCard
                index={5}
                label="Max Drawdown"
                value={`-${activeResults.maxDrawdown.toFixed(2)}%`}
                color={
                  activeResults.maxDrawdown < 10
                    ? "green"
                    : activeResults.maxDrawdown < 20
                      ? "amber"
                      : "red"
                }
                sub={undefined}
              />
              <StatCard
                index={6}
                label="Profit Factor"
                value={activeResults.profitFactor.toFixed(2)}
                color={
                  activeResults.profitFactor >= 1.5
                    ? "green"
                    : activeResults.profitFactor >= 1
                      ? "amber"
                      : "red"
                }
                sub="gross profit / gross loss"
              />
              <StatCard
                index={7}
                label="Avg Trade Duration"
                value={`${activeResults.avgDuration.toFixed(0)} candles`}
                sub={`\u2248 ${(activeResults.avgDuration * 0.25).toFixed(1)} hours`}
                color="neutral"
              />
            </div>

            {/* Per-coin breakdown (portfolio only) */}
            {isPortfolio && portfolioResults && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.5 }}
              >
                <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Per-Coin Breakdown
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-2">
                  {portfolioResults.perCoin.map((breakdown, idx) => (
                    <CoinCard
                      key={breakdown.coin}
                      breakdown={breakdown}
                      index={idx}
                    />
                  ))}
                </div>
              </motion.div>
            )}

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
                    Trade Log — {isPortfolio ? "ETH, ADA" : pairLabel}
                  </h2>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-success" />
                      {
                        activeResults.trades.filter((t) => t.pnlDollar > 0)
                          .length
                      }{" "}
                      wins
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-danger" />
                      {
                        activeResults.trades.filter((t) => t.pnlDollar <= 0)
                          .length
                      }{" "}
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
                      {isPortfolio && (
                        <TableHead className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          Coin
                        </TableHead>
                      )}
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
                    {activeResults.trades.map((trade, idx) => (
                      <TableRow
                        key={`${trade.coin ?? ""}-${trade.entryIndex}-${trade.exitIndex}`}
                        data-ocid={`backtest.trade.item.${idx + 1}`}
                        className="border-border"
                      >
                        <TableCell className="mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        {isPortfolio && (
                          <TableCell className="mono text-xs font-bold text-foreground">
                            {trade.coin}
                          </TableCell>
                        )}
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
                    {activeResults.trades.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={isPortfolio ? 8 : 7}
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
            Select a coin or run Portfolio mode to simulate the strategy across
            ETH and ADA with a single shared balance.
          </div>
        </motion.div>
      )}
    </div>
  );
}

# CryptoBot

## Current State
The Backtest tab runs simulation on a single selected coin (BTC or ETH). SOL is disabled with a warning banner. Results show stats for one coin at a time. The simulation uses a shared $10,000 starting balance and 3% position sizing per trade.

## Requested Changes (Diff)

### Add
- Portfolio mode: run all 3 coins (BTC, ETH, SOL) simultaneously in one backtest
- Parallel candle fetching for all 3 coins when Portfolio mode is selected
- Combined portfolio metrics: total profit, trades, win rate, drawdown, profit factor computed across all coins merged
- Per-coin breakdown section showing individual stats (profit, trades, win rate) for each coin
- Combined trade log with a Coin column to distinguish trades
- Re-enable SOL in the coin selector (both individual and portfolio modes)

### Modify
- Coin selector: add a "Portfolio" toggle option alongside BTC / ETH / SOL
- When Portfolio is selected: fetch all 3 coins in parallel, run each simulation on $10,000/3 ≈ $3,333 starting balance, merge results
- Progress bar: show aggregate progress across all 3 fetch operations when in portfolio mode
- Simulation Parameters panel: show "Mode: Portfolio (BTC + ETH + SOL)" when applicable
- Trade log: add Coin column when in portfolio mode

### Remove
- SOL disabled state / warning banner (SOL is now allowed in backtest)

## Implementation Plan
1. Add `"PORTFOLIO"` as a valid selection in the coin toggle (Backtest.tsx)
2. In portfolio mode, fetch candles for all 3 symbols in parallel with aggregated progress
3. Run `runSimulation` on each coin's candles with `STARTING_BALANCE / 3` per coin
4. Merge all `closedTrades` arrays (add `coin` field to Trade type), compute combined portfolio stats
5. Display combined summary stats, per-coin breakdown cards, and merged trade log with Coin column
6. Remove SOL disabled styling and banner

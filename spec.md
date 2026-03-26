# CryptoBot

## Current State
Backtest simulation uses `e50 > e200` as the only trend filter. No minimum gap or spread-widening check exists. The Simulation Parameters panel shows "Trend Filter: EMA50 > EMA200" only.

## Requested Changes (Diff)

### Add
- Minimum EMA gap filter: `(e50 - e200) / e200 >= 0.005` — EMA50 must be at least 0.5% above EMA200 before any entry
- Spread-widening filter: current EMA50–EMA200 gap must be greater than the previous candle's gap (trend must be strengthening, not converging)
- Two new entries in the Simulation Parameters panel: "EMA Min Gap" and "EMA Spread"

### Modify
- `runSimulation` entry condition block in Backtest.tsx to include the two new filters
- Simulation Parameters panel labels to reflect the new filters

### Remove
- Nothing removed

## Implementation Plan
1. In `runSimulation`, pre-compute `prevGap = ema50[i-1] - ema200[i-1]` and `currGap = e50 - e200` each candle.
2. Add `currGap / e200 >= 0.005` to entry condition (0.5% minimum spread).
3. Add `currGap > prevGap` to entry condition (spread must be widening).
4. Add two rows to the Simulation Parameters grid: "EMA Min Gap" = "≥ 0.5% (strong trend)" and "EMA Spread" = "Widening (gap > prev gap)".

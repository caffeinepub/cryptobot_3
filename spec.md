# CryptoBot

## Current State
Pullback entry mode: EMA50 > EMA200, price > EMA50, EMA50 >= 1% above EMA200, RSI 40–55, bullish candle confirmation.

## Requested Changes (Diff)

### Add
- Breakout entry: price makes new 10-candle high (price > highest HIGH of last 10 candles)

### Modify
- Strategy label: pullback → breakout
- Entry conditions: remove RSI filter, remove bullish candle confirmation, remove EMA strength (1%) filter, remove pullback logic
- Keep: EMA50 > EMA200, price > EMA50
- Simulation Parameters panel updated to reflect new strategy

### Remove
- RSI check (r >= 40 && r <= 55)
- isBullish check (candle.close > candle.open)
- EMA50 >= EMA200 * 1.01 trend strength filter

## Implementation Plan
1. In Backtest.tsx runSimulation: add 10-candle high breakout condition, remove RSI/bullish/strength filters
2. Update Simulation Parameters panel labels

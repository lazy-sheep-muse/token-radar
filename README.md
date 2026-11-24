# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lazy-sheep-muse/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lazy-sheep-muse/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks the pre-token protocols of a sealed DefiLlama snapshot by what a token launch would be worth, and gives every protocol a concrete farm plan. The board covers all 40 watchlist protocols and adds 138 pre-token protocols below the watchlist floor, each screened by the same rule the watchlist uses. A static dashboard (sortable, filterable, with a detail view for every protocol) renders the board with no network.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input /input/snapshot.json
```

Node 22 or later, standard library only. The program reads the snapshot, writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the output directory, and writes `dossier.json` with the vendored make.fun library.

## Model (radar-2)

Implied value is calibrated from the snapshot's own market, not from a flat multiple and never from a hand-kept list of names: each category's multiple is the median market-cap / TVL of its live-token protocols (at least 3 of them), else the global median, clamped to [0.05, 1.5]. Then `implied = round(tvl_usd x multiple x (1 + clamp(change_7d, -50, 100) / 100 x 0.6) x (0.65 + min(age_days, 1095) / 1095 x 0.45))`. Age is the time since the protocol was first listed: how long it has run with no token. Every row is scored by the same function, and the dashboard recomputes each row from the same figures.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

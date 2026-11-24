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

## Model (radar-3)

Implied value is calibrated from the snapshot's own market, not from a flat multiple and never from a hand-kept list of names: each category's multiple is the median market-cap / TVL of its live-token protocols (at least 3 of them), else the global median, clamped to [0.05, 1.5]. A giant is never charged the same multiple per dollar as a small protocol: the snapshot's live protocols show the multiple shrinks with size (log-log slope 0.52 across 128 live protocols), so the size factor is `(tvl_usd / median live TVL) ^ -0.48`, clamped to [0.25, 1.0]. Then `implied = round(tvl_usd x multiple x size_factor x (1 + clamp(change_7d, -30, 50) / 100 x 0.6) x launch_window(age_days) x stablecoin_discount)`. The launch window is a hump, not a slope: 0.90 under 90 days, peaking at 1.05 around two years in, fading to 0.80 after three-plus years with no token. A protocol named as a stablecoin ticker (USDD) is the stablecoin itself, so only a future governance token is priced, at 0.25. Age is the time since the protocol was first listed: how long it has run with no token. Every row is scored by the same function, and the dashboard recomputes each row from the same figures. Top of the board on the sealed snapshot: Steakhouse Financial $146.2M, Gauntlet $87.7M, Veda $81.6M, OnRe $34.4M, Tori Finance $31.8M.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

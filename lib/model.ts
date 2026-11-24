// Token Radar model, version radar-4.
//
// One sealed snapshot of the protocol universe in, one ranked board out. The
// board covers every slug in the snapshot's watchlist (the floor, never a
// ceiling) and adds the pre-token protocols below that floor that pass the
// same exclusion rule the watchlist itself uses. A protocol is pre-token
// when its record carries no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown with
// the market's own values, never mixed into the ranked board.
//
// Implied value is calibrated from the snapshot's own market, not from a
// flat multiple and never from a hand-kept list of names:
//
//   multiple   = the median market-cap / TVL of the live-token protocols in
//                the same category (at least 3 of them), else the median
//                across every live-token protocol; clamped to [0.05, 1.5].
//                A thin category borrows strength from the market: the
//                multiple actually used is shrunk toward the global median
//                with weight n / (n + 3) on the category's own median, so a
//                category priced by 3 live protocols leans on the global
//                median twice as hard as one priced by 7. No single rich
//                category can carry the top of the board on a handful of
//                live protocols.
//   size       = (tvl_usd / median live TVL of the category) raised to the
//                market's own size exponent, clamped to [0.25, 1.0]: the
//                snapshot's live protocols show the multiple shrinks as a
//                protocol gets bigger. The exponent is the market's median
//                pairwise slope of log market cap on log TVL (Theil-Sen),
//                minus one — a median, so one 36x outlier cannot move it —
//                clamped to [-0.7, -0.1]. The multiple is calibrated at
//                the category's median size, so the size factor only ever
//                discounts, never inflates.
//   growth     = clamp(change_7d, -30, 50) per cent; one week of TVL flow is
//                mostly noise, so it moves a row by at most -18% / +30%
//   growthMult = 1 + (growth / 100) x 0.6
//   launch     = the launch window, a hump not a slope: a protocol too new
//                to trust scores 0.90, the window peaks at 1.05 around two
//                years in, and a protocol that has run three-plus years with
//                no token has shown it does not need one, fading to 0.80
//   discount   = 0.25 when the protocol is named after the asset it issues
//                (a stablecoin ticker such as USDD): the token already
//                exists and trades, so the board prices only a possible
//                future governance token, and the traded token stays
//                separated from the ones still to come
//   implied    = max(1, round(tvl_usd x multiple x size x growthMult x
//                launch x discount))
//
// Every row also names its closest live comparables: the three live-token
// protocols nearest it by TVL in its own category (or in the whole market
// when its category has none trading), with their market-cap / TVL, so a
// reader can check the multiple against the market without taking the
// model's word for it.
//
// The multiples and the size exponent are computed from the snapshot at run
// time, so the model follows the data it is given. Every row is scored by
// the same function.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  launch_young: number;
  launch_peak: number;
  launch_peak_age: number;
  launch_ramp_days: number;
  launch_old: number;
  launch_old_span: number;
  unknown_age_days: number;
  multiple_floor: number;
  multiple_cap: number;
  min_live_for_category: number;
  shrink_k: number;
  size_floor: number;
  size_cap: number;
  stablecoin_discount: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.6,
  growth_floor: -30,
  growth_cap: 50,
  launch_young: 0.9,
  launch_peak: 1.05,
  launch_peak_age: 730,
  launch_ramp_days: 90,
  launch_old: 0.8,
  launch_old_span: 1095,
  unknown_age_days: 365,
  multiple_floor: 0.05,
  multiple_cap: 1.5,
  min_live_for_category: 3,
  shrink_k: 3,
  size_floor: 0.25,
  size_cap: 1.0,
  stablecoin_discount: 0.25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One calibrated multiple: which category, how many live protocols priced it, the raw median, the shrunk multiple actually used, and the TVL it was priced at. */
export interface CategoryMultiple {
  category: string;
  live_count: number;
  multiple: number;
  raw_multiple: number;
  shrink_weight: number;
  median_tvl_usd: number;
}

/** The calibration: the global median and one row per category that priced itself, plus the market's own size exponent. */
export interface Calibration {
  global_multiple: number;
  global_median_tvl_usd: number;
  size_exponent: number;
  by_category: CategoryMultiple[];
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    category_multiple: number;
    category_multiple_raw: number;
    shrink_weight: number;
    multiple_source: string;
    size_factor: number;
    size_reference_tvl_usd: number;
    growth_pct: number;
    growth_multiplier: number;
    launch_multiplier: number;
    stablecoin_discount: number;
    age_days: number | null;
  };
  why: string;
  comps: Comp[];
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the farm plan is generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  category_multiple: number;
  category_multiple_raw: number;
  shrink_weight: number;
  multiple_source: string;
  size_factor: number;
  size_reference_tvl_usd: number;
  growth_multiplier: number;
  launch_multiplier: number;
  stablecoin_discount: number;
  why: string;
  comps: Comp[];
}

/** One closest live comparable: a protocol that already trades, nearest by TVL, with its market-cap / TVL. */
export interface Comp {
  name: string;
  ratio: number;
  tvl_usd: number;
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the model and its calibration. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  calibration: Calibration;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The snapshot's live-token protocols: a token recorded, a positive TVL and a positive market cap. */
export function liveProtocols(snapshot: Snapshot): SnapshotProtocol[] {
  return snapshot.protocols.filter(
    (p) => p.mcap_usd !== null && p.gecko_id !== null && p.symbol !== null && p.tvl_usd > 0 && p.mcap_usd > 0,
  );
}

/**
 * The market's own multiples, read from the snapshot: for every category with
 * at least `min_live_for_category` live-token protocols, the median of their
 * market-cap / TVL ratios; plus the median across every live-token protocol,
 * which prices the categories too thin to price themselves. Clamped, so one
 * thin protocol with a huge market cap cannot set the multiple for its whole
 * category. A thin category borrows strength from the market: the multiple
 * actually used is shrunk toward the global median with weight
 * n / (n + shrink_k) on the category's own median, so a category priced by
 * 3 live protocols leans on the global median twice as hard as one priced
 * by 7, and no single rich category carries the board on a handful of
 * protocols. Each multiple is priced at its category's median live TVL, and
 * the calibration also carries the market's own size exponent: the median
 * pairwise slope of log market cap on log TVL across the live protocols
 * (Theil-Sen), minus one. A median slope, so one 36x outlier cannot move
 * it; it is clamped to [-0.7, -0.1] and falls back to -0.48 when the live
 * set is too thin or too flat to fit.
 */
export function calibrate(snapshot: Snapshot, model: ModelConstants = MODEL): Calibration {
  const live = liveProtocols(snapshot);
  const clamp = (n: number): number => Math.min(model.multiple_cap, Math.max(model.multiple_floor, n));
  const global = clamp(median(live.map((p) => p.mcap_usd! / p.tvl_usd)));
  const globalMedianTvl = live.length > 0 ? median(live.map((p) => p.tvl_usd)) : 0;
  // The size exponent, fit from the snapshot's own live protocols: the
  // median pairwise slope, so outliers cannot drag it.
  let sizeExponent = -0.48;
  if (live.length >= 10) {
    const slopes: number[] = [];
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const dx = Math.log(live[j]!.tvl_usd) - Math.log(live[i]!.tvl_usd);
        if (Math.abs(dx) > 0.5) slopes.push((Math.log(live[j]!.mcap_usd!) - Math.log(live[i]!.mcap_usd!)) / dx);
      }
    }
    slopes.sort((a, b) => a - b);
    if (slopes.length > 0) {
      const mid = Math.floor(slopes.length / 2);
      const slope = slopes.length % 2 === 1 ? slopes[mid]! : (slopes[mid - 1]! + slopes[mid]!) / 2;
      if (Number.isFinite(slope)) sizeExponent = Math.min(-0.1, Math.max(-0.7, round4(slope - 1)));
    }
  }
  const byCat = new Map<string, SnapshotProtocol[]>();
  for (const p of live) {
    const key = p.category ?? 'Other';
    const list = byCat.get(key);
    if (list) list.push(p);
    else byCat.set(key, [p]);
  }
  const by_category: CategoryMultiple[] = [];
  for (const [category, protocols] of [...byCat.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (protocols.length >= model.min_live_for_category) {
      const raw = clamp(median(protocols.map((p) => p.mcap_usd! / p.tvl_usd)));
      const w = protocols.length / (protocols.length + model.shrink_k);
      by_category.push({
        category,
        live_count: protocols.length,
        multiple: round4(w * raw + (1 - w) * global),
        raw_multiple: round4(raw),
        shrink_weight: round4(w),
        median_tvl_usd: median(protocols.map((p) => p.tvl_usd)),
      });
    }
  }
  return { global_multiple: global, global_median_tvl_usd: globalMedianTvl, size_exponent: sizeExponent, by_category };
}

/** The TVL a category's multiple was priced at, else the global median live TVL. */
export function sizeReferenceTvl(category: string | null, calibration: Calibration): number {
  const key = category ?? 'Other';
  const hit = calibration.by_category.find((c) => c.category === key);
  if (hit && hit.median_tvl_usd > 0) return hit.median_tvl_usd;
  return calibration.global_median_tvl_usd > 0 ? calibration.global_median_tvl_usd : 1;
}

/** The multiple one category is priced at, and where the number came from: the shrunk multiple, the raw median behind it, and the shrinkage weight. */
export function multipleFor(category: string | null, calibration: Calibration): { multiple: number; rawMultiple: number; shrinkWeight: number; source: string } {
  const key = category ?? 'Other';
  const hit = calibration.by_category.find((c) => c.category === key);
  if (hit) {
    return {
      multiple: hit.multiple,
      rawMultiple: hit.raw_multiple,
      shrinkWeight: hit.shrink_weight,
      source: `median of ${hit.live_count} live ${key} protocols, shrunk toward the global median (weight ${hit.shrink_weight.toFixed(2)} on the category median)`,
    };
  }
  return { multiple: calibration.global_multiple, rawMultiple: calibration.global_multiple, shrinkWeight: 1, source: 'global median (category too thin to price itself)' };
}

/** Four decimal places: the rounding every multiplier is stored at, so the dashboard's recomputation lands on the same dollar. */
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A protocol named as a stablecoin ticker is the stablecoin itself: its token already exists and trades. */
const STABLECOIN_TICKER = /^(US|USD)[A-Z]{1,3}$/;

/** The launch window, a hump not a slope: too new to trust, prime around two years in, fading after three-plus years with no token. */
export function launchMultiplier(age: number | null, model: ModelConstants = MODEL): number {
  const a = age ?? model.unknown_age_days;
  if (a < model.launch_ramp_days) return round4(model.launch_young);
  if (a <= model.launch_peak_age) {
    return round4(model.launch_young + ((a - model.launch_ramp_days) / (model.launch_peak_age - model.launch_ramp_days)) * (model.launch_peak - model.launch_young));
  }
  return round4(model.launch_peak - (Math.min(a - model.launch_peak_age, model.launch_old_span) / model.launch_old_span) * (model.launch_peak - model.launch_old));
}

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelConstants = MODEL,
): { implied: number; multiple: number; rawMultiple: number; shrinkWeight: number; source: string; sizeFactor: number; sizeReferenceTvl: number; growthPct: number; growthMult: number; launchMult: number; discount: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = round4(1 + (growthPct / 100) * model.growth_weight);
  const launchMult = launchMultiplier(age, model);
  const { multiple, rawMultiple, shrinkWeight, source } = multipleFor(protocol.category, calibration);
  const sizeRefTvl = sizeReferenceTvl(protocol.category, calibration);
  const sizeFactor = round4(Math.min(model.size_cap, Math.max(model.size_floor, Math.pow(protocol.tvl_usd / sizeRefTvl, calibration.size_exponent))));
  const discount = STABLECOIN_TICKER.test(protocol.name) ? model.stablecoin_discount : 1;
  const implied = Math.max(1, Math.round(protocol.tvl_usd * round4(multiple) * sizeFactor * growthMult * launchMult * discount));
  return { implied, multiple: round4(multiple), rawMultiple: round4(rawMultiple), shrinkWeight, source, sizeFactor, sizeReferenceTvl: sizeRefTvl, growthPct, growthMult, launchMult, discount, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word `wrapped`, `staked` or `staking`, in any case. */
const WRAPPED_WORD = /\bwrapped\b|\bstaked\b|\bstaking\b/i;

/** Categories the watchlist rule keeps out: bridged, staked, wrapped and exchange products. A stablecoin wrapper wraps an asset that already trades, so it is not a token that does not exist yet. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX', 'Stablecoin Wrapper']);

/** Exchange names a protocol name must not begin with. */
const EXCHANGES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped,
 * staked or bridged product of a token that already trades, by the same rule
 * the watchlist was built with (category, version marker, wrapped words,
 * exchange prefix). A wrapped or staked product of a token that trades is not
 * a token that does not exist yet.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGES.some((e) => p.name.startsWith(e))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The three live-token protocols nearest a protocol by TVL, in its own category when at least two trade there, else in the whole market: the comparables its multiple is priced against. A protocol trading above 3x its TVL is not a comparable for pricing — it is a legacy token on a shrunken TVL, not a market multiple — so the pool leaves those out; the median behind the multiple ignores them the same way. */
export function closestComps(p: SnapshotProtocol, snapshot: Snapshot): Comp[] {
  const live = liveProtocols(snapshot).filter((q) => q.mcap_usd! / q.tvl_usd <= 3);
  const same = live.filter((q) => (q.category ?? 'Other') === (p.category ?? 'Other'));
  const pool = same.length >= 2 ? same : live;
  const target = Math.log(p.tvl_usd);
  return [...pool]
    .sort((a, b) => Math.abs(Math.log(a.tvl_usd) - target) - Math.abs(Math.log(b.tvl_usd) - target) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, 3)
    .map((q) => ({ name: q.name, ratio: Math.round((q.mcap_usd! / q.tvl_usd) * 1000) / 1000, tvl_usd: q.tvl_usd }));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const calibration = calibrate(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot
  // no longer carries (it cannot, but the board's coverage is the gate's row
  // and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: rankable pre-token protocols below the watchlist floor,
  // by TVL. Never a replacement for a watchlist row: a chosen protocol stays
  // chosen. Protocols at or above the floor that the watchlist leaves out
  // are left out too: the house's rule kept them out for a reason this file
  // cannot see (a parent protocol), and the radar does not second-guess it.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const s = impliedValue(p, snapshot.as_of, calibration, model);
    return { p, ...s };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  // The TVL rank inside each category, for the one-line reason each row carries.
  const catRank = new Map<string, number>();
  const catSeen = new Map<string, number>();
  for (const s of [...scored].sort((a, b) => b.p.tvl_usd - a.p.tvl_usd)) {
    const key = s.p.category ?? 'Other';
    const n = (catSeen.get(key) ?? 0) + 1;
    catSeen.set(key, n);
    catRank.set(s.p.slug, n);
  }
  return scored.map((s, i) => {
    const comps = closestComps(s.p, snapshot);
    return {
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.multiple),
      category_multiple_raw: round4(s.rawMultiple),
      shrink_weight: s.shrinkWeight,
      multiple_source: s.source,
      size_factor: round4(s.sizeFactor),
      size_reference_tvl_usd: s.sizeReferenceTvl,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      launch_multiplier: round4(s.launchMult),
      stablecoin_discount: s.discount,
      age_days: s.age,
    },
    why: whyFor(s.p, s, catRank.get(s.p.slug) ?? 1, comps),
    comps,
    farm_steps: farmSteps(s.p, s.age).map(stepText),
    };
  });
}

/** One compact dollar figure, as the dashboard shows it. */
function fmtUsd(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${Math.round(n)}`;
}

/** One line saying why a row ranks where it does, from its own numbers. */
export function whyFor(
  p: SnapshotProtocol,
  s: { multiple: number; rawMultiple: number; shrinkWeight: number; source: string; sizeFactor: number; growthPct: number; launchMult: number; discount: number; age: number | null },
  categoryRank: number,
  comps: Comp[],
): string {
  const cat = p.category ?? 'Other';
  const head =
    categoryRank === 1
      ? `Largest pre-token ${cat} protocol at ${fmtUsd(p.tvl_usd)} TVL`
      : `${cat} protocol at ${fmtUsd(p.tvl_usd)} TVL, #${categoryRank} in its category by TVL`;
  const pricing = s.source.startsWith('global median')
    ? `priced at the global median x${s.multiple.toFixed(3)}`
    : s.shrinkWeight < 1
      ? `priced at the ${cat} median x${s.rawMultiple.toFixed(3)}, shrunk to x${s.multiple.toFixed(3)}`
      : `priced at the ${cat} median x${s.multiple.toFixed(3)}`;
  const size = s.sizeFactor < 1 ? `, discounted x${s.sizeFactor.toFixed(2)} for its size` : '';
  const ageText =
    s.age === null
      ? 'age unknown'
      : s.age < 90
        ? `${s.age}d with no token, early in the launch window`
        : s.age <= 730
          ? `${s.age}d with no token, in the launch window`
          : `${s.age}d with no token, past the usual launch window`;
  const growthText = p.change_7d === null ? '7d n/a' : `7d ${p.change_7d > 0 ? '+' : ''}${p.change_7d.toFixed(2)}%`;
  const discountText = s.discount < 1 ? ' Named after the asset it issues, so only a future governance token is priced.' : '';
  const compsText = comps.length > 0 ? ` Live comps: ${comps.map((c) => `${c.name} ${c.ratio.toFixed(2)}x`).join(', ')}.` : '';
  return `${head}, ${pricing}${size}. ${ageText}; ${growthText}.${discountText}${compsText}`;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, in dollars of gas, from the chain's own fees. */
export function gasUsd(chain: string): number {
  const table: Record<string, number> = {
    Ethereum: 8,
    Solana: 0.05,
    Base: 0.5,
    Arbitrum: 0.6,
    Optimism: 0.5,
    Binance: 0.3,
    Polygon: 0.2,
    Avalanche: 0.4,
    'Hyperliquid L1': 0.05,
    Monad: 0.05,
    Ink: 0.3,
    Tron: 1,
    Stellar: 0.01,
    Bittensor: 0.5,
    Plasma: 0.1,
    Sei: 0.05,
    Sui: 0.05,
    Aptos: 0.05,
    Berachain: 0.1,
    Unichain: 0.3,
    Linea: 0.3,
    Scroll: 0.3,
    zkSync: 0.4,
    Starknet: 0.5,
    Mantle: 0.2,
    Blast: 0.3,
  };
  return table[chain] ?? 2;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 200;
  if (p.tvl_usd >= 500_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. 'Index' is checked before 'Dexs': "Indexes" contains "dex", and an index protocol's action is buying the index, not providing liquidity. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the loan-to-value under 50%.`;
  if (c.includes('index')) return `Buy $${capital} of ${name}'s index on ${chain} and hold the shares.`;
  if (c.includes('dex') || c.includes('liquidity manager')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} in a narrow range and keep the position open.`;
  if (c.includes('yield aggregator')) return `Deposit $${capital} of USDC into ${name}'s highest-TVL vault on ${chain} and let it auto-compound.`;
  if (c.includes('yield') || c.includes('leveraged farm')) return `Deposit $${capital} into ${name}'s main yield strategy on ${chain} and keep the position open.`;
  if (c.includes('bridge') || c.includes('cross chain')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app the same day.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt token in the same wallet.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}, then leave it to settle.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} curated vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it for the full term.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('payment')) return `Pay $${capital} through ${name} on ${chain} and keep the receipt in the wallet.`;
  if (c.includes('governance')) return `Lock $${capital} of the accepted asset in ${name}'s incentives program on ${chain} and vote once.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position through one funding cycle.`;
  if (c.includes('launchpad')) return `Commit $${capital} to the next sale on ${name} and complete its allocation steps.`;
  if (c.includes('anchor')) return `Mint $${capital} of the BTC-backed asset through ${name} on ${chain} and hold it.`;
  if (c.includes('card')) return `Spend $${capital} through ${name}'s card on ${chain} and keep the receipts.`;
  if (c.includes('decentralized btc')) return `Deposit $${capital} of BTC into ${name} on ${chain} and keep the position open.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${name}'s chain and use one of its native apps the same week.`;
  if (c.includes('privacy')) return `Deposit $${capital} into ${name}'s shielded pool on ${chain} and keep the note.`;
  if (c.includes('cedefi')) return `Deposit $${capital} into ${name}'s managed vault on ${chain} and keep the position open.`;
  if (c.includes('ai') || c.includes('decentralized ai')) return `Deposit $${capital} into ${name}'s compute or agent pool on ${chain} and keep the position open.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The weekly action, by category: the step that keeps the farm alive after the first deposit. */
function weeklyActionFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'Adjust the position or vote on one governance proposal each week.';
  if (c.includes('dex') || c.includes('liquidity manager')) return 'Swap once through the pool and re-balance the range each week.';
  if (c.includes('yield aggregator')) return 'Claim the yield and re-deposit it into the vault each week.';
  if (c.includes('yield') || c.includes('leveraged farm')) return 'Claim the yield and re-deposit it into the strategy each week.';
  if (c.includes('bridge') || c.includes('cross chain')) return 'Bridge a small amount back and forth each week to keep the route active.';
  if (c.includes('staking') || c.includes('restak')) return 'Check the staking rewards and re-stake them each week.';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'Close and re-open one small hedged trade each week.';
  if (c.includes('prediction')) return 'Place one new market position each week.';
  if (c.includes('curator') || c.includes('allocator')) return "Check the vault's allocation report and re-deposit the yield each week.";
  if (c.includes('stable')) return 'Check the peg and the yield on the stable asset each week.';
  if (c.includes('rwa')) return "Check the asset's yield accrual and any new issuance each week.";
  if (c.includes('insurance')) return 'Check the policy and any new cover options each week.';
  if (c.includes('payment')) return 'Make one payment through the protocol each week.';
  if (c.includes('governance')) return 'Vote on one proposal each week.';
  if (c.includes('basis')) return 'Check the funding rate and keep the basis position through each weekly cycle.';
  if (c.includes('launchpad')) return 'Check for new sales and complete any allocation steps each week.';
  if (c.includes('chain')) return 'Use one native app on the chain each week.';
  if (c.includes('privacy')) return "Check the shielded pool's yield each week.";
  if (c.includes('index')) return 'Check the index rebalance and hold the shares each week.';
  if (c.includes('cedefi')) return "Check the managed vault's report each week.";
  if (c.includes('ai') || c.includes('decentralized ai')) return "Check the compute pool's rewards each week.";
  return 'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote.';
}

/** Where to look for the rewards before withdrawing, by category. */
function claimCheckFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('curator') || c.includes('allocator')) {
    return "open the protocol's rewards page and check the supply and borrow points";
  }
  if (c.includes('dex') || c.includes('liquidity manager')) return "open the protocol's LP rewards and points page";
  if (c.includes('yield') || c.includes('leveraged farm')) return "open the vault's rewards page and check the points balance";
  if (c.includes('staking') || c.includes('restak')) return 'open the staking dashboard and check the accrued rewards';
  return "open the protocol's own points or rewards page";
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasUsd(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const bridgeGas = Math.max(1, Math.round(gas * 4 * 100) / 100);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'no cost to create; under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: `Move $${capital} of USDC onto ${chain} from an exchange or a bridge you already trust.`,
      cost: `about $${bridgeGas} of gas to bridge`,
      time: '10 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weeklyActionFor(p),
      cost: `about $${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, ${claimCheckFor(p)} and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    category_multiple: row.model.category_multiple,
    category_multiple_raw: row.model.category_multiple_raw,
    shrink_weight: row.model.shrink_weight,
    multiple_source: row.model.multiple_source,
    size_factor: row.model.size_factor,
    size_reference_tvl_usd: row.model.size_reference_tvl_usd,
    growth_multiplier: row.model.growth_multiplier,
    launch_multiplier: row.model.launch_multiplier,
    stablecoin_discount: row.model.stablecoin_discount,
    why: row.why,
    comps: row.comps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const calibration = calibrate(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}

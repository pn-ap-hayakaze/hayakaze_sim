# Engine Validation Prototype

> **Frozen (2026-09-17).** The engine, tests and scripts have been ported to `packages/engine`; this directory is kept only as the
> calibration reference until `docs/repository-structure.md` section 4 step 5 removes it. Do not add mechanics here.

A prototype that implements **only the simulation part** of the NPB pennant-race simulation ahead of
everything else, to confirm that the produced statistics are close to the real NPB.
No UI, no save files, no GM features.

The formal documents (`docs/`) and the real implementation follow once this prototype has validated the model.
Japanese version: `README.ja.md`.

## Running

```bash
cd prototype
npm install
npm test                    # calibration asserts (6 seeds), RNG independence, DH typing, clutch coefficient
npm run validate            # one season: league level, standings, title leaders
npm run validate -- 777     # different seed
npm run diag                # spread of individual stats (ERA standard deviation, etc.)
npm run diag:levels         # league level over several seeds in one table (source of the calibration table)
npm run diag:fatigue        # fatigue model behaviour
npm run diag:bullpen        # bullpen usage distribution
npm run diag:usage          # consecutive-day appearances, complete games, pitch counts, start intervals, steal attempts
npm run diag:clutch         # effect of the clutch coefficient
npm run typecheck
```

One season (858 games) takes about 130 ms, 0.15 ms per game.

## Layout

```
src/
  engine/
    rng.ts                 seedable RNG and independent per-purpose / per-game streams. Math.random() is never used
    player/
      ratings.ts           rating types (100-point scale, 50 = average of players who actually play). Position and lineup-slot types
      arsenal.ts           pitch arsenal generation and derivation of outcome ratings (H/9 etc.)
      clutch.ts            clutch generation distribution (thin upper tail)
      generate.ts          roster generation (tiers, positional profiles, team strength differences)
    sim/
      oddsRatio.ts         Odds Ratio Method. League-average outcome distribution (the level anchor) lives here
      profile.ts           ratings → plate-appearance outcome rates. SLOPE and clutch coefficient are calibrated here
      game.ts              one game: runners, steals, errors, bullpen changes, fatigue
      stats.ts             stat line types
    league/
      config.ts            league configuration (teams, leagues, DH, games per matchup). Team count and game count derive from it
      lineup.ts            automatic lineup, rotation and bullpen roles
      schedule.ts          schedule (round robin from the config; NPB default 25×5 same league + 3×6 interleague = 143)
      season.ts            daily tick, standings, fatigue accumulation and recovery
    metrics/               RE24, linear weights, wOBA, WAR, percentiles, calibration analysis
  data/
    teams.ts               12 teams (real home cities, fictional names) and the NPB default league config
    names.ts               material for fictional player names
scripts/                   validation and calibration diagnostics
test/                      vitest. Calibration regression tests
```

## Model Highlights

### Plate appearance outcome — Odds Ratio Method
From the batter rate b, the pitcher rate p and the league average l, `odds = (b/(1-b))(p/(1-p)) / (l/(1-l))`
is computed for each of the eight outcome categories (K, BB, HBP, HR, 3B, 2B, 1B, out in play) and normalised.
Batter and pitcher ratings are paired and cancel each other out:

| Batter | Pitcher | Outcome |
|---|---|---|
| Meet (how often a good ball is hit) | H/9 | all hits in play (mostly singles) |
| Power (strength of the ball in play) | HR/9 | mainly home runs, also doubles, triples and singles |
| Contact | K/9 | strikeouts |
| Eye | BB/9 | walks |

Power is not a home-run-only rating. Hard-hit balls get through the infield, split the outfield and clear the fence,
so power is distributed over all hits in play (HR 0.7 / 3B 0.3 / 2B 0.45 / 1B 0.15).

**Level and spread are controlled by different constants.** `LEAGUE_AVERAGE` (the outcome distribution of a 50 vs 50
matchup) sets the league-wide level, and `SLOPE` (how far the logit moves per +10 rating points) sets the spread of
individual differences. When the players who actually play average 50, the league's realised stats land almost on the
anchor (about +.003 in batting average from the Jensen effect of the rating spread).

**Warning:** never compute `OUT_IN_PLAY` as a residual inside a profile. Rating differences would count twice and a
pitcher with a 0.52 ERA appears. Normalisation happens exactly once, in `combine()`.

### Clutch — a multiplier on meet with runners in scoring position
With a runner on second or third, the batter's meet and the pitcher's H/9 are multiplied by
`f(clutch) = 1 + 0.09 × (clutch − 50) / 10`. `f(50) = 1.0`. It is a multiplier, not a replacement, so the higher a
player's meet, the larger the absolute upside in scoring position ("clutch amplifies ability").

- Why 0.09: one point of meet is worth about 1.4 wOBA points. Clutch is generated with σ 10, so the true clutch talent
  (player-to-player σ of RISP wOBA − normal wOBA) among starters comes to about 7 wOBA points (5.6–7.3 over six seeds,
  mean 6.6). The Book estimates clutch talent at about 8 points. The reviewers' offset proposal
  `meet + 0.35×(clutch−50)` only reaches σ≈5
- Generation distribution is `70 − Gamma(4, 5)` (`player/clutch.ts`): mean 50, σ 10, hard ceiling 70, about 1.4% above 65,
  none above 70. σ stays at 10 so the 1:1 mapping to the 20–80 scale holds; "rarely high" is expressed by the shape
- Generated independently of meet and roster tier. Pitcher clutch is drawn from the same distribution independently of
  hits and uses the same multiplier form
- The previous "replace contact with clutch" approach made the player-to-player RISP variance 2.5× the real value
  (true σ about 20 batting-average points) and erased tier gaps (slugger vs bench) and platoon splits (meet vs L/R) in
  scoring position. With the multiplier, the tier gap is preserved at 1.00–1.02× and the platoon-split correlation is
  0.995 or higher. League runs match the all-50 case within ±1%
- On the pitcher side the same coefficient has about 0.4× the effect (talent σ 2.4–3.1) because the `pitcherHit` slope is
  deliberately gentle. The (ERA − FIP) σ of qualified pitchers barely moves: 0.53 without the coefficient, 0.54–0.57 with it

### Designated hitter — a lineup slot, not a fielding position
`POSITIONS` stays the nine fielding positions; `LINEUP_SLOTS = [...POSITIONS, 'DH']` is a separate lineup-slot type.
Adding DH to `POSITIONS` would give every player a meaningless "DH fielding rating" through `FieldingByPosition`.
`BattingStats.appearances` records games per slot, and the WAR positional adjustment is apportioned by these
appearances rather than by primary position (a shortstop resting at DH gets no shortstop bonus that day).
The DH adjustment is the FanGraphs MLB value, −17.5 runs per 162 games.

DH is a per-league setting in `LeagueConfig`; the home league's rule applies to the game. The default is **DH in both
leagues** (design decision). The game simulation (`game.ts`) knows nothing about leagues and only receives `GameRules { dh }`.

### League configuration — no hard-coded team or game counts
`LeagueConfig` (team list, league definitions, same-league games per matchup, interleague games per matchup) drives the
schedule, games per season, qualifying plate appearances and standings. The NPB default is 12 teams in 2 leagues,
25×5 + 3×6 = 143 games. Future expansion or realignment is expressed by swapping this config.

### RNG — independent per-purpose and per-game streams
Game RNGs are derived per game from `hash(masterSeed, GAME, year, day, gameId)` (murmur3 fmix32, `rng.ts`).
Roster and schedule generation use separate streams from the same mechanism, and derivation hooks exist for injuries,
scouting observations, growth and AI decisions. `Rng.serialize()` / `Rng.restore()` write the state into a save.

Previously a single `Rng` was shared across the season: one extra `rng.next()` on day 10 changed the record of all 12
teams and swapped the champion (save/load plus a lineup tweak could re-roll the rest of the season). Now a test guarantees
that changing one game's RNG consumption leaves the other games of the same day, and the next day's games not involving
those two teams, unchanged (fatigue propagates causally across games, so later games of those two teams legitimately differ).

### Two-layer pitcher ratings
- Material: speed / break / control per pitch. The pitcher's overall values are the averages
- Outcome ratings: H/9, HR/9, K/9, BB/9 are derived from the material (`arsenal.ts`). The simulation uses only these.
  Clutch is not derived from the material; it is independent
- A fastball's "break" is its ride. The higher, the more swings and misses (feeds K/9 directly)
- Pitches that are better when slower (curve, changeup, etc.) are rated by the speed gap to the fastball
- Each pitch's break is "quality as that pitch type" (50 = average). Using absolute movement shifts the mean to about 40 and breaks calibration

### Fatigue
- An appearance adds `22 + pitches × 0.7` fatigue; every day recovers `10 + recovery × 0.2` (recovery is an independent rating; `dailyRecovery` in `season.ts`)
- Fatigue shrinks the pitch limit, lowers ratings and lowers bullpen priority. 60 or more means unavailable
- There is no consecutive-day rule. Fatigue decides the physical limit

### Bullpen roles
One closer, three setup men, four middle relievers. High-leverage spots (7th inning or later, tied to a 3-run lead, or
1 run behind) go to setup men, everything else to middle relievers, blowouts to the lower middle relievers. Without
fixed roles the best reliever exceeds 90 appearances a year.

### Plate-appearance events and sabermetrics
Every plate appearance is recorded as a `PlateAppearanceEvent` (runners, outs and score difference before and after,
outcome), about 64,000 per season. From these the **run expectancy table (RE24) and linear weights are derived from the
simulation itself**, giving wOBA → wRAA → wRC+. No external constants are borrowed, so the weights follow the league
environment automatically.

- `metrics/runExpectancy.ts` — RE24 and linear weights via ΔRE. Half-innings cut short by a walk-off are excluded from
  the sample, sparse cells shrink toward a prior table, and impossible transitions such as "a run scores on the third out"
  are counted to catch game-logic bugs
- `metrics/advanced.ts` — wOBA / wRC+ / FIP / WAR, FanGraphs style:
  batters = (wRAA + baserunning + positional + league adjustment + replacement) / RPW, replacement fixed at 570 wins per 2430 games converted with RPW.
  pitchers = (wins above average per game + replacement per game: starters .12, relievers .03) × IP/9. Fielding is not included yet (needs the batted-ball layer)
- `metrics/percentile.ts` — Baseball Savant style percentiles (ratings and stats share the mechanism, 1–100)
- `metrics/leagueLevel.ts` — league level (shared by the calibration tests and diagnostics)
- `metrics/clutchAnalysis.ts` — analytical clutch talent (realised RISP stats carry binomial noise five times the talent, so talent is computed from ratings)

Derived wOBA weights (seed 20260915): 1B .875 / 2B 1.301 / 3B 1.607 / HR 2.300 / BB .733.
Close to the published MLB values (.88 / 1.25 / 1.58 / 2.03 / .69); extra bases are relatively more valuable in a lower-scoring environment.
Total batter / pitcher WAR is 201 / 155 (the FanGraphs split gives targets of 201 / 152).

These formulas were verified by multi-perspective review plus refutation (Workflow). The original implementation had three
formula errors (pitcher replacement level treated as a share of runs, giving 44% of the defined pitcher WAR; an old
approximation for batter replacement; a missing league adjustment) and three game-flow bugs (a third-base runner vanishing
on a double play; a run scoring on a double play for the third out; the game not ending on a walk-off). All are fixed and
`npm run validate` includes regression checks for them.

Later: add batted-ball quality (type × strength × direction, Statcast-like barrel / hard-hit) as a middle layer and tie
reaction (four directions), arm and power to individual fielding chances. The fielding component of WAR sits on top of that.

## Calibration Results (DH in both leagues, 6 seeds: 20260915, 1–5)

`npm test` asserts "the 6-seed mean is inside the target and every seed is inside target ± tolerance".
The table is the output of `npm run diag:levels`.

| Metric | Simulation (range) | 6-seed mean | Real NPB (recent) |
|---|---|---|---|
| Batting average | .243–.252 | .248 | .240–.260 |
| On-base percentage | .310–.320 | .316 | .305–.325 |
| OPS | .674–.700 | .690 | .660–.715 |
| Runs per team-game | 3.55–3.86 | 3.74 | 3.6–4.3 |
| ERA | 3.15–3.51 | 3.37 | 3.00–3.60 |
| WHIP | 1.268–1.331 | 1.305 | 1.24–1.35 |
| Strikeout rate | 18.6–19.6% | 19.0% | 18–21% |
| Walk rate | 7.6–8.2% | 8.0% | 7.5–9% |
| Home run rate | 2.07–2.26% | 2.18% | 2.0–2.6% |
| Reached-on-error rate | 1.3–1.4% | — | 1.3–1.8% |
| Stolen base success | .666–.709 | .691 | .65–.75 |
| Batting champion | .336–.371 | .351 | .320–.350 |
| Home run leader | 31–37 | 33.5 | 30–40 |
| Stolen base leader | 36–51 | 43 | 25–45 |
| ERA σ of qualified starters | 0.56–0.75 | 0.65 | about 0.65 |
| OPS σ of qualified batters | .095–.110 | .100 | about .090 |
| Innings per start | 5.8–5.9 | — | 5.8–6.2 |
| Team win% range | .40–.60 | — | .40–.60 |

### Recalibration of 2026-09-16: what changed

Switching to DH in both leagues with the old constants put the 6-seed means on the upper target bounds: AVG .254 / OBP .323 /
OPS .709 / R/G 3.98 / ERA 3.58 / WHIP 1.351. The cause was a level shift: the pitchers batting in Central League parks
(wOBA ≈ .200, about 5.5% of all plate appearances) were replaced by bench hitters (wOBA ≈ .300), raising league wOBA by about 14 points.

**Only `LEAGUE_AVERAGE` (the anchor) changed. `SLOPE` did not.**

| Constant | Before | After |
|---|---|---|
| BB | .078 | .075 |
| HR | .0215 | .021 |
| 2B | .039 | .038 |
| 1B | .164 | .160 |
| OUT_IN_PLAY | .4925 | .501 |
| K / HBP / 3B | .19 / .01 / .005 | unchanged |

Reason: with a population averaging 50, `SLOPE` does not move the level to first order (it moves the spread). Fixing the
level through `SLOPE` would either break the spread of individual stats (batting champion, home run leader, ERA σ) or deepen
the batter/pitcher asymmetry (batterHR 0.33 vs pitcherHR −0.16, batterK −0.23 vs pitcherK 0.12). That asymmetry exists to
match the ERA spread, but it weakens the Odds Ratio Method's natural "batter and pitcher cancel out" stability and drives
run-environment drift over many seasons, so it must not be deepened. Re-anchoring "50 vs 50 = NPB average" makes the rating
baseline "50 = average of players who play" and the meaning of the anchor coincide for the first time, now that the DH is universal.

| 6-seed mean | Before (both-league DH, old anchor) | After |
|---|---|---|
| Batting average | .254 | .248 |
| On-base percentage | .323 | .316 |
| OPS | .709 | .690 |
| Runs per team-game | 3.98 | 3.74 |
| ERA | 3.58 | 3.37 |
| WHIP | 1.351 | 1.305 |
| Batting champion | .348 | .351 |
| Home run leader | 36.7 | 33.5 |
| ERA σ (qualified) | 0.66 | 0.65 |
| OPS σ (qualified) | .107 | .100 |

HR was tried at .0205 first, which pushed the home run leader down to 26–35, so it was moved back to .021 (R/G 3.71 → 3.74).
The spread barely changed before and after, so SLOPE did not need touching.

## Known Simplifications (next phase)

- No position-player rest or substitution. The nine starters play every game, so three times as many players reach
  qualifying plate appearances as in reality. This is one reason the wRC+ leader is 190–200 and WAR 8–10 is a little high
  (5–10% more plate appearances than a real batting champion)
- Baserunning is coarse (constant advance probabilities on singles and doubles, constant sacrifice flies and productive outs).
  The first-base runner in RE24 being worth about 10% less than MLB may come from here. To be rebuilt with the batted-ball layer
- Baserunning WAR is a constant valuation of steals and caught stealing only. Positional adjustments are the FanGraphs MLB
  values (NPB DELTA values flip the sign at third base, are asymmetric between the corner outfield spots, and put DH at −15.1; the swap is for the implementation phase)
- Wins and losses always go to the starter. Reliever decisions and holds are not implemented
- Earned runs use the simplified rule "every run after an error in that inning is unearned"
- The rotation is a fixed six. No injuries, demotions or swaps. The roster is 17 position players and 14 pitchers
- Injuries, development, the farm team, contracts, the draft and the postseason are out of scope
- The league-average anchor is a fixed constant. Over many seasons the playing population drifts from 50 and the run
  environment moves; the decision is to replace it every preseason with the weighted mean of the players who actually play (implementation phase)
- Losing the DH mid-game is not implemented. `Lineup.dh` and `GameRules.dh` are the hooks
- The lineup and bullpen AI reads true ratings. Passing an estimate view as an argument is for the implementation phase

## Known Issues (measured 2026-09-16; fixes belong to the implementation phase)

Measured with `npm run diag:usage` over six seeds. Targets come from `npb-calibration-targets`.

| Item | Measured (per team-season, 6-seed range) | Target | Cause |
|---|---|---|---|
| Relievers on 3 consecutive days | 19.8–22.4 | 1–2 | A single fatigue scalar with a fixed threshold cannot express "appearances in the last N days". Needs a soft gate |
| Relievers on 4 consecutive days | 4.9–7.3 | 0 | same |
| Relievers on 5+ consecutive days | 1.3–2.0 | 0 | same |
| Share of reliever appearances that are back-to-back | 29–31% | 18–19% | same |
| Complete games | 0.08–0.5 | 6–8 | The pitch limit is a single Gaussian (σ 7.5) and never stretches to the 115–130 of a complete game |
| Max pitches in a game | 116–125 (σ 7.5) | 137–143 (σ 17) | same |
| Start interval: 6 days rest | 79–89% | 49–53% | Fixed six-man rotation; no deactivation, "pitch-and-deactivate" or injuries |
| Start interval: 10+ days rest | 0.8–3.5% | 22–23% | same |
| Steal attempts / success | 69–84 / .68–.71 | 105–110 / .65–.75 | `attemptSteal` allows no attempts with two outs and no steals of third. No team running-policy lever |
| Pitchers used | 14 | 28–30 | The roster has 14 pitchers. Needs a 50+ man reserve list and roster moves |
| Middle reliever max appearances / innings | 76 / 98 | 60–70 / 60–75 | Eight relievers cover about 480 appearances a year, so each carries too many |
| OPS σ of qualified batters | .095–.110 | about .090 | No rest for position players so starters get many plate appearances; tier spread slightly wide |

How consecutive days are counted: list each reliever's appearance days and count maximal runs of consecutive days by length
(3 consecutive = the number of runs of exactly three days). Appearances separated by the Monday off-day are not consecutive.

Steal attempts are registered in `npm test` as `it.fails` (a known failure). When `attemptSteal` is fixed and reaches the target
that test fails in reverse; remove `it.fails` at that point.

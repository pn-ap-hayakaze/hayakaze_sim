# Glossary (Ubiquitous Language)

| | |
|---|---|
| Document | `docs/glossary.md` (Japanese: `docs/glossary.ja.md`) |
| Status | Draft v0.1, 2026-09-17, awaiting approval |
| Scope | The terms used in documents, code and UI, with their fixed English and Japanese forms and the code identifier for each. When a term here conflicts with a synonym elsewhere, this document wins |

Column key: **Japanese** is the UI and conversation form; **English** is the documentation form; **Code** is the
identifier used in `packages/engine` and `packages/app`.

## 1. Domain Terms: League and Season

| Japanese | English | Code | Definition |
|---|---|---|---|
| リーグ構成 | league configuration | `LeagueConfig` | Clubs, leagues, DH per league, games per matchup, roster limits, postseason format. All counts derive from it |
| リーグ | league | `LeagueDefinition`, `leagueId` | A group of clubs that play each other most; default Central and Pacific |
| 球団 | club | `Club`, `clubId` | A team as an organisation. "Team" is avoided in new code except where the prototype's `Team` type survives |
| 本拠地 | home city | `city` | Real city name |
| 球場 | ballpark | `ballpark` | Fictional name: place + ドーム / スタジアム / 球場 |
| 公式戦 | regular season | `phase: 'SEASON'` | The 143-game schedule |
| 交流戦 | interleague play | `interleague` | Games between clubs of different leagues |
| 日次ティック | daily tick | `advanceOneDay` | The only way time advances |
| 日 | day | `day` | 1-based day of the season calendar |
| プレシーズン / オフシーズン | preseason / offseason | `'PRESEASON'`, `'OFFSEASON'` | Phases before and after the season |
| クライマックスシリーズ | Climax Series | `climaxSeries` | Postseason within a league: first stage and final stage |
| ファーストステージ / ファイナルステージ | first stage / final stage | `firstStage`, `finalStage` | 2nd vs 3rd (best of 3); 1st vs first-stage winner |
| アドバンテージ | advantage | `advantage` | Wins credited to the 1st-place club before the final stage (1, or 2 in the extended format) |
| 日本シリーズ | Japan Series | `japanSeries` | Best of 7 between league champions |
| 順位表 | standings | `standings`, `ClubRecord` | Win% with ties excluded from the denominator (NPB) |
| ゲーム差 | games behind | `gamesBehind` | `((W₁ − W) + (L − L₁)) / 2` |
| 引き分け | tie | `tie` | Games can end tied (regular season) |
| 予告先発 | announced starting pitcher | `announcedStarter` | Known before the game; used for platoon lineups |

## 2. Domain Terms: Roster and Institutions

| Japanese | English | Code | Definition |
|---|---|---|---|
| 支配下（選手） | controlled (player) | `controlled`, `controlledMax` | Under contract with a club; cap 70 |
| 一軍登録 / 出場選手登録 | active roster registration | `level: 'ACTIVE'`, `register` | Eligible for first-team games; limit 31 |
| ベンチ入り | dugout | `dugout` | The 26 chosen from the active roster on game day |
| 二軍 | farm (team) | `level: 'FARM'` | Controlled players not on the active roster; simplified layer in Season 1 |
| 抹消 / 登録抹消 | deactivation | `deactivate`, `deactivatedOnDay` | Removal from the active roster; 10 days before re-registration |
| 10日ルール | ten-day rule | `REREGISTRATION_DAYS` | Re-registration allowed from the 10th day counting the deactivation day |
| 投げ抹消 | pitch-and-deactivate | `pitchAndDeactivate` | Deactivating a starter right after a start to return on a longer interval |
| 自由契約 | release | `release` | The club gives up control; the player leaves the controlled list |
| 引退 | retirement | `retire`, `retirementTiming` | Leaving the game; triggered by age, decline, playing time, injury, contract expiry |
| 引き際 | sense of timing (retirement) | `retirementTiming` | Hidden trait: how readily a player retires when triggers accumulate |
| 外国人枠 | foreign-player quota | `foreignActive`, `foreignMaxPitchers`, `foreignMaxPositionPlayers` | Limit on foreign players on the active roster (5 default, 4 in the agreement), with a pitcher/position-player breakdown |
| 外国人区分 | foreign status | `foreignStatus: 'DOMESTIC' \| 'FOREIGN' \| 'FOREIGN_EXEMPT'` | Whether a player counts against the quota |
| 枠除外 | quota exempt | `'FOREIGN_EXEMPT'` | Foreign player who does not count (e.g. three years at a Japanese high school) |
| 育成（契約・ドラフト） | developmental (contract / draft) | `ikusei` | Not in Season 1; term reserved |
| ドラフト / 新人選手選択会議 | draft | `Draft` | Annual amateur selection in the offseason |
| 入札抽選 | bidding lottery | `BidRound`, `lottery` | Round 1: simultaneous bids, lottery among clubs bidding on the same player |
| 単独指名 | single bid | `singleBid` | Only one club bid on the player in that round |
| 競合 | contention | `contention` | Two or more clubs bid on the same player |
| 優先リーグ | priority league | `priorityLeagueId` | Breaks ties in draft order; alternates by year |
| スネーク方式 | snake order | `snake` | Round order reverses each round from round 2 |
| 終了宣言 | finish (the draft) | `finished` | A club stops picking and cannot rejoin |
| アマチュア区分 | amateur category | `category: 'HIGH_SCHOOL' \| 'UNIVERSITY' \| 'INDUSTRIAL' \| 'INDEPENDENT'` | High school, university, industrial league, independent league |
| 規定打席 / 規定投球回 | qualifying plate appearances / innings | `qualifyingPa`, `qualifyingOuts` | Games × 3.1 PA; games × 1 inning; derived from the config |

## 3. Domain Terms: Players and Ratings

| Japanese | English | Code | Definition |
|---|---|---|---|
| 能力値 | rating | `Ratings`, `rating` | 1–99; 50 = average of players who actually play; σ ≈ 10 |
| 真値 | true value | `player.ratings` | The actual rating; never displayed |
| 推定（値） | estimate | `Estimate`, `mean`, `sigma` | One club's belief: mean and uncertainty |
| 表示（値） | displayed value | `views`, `DisplayRating` | What the GM sees: grade, exact number or public estimate |
| 判明 | revelation | `revealed`, `REVEALED` | Owner's base ratings become exact after 50 PA / 100 BF or 60 days |
| 公開推定 | public estimate | `publicEstimate` | Estimate derived from statistics, shared by all clubs |
| 私的オフセット | private offset | `privateOffset` | A club's own adjustment to the public estimate |
| 20-80 スケール | 20–80 scale | `Grade`, `toGrade` | Scouting grades in steps of 5; 1:1 with the internal scale |
| 現在値 / 将来値 | Present / Future | `present`, `future` | Grade now and projected grade at peak, shown as `55/70` |
| 上限値 | cap | `Caps`, `cap` | The value a tool cannot exceed; soft-cap growth |
| ツール | tool | `CapTool` | A group of ratings sharing one cap (meet, power, speed, arm, fielding, contact, eye, clutch, durability) |
| 固定シェイプ | fixed shape | `shapes` | Per-player offsets deriving fields from a tool value (platoon split, position offsets, reaction profile) |
| 成長型 | growth type | `growthType` | One of seven timing patterns of growth |
| ポテンシャル | potential | `potential` | Hidden speed of growth toward the target; moves with performance and playing time |
| 衰えにくさ | resistance to decline | `declineResistance` | Hidden, fixed |
| プロ意識 | professionalism | `professionalism { base, current }` | Hidden; slows decline and amplifies the performance feedback into potential |
| 隠しパラメータ / 隠し特性 | hidden trait | `HiddenTraits` | Never displayed and never revealed |
| ミート | meet | `meetVsR`, `meetVsL` | How often a good ball is hit; drives all hits in play |
| パワー | power | `powerVsR`, `powerVsL` | Strength of the ball in play; HR most, also 2B/3B/1B |
| コンタクト | contact | `contact` | Reduces strikeouts |
| 選球眼 | eye | `eye` | Raises walks |
| クラッチ | clutch | `clutch`, `clutchFactor` | Multiplier on meet (batter) or hits (pitcher) with runners in scoring position; f(50) = 1.0 |
| 走力 / 盗塁 / 走塁 | speed / stealing / baserunning | `speed`, `stealing`, `baserunning` | Raw speed; steal technique; judgment |
| 肩（強さ / 正確さ） | arm (strength / accuracy) | `armStrength`, `armAccuracy` | |
| 反応 | reaction | `ReactionRatings` | Four directions: forward, backward, left, right |
| 守備（ポジション別） | fielding by position | `fielding: Record<Position, number>` | Aptitude per fielding position |
| 守備位置 | fielding position | `Position`, `POSITIONS` | P, C, 1B, 2B, 3B, SS, LF, CF, RF. DH is not a position |
| 打順枠 | lineup slot | `LineupSlot`, `LINEUP_SLOTS` | The nine positions plus DH |
| 指名打者 | designated hitter (DH) | `dh`, `'DH'` | Bats but does not field; a lineup slot |
| DH 解除 | loss of the DH | `dhLost` | The DH takes the field mid-game; the pitcher's slot bats |
| ポップタイム | pop time | `popTime` | Catcher: total time from catch to tag at second; 1 point = 0.005 s |
| ブロッキング | blocking | `blocking` | Catcher: preventing wild pitches and passed balls |
| 球種構成 | arsenal | `arsenal: Pitch[]` | Pitches with speed, break and control; outcome ratings derive from it |
| 結果指標（投手） | outcome ratings | `hits`, `homeRuns`, `strikeouts`, `walks` | H/9, HR/9, K/9, BB/9 suppression |
| スタミナ / 回復 | stamina / recovery | `stamina`, `recovery` | Pitches per game; fatigue recovered per day |
| 耐久 / 怪我耐性 | durability | `durability` | Weak factor in injury risk |
| 利き（投・打） | handedness (throws / bats) | `throws`, `bats` | `'R' \| 'L'`; bats may be `'S'` (switch) |
| プラトーン | platoon | `platoon` | Left/right matchup use |
| 主ポジション | primary position | `primaryPosition` | |
| 投手の役割 | pitcher role | `pitcherRole: 'SP' \| 'RP' \| 'CL'` | Starter, reliever, closer |
| 階層 | tier | `tier` | Generation tier: star, regular, bench, farm |

## 4. Domain Terms: Simulation, Fatigue and Injury

| Japanese | English | Code | Definition |
|---|---|---|---|
| Odds Ratio 法 | Odds Ratio Method | `oddsRatio.ts`, `combine` | Batter × pitcher ÷ league odds per outcome, normalised once |
| リーグ平均（アンカー） | league-average anchor | `LEAGUE_AVERAGE` | Outcome distribution of a 50-vs-50 matchup; sets the level |
| 傾き | slope | `SLOPE` | Logit change per +10 rating; sets the spread |
| 再アンカー | re-anchoring | `reanchor` | Preseason replacement of the anchor by the playing population's mean |
| 打席結果 | plate-appearance outcome | `PaOutcome` | K, BB, HBP, HR, 3B, 2B, 1B, out in play |
| 打席イベント | plate-appearance event | `PlateAppearanceEvent` | State before and after one PA |
| 得点圏 | runners in scoring position (RISP) | `risp` | Runner on 2nd or 3rd |
| 疲労（蓄積） | fatigue (accumulated) | `fatigue` | 0–100; rises with appearances and pitches, recovers daily |
| 球数上限 | pitch limit | `pitchLimit` | Per-start limit, shrinks with fatigue, extends on inning boundaries |
| 連投 | consecutive-day appearances | `consecutiveDays` | Reliever appearing on consecutive game days |
| ソフトゲート | soft gate | `softGate` | Probability-lowering rule on appearances in the last N days |
| 完投 | complete game | `completeGame` | Starter pitches the whole game |
| 中6日 | six days' rest | `daysRest` | Standard NPB starter interval |
| 故障 | injury | `Injury`, `currentInjury` | Days out; no body part in Season 1 |
| 故障歴 | injury history | `health.history` | Days lost this season, last season, two seasons ago |
| 離脱日数 | days out | `daysRemaining`, `daysOut` | Right-skewed distribution |
| 球数閾値 | pitch-count threshold | `PITCH_THRESHOLD` | 115–120 pitches; step increase in injury risk |
| 守護神 / セットアッパー / 中継ぎ | closer / setup / middle reliever | `closer`, `setup`, `middle` | Bullpen roles |
| レバレッジ | leverage | `leverage` | Importance of a game situation for bullpen choice |
| 失策出塁 | reached on error | `roe`, `reachedOnError` | |
| 自責点 | earned run | `er` | Simplified rule: runs after an error in the inning are unearned |

## 5. Domain Terms: Metrics

| Japanese | English | Code | Definition |
|---|---|---|---|
| 得点期待値表 | run expectancy table (RE24) | `RunExpectancyTable` | Expected runs from each of 24 base-out states |
| 線形ウェイト | linear weights | `linearWeights` | Run value of each outcome from ΔRE |
| wOBA | weighted on-base average | `woba`, `WobaWeights`, `wobaScale` | Derived from the simulation's own events |
| wRC+ | weighted runs created plus | `wrcPlus` | 100 = league average |
| FIP | fielding independent pitching | `fip` | |
| WAR | wins above replacement | `war`, `battingWar`, `pitchingWar` | FanGraphs structure; NPB positional adjustments |
| ポジション調整 | positional adjustment | `POSITIONAL_ADJUSTMENT` | Runs per 1200 innings (DELTA); apportioned by appearances |
| 出場内訳 | appearances by slot | `appearances: Record<LineupSlot, number>` | Games at each lineup slot |
| パーセンタイル | percentile | `percentile` | 1–100 rank within a population, Savant style |
| リーグ水準 | league level | `leagueLevel` | League-wide rates used in calibration |
| 較正 | calibration | `calibration` | Matching simulated levels to NPB targets |
| 許容幅 | tolerance | `tolerance` | Per-seed widening of a target range in tests |
| 得点環境 | run environment | `RunEnvironment` | Season-level RE24, weights, anchor |

## 6. Domain Terms: Scouting and Information

| Japanese | English | Code | Definition |
|---|---|---|---|
| スカウト | scout | `Scout` | Club employee with skill and bias |
| 視察 | observation (scouting visit) | `observe`, `ScoutReport` | One noisy, biased look at a player |
| 見抜きやすさ | visibility | `visibility` | How precisely a rating can be observed |
| バイアス | bias | `bias` | Persistent per-scout offset; never shrinks |
| クロスチェック | cross-check | `crossCheck` | Several scouts on one player |
| 確信度 | confidence | `sigma` (displayed as weight) | Inverse of uncertainty; shown visually, never numerically |
| カルマンフィルタ | Kalman filter | `kalmanUpdate` | Predict-update recursion for estimates |
| 推定ビュー | ratings view | `RatingsView` | Function returning a club's estimate of a player; input to all decisions |
| 情報の非対称性 | information asymmetry | — | Owner knows true values; others hold estimates |
| 期待値最大の指名 | expected-value bidding | `aiBid` | AI draft strategy weighing win probability against value |

## 7. Business and Product Terms

| Japanese | English | Code | Definition |
|---|---|---|---|
| ゼネラルマネージャー（GM） | general manager (GM) | `gmClubId` | The player's role |
| AI 監督 | AI manager | `ai/manager` | Field decisions for every club |
| AI 球団 | AI club | `isAi`, `ai/clubGm` | Clubs not controlled by the player |
| 方針 | policy | `Policy` | GM's standing instructions: pitch limit, ace handling, running |
| 架空リーグ | fictional league | `generateGame` | Default: real cities, fictional clubs and players |
| 実名データ | real-name data | `importData` | User-supplied; never bundled |
| シーズン1 | Season 1 | — | First playable release scope |
| 後続フェーズ | later phase | — | Contracts, coaches, farm simulation, batted-ball layer, desktop |
| 説明可能性 | explainability | — | Every displayed number traceable to a mechanism |
| 較正目標 | calibration target | — | NPB level ranges in `product-requirements.md` section 7 |
| 永続文書 / 作業文書 | permanent / work-unit document | `docs/`, `.steering/` | CLAUDE.md categories |

## 8. UI Terms

| Japanese | English | Code | Definition |
|---|---|---|---|
| ダッシュボード | dashboard | `Dashboard` | Day view: today's games, news, standings snapshot |
| 選手ページ | player page | `PlayerPage` | Ratings (view-dependent), percentiles, lines, health |
| ロスター画面 | roster screen | `Roster` | Active / farm / controlled tabs |
| スカウト画面 | scouting screen | `Scouting` | Amateur list, assignments, reports |
| ドラフト画面 | draft screen | `Draft` | Bids, lotteries, rounds |
| 方針画面 | policy screen | `Policy` | The three dials and overrides |
| 成績画面 | stats screen | `Stats` | Leaders and tables |
| セーブ / ロード | save / load | `SaveLoad` | Slots, export, import |
| 1日進める | advance one day | `advanceDay` | Primary action |
| 次のイベントまで | advance to next event | `advanceToEvent` | Stops at the next decision point |
| パーセンタイルバー | percentile bar | `PercentileBar` | Savant-style horizontal bar |
| グレード表示 | grade cell | `GradeCell` | `55/70` Present/Future |
| 濃淡 | visual weight | `confidenceClass` | Opacity or type weight encoding uncertainty |
| 拒否（理由） | refusal | `Refusal` | A rule-based rejection shown as a dialog |
| ニュース | news | `news` | Daily feed of roster moves, injuries, milestones |

## 9. English–Japanese Correspondence (compact)

| English | Japanese | English | Japanese |
|---|---|---|---|
| club | 球団 | rating | 能力値 |
| active roster | 一軍登録 | true value | 真値 |
| farm | 二軍 | estimate | 推定 |
| controlled | 支配下 | revelation | 判明 |
| deactivate | 抹消 | cap | 上限値 |
| register | 登録 | growth type | 成長型 |
| release | 自由契約 | potential | ポテンシャル |
| retirement | 引退 | professionalism | プロ意識 |
| foreign-player quota | 外国人枠 | hidden trait | 隠しパラメータ |
| draft | ドラフト | meet | ミート |
| bidding lottery | 入札抽選 | power | パワー |
| interleague | 交流戦 | contact | コンタクト |
| Climax Series | クライマックスシリーズ | eye | 選球眼 |
| Japan Series | 日本シリーズ | clutch | クラッチ |
| standings | 順位表 | fatigue | 疲労 |
| games behind | ゲーム差 | injury | 故障 |
| designated hitter | 指名打者 | days out | 離脱日数 |
| lineup slot | 打順枠 | scout | スカウト |
| fielding position | 守備位置 | observation | 視察 |
| pitch-and-deactivate | 投げ抹消 | bias | バイアス |
| complete game | 完投 | confidence | 確信度 |
| six days' rest | 中6日 | policy | 方針 |
| run expectancy | 得点期待値 | AI manager | AI 監督 |
| linear weights | 線形ウェイト | general manager | GM |
| positional adjustment | ポジション調整 | calibration | 較正 |
| percentile | パーセンタイル | tolerance | 許容幅 |

## 10. Naming Rules in Code

1. Use the **Code** column of this glossary for identifiers; do not coin synonyms (`team` vs `club`, `demote` vs
   `deactivate`, `minor` vs `farm`).
2. Ratings keep the prototype's field names (`meetVsR`, `powerVsL`, `hits`, `homeRuns`, `strikeouts`, `walks`) even
   where the English term differs (`hits` = H/9 suppression), because calibration code and tests refer to them.
3. Institutional constants carry the NPB term in the name: `REREGISTRATION_DAYS`, `foreignActive`, `controlledMax`.
4. Statistical abbreviations are lower-case in code (`pa`, `hr`, `woba`) and upper-case in UI text (PA, HR, wOBA).
5. Japanese appears in code only in comments, error messages and `strings/` modules; identifiers are English.
6. When a new term is needed, add it here first (English, Japanese, Code, Definition), then use it.

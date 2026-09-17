# 用語集（Ubiquitous Language）

| | |
|---|---|
| 文書 | `docs/glossary.ja.md`（英文版: `docs/glossary.md`） |
| 状態 | ドラフト v0.1、2026-09-17、承認待ち |
| 範囲 | 文書・コード・UI で使う用語と、その確定した英語形・日本語形、コード上の識別子。ここにある用語と他所の同義語が衝突したら、この文書が優先する |

列の意味: **日本語**は UI と会話での形、**英語**は文書での形、**コード**は `packages/engine` と `packages/app` で使う識別子。

## 1. ドメイン用語: リーグとシーズン

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| リーグ構成 | league configuration | `LeagueConfig` | 球団、リーグ、リーグごとの DH、カードあたり試合数、登録枠、ポストシーズン形式。すべての数はここから導出する |
| リーグ | league | `LeagueDefinition`, `leagueId` | 主に互いと対戦する球団の集まり。既定はセントラルとパシフィック |
| 球団 | club | `Club`, `clubId` | 組織としてのチーム。新しいコードでは「team」を避ける。プロトタイプの `Team` 型が残る箇所は例外 |
| 本拠地 | home city | `city` | 実在の都市名 |
| 球場 | ballpark | `ballpark` | 架空名: 地名＋ドーム／スタジアム／球場 |
| 公式戦 | regular season | `phase: 'SEASON'` | 143試合の日程 |
| 交流戦 | interleague play | `interleague` | 異なるリーグの球団同士の試合 |
| 日次ティック | daily tick | `advanceOneDay` | 時間が進む唯一の方法 |
| 日 | day | `day` | シーズン暦の1始まりの日 |
| プレシーズン / オフシーズン | preseason / offseason | `'PRESEASON'`, `'OFFSEASON'` | シーズン前後のフェーズ |
| クライマックスシリーズ | Climax Series | `climaxSeries` | リーグ内のポストシーズン。ファーストステージとファイナルステージ |
| ファーストステージ / ファイナルステージ | first stage / final stage | `firstStage`, `finalStage` | 2位 vs 3位（3戦2勝）。1位 vs ファースト勝者 |
| アドバンテージ | advantage | `advantage` | ファイナル前に1位球団に与える勝ち数（1。拡大形式では2） |
| 日本シリーズ | Japan Series | `japanSeries` | 両リーグ優勝球団の7戦4勝 |
| 順位表 | standings | `standings`, `ClubRecord` | 引き分けを分母から除いた勝率（NPB 方式） |
| ゲーム差 | games behind | `gamesBehind` | `((W₁ − W) + (L − L₁)) / 2` |
| 引き分け | tie | `tie` | 公式戦は引き分けで終わりうる |
| 予告先発 | announced starting pitcher | `announcedStarter` | 試合前に判明。プラトーン打順に使う |

## 2. ドメイン用語: ロスターと制度

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| 支配下（選手） | controlled (player) | `controlled`, `controlledMax` | 球団と契約下にある選手。上限70 |
| 一軍登録 / 出場選手登録 | active roster registration | `level: 'ACTIVE'`, `register` | 一軍の試合に出場できる。上限31 |
| ベンチ入り | dugout | `dugout` | 試合日に一軍登録から選ぶ26名 |
| 二軍 | farm (team) | `level: 'FARM'` | 一軍登録外の支配下選手。シーズン1では簡易層 |
| 抹消 / 登録抹消 | deactivation | `deactivate`, `deactivatedOnDay` | 一軍登録から外す。再登録まで10日 |
| 10日ルール | ten-day rule | `REREGISTRATION_DAYS` | 抹消日を含めて10日目から再登録できる |
| 投げ抹消 | pitch-and-deactivate | `pitchAndDeactivate` | 先発直後に抹消し、長い間隔で戻す |
| 自由契約 | release | `release` | 球団が保有権を放棄し、選手が支配下から外れる |
| 引退 | retirement | `retire`, `retirementTiming` | 現役を終える。年齢、衰え、出場機会、故障、契約満了が引き金 |
| 引き際 | sense of timing (retirement) | `retirementTiming` | 隠し特性: 引き金が積み重なったときにどれだけ引退しやすいか |
| 外国人枠 | foreign-player quota | `foreignActive`, `foreignMaxPitchers`, `foreignMaxPositionPlayers` | 一軍登録の外国人選手の上限（既定5、協約4）と投手／野手の内訳 |
| 外国人区分 | foreign status | `foreignStatus: 'DOMESTIC' \| 'FOREIGN' \| 'FOREIGN_EXEMPT'` | 枠に数えるかどうか |
| 枠除外 | quota exempt | `'FOREIGN_EXEMPT'` | 枠に数えない外国人選手（例: 日本の高校に3年） |
| 育成（契約・ドラフト） | developmental (contract / draft) | `ikusei` | シーズン1にはない。用語のみ予約 |
| ドラフト / 新人選手選択会議 | draft | `Draft` | オフシーズンの年1回のアマチュア選択 |
| 入札抽選 | bidding lottery | `BidRound`, `lottery` | 1巡目: 同時入札、同じ選手に入札した球団間で抽選 |
| 単独指名 | single bid | `singleBid` | その回で1球団だけが入札した |
| 競合 | contention | `contention` | 2球団以上が同じ選手に入札した |
| 優先リーグ | priority league | `priorityLeagueId` | 指名順の同順位を分ける。年ごとに交代 |
| スネーク方式 | snake order | `snake` | 2巡目以降、巡ごとに順序が反転する |
| 終了宣言 | finish (the draft) | `finished` | 球団が指名をやめ、以後復帰できない |
| アマチュア区分 | amateur category | `category: 'HIGH_SCHOOL' \| 'UNIVERSITY' \| 'INDUSTRIAL' \| 'INDEPENDENT'` | 高校、大学、社会人、独立リーグ |
| 規定打席 / 規定投球回 | qualifying plate appearances / innings | `qualifyingPa`, `qualifyingOuts` | 試合数 × 3.1 打席。試合数 × 1 イニング。設定から導出 |

## 3. ドメイン用語: 選手と能力値

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| 能力値 | rating | `Ratings`, `rating` | 1〜99。50 = 実際に出場している選手の平均。σ ≈ 10 |
| 真値 | true value | `player.ratings` | 実際の能力値。表示しない |
| 推定（値） | estimate | `Estimate`, `mean`, `sigma` | ある球団の信念: 平均と不確実性 |
| 表示（値） | displayed value | `views`, `DisplayRating` | GM が見るもの: グレード、正確な数値、公開推定 |
| 判明 | revelation | `revealed`, `REVEALED` | 所有球団の基礎能力が50打席／対戦100人または60日で正確になる |
| 公開推定 | public estimate | `publicEstimate` | 成績から導き全球団が共有する推定 |
| 私的オフセット | private offset | `privateOffset` | 公開推定に対する球団独自の補正 |
| 20-80 スケール | 20–80 scale | `Grade`, `toGrade` | 5刻みのスカウトグレード。内部スケールと1:1 |
| 現在値 / 将来値 | Present / Future | `present`, `future` | 現在のグレードとピーク時の予測グレード。`55/70` と表示 |
| 上限値 | cap | `Caps`, `cap` | ツールが超えられない値。ソフトキャップ型の成長 |
| ツール | tool | `CapTool` | 1つの上限を共有する能力の群（ミート、パワー、走、肩、守備、コンタクト、選球眼、クラッチ、耐久） |
| 固定シェイプ | fixed shape | `shapes` | ツール値からフィールドを導出する選手ごとのオフセット（プラトーン差、ポジション別オフセット、反応プロファイル） |
| 成長型 | growth type | `growthType` | 7種の成長タイミングのパターン |
| ポテンシャル | potential | `potential` | 目標に向かう成長速度（隠し）。成績と出場機会で動く |
| 衰えにくさ | resistance to decline | `declineResistance` | 隠し。固定 |
| プロ意識 | professionalism | `professionalism { base, current }` | 隠し。衰えを遅らせ、成績からポテンシャルへのフィードバックを増幅する |
| 隠しパラメータ / 隠し特性 | hidden trait | `HiddenTraits` | 表示も判明もしない |
| ミート | meet | `meetVsR`, `meetVsL` | 良い打球を打つ頻度。インプレーの全安打に効く |
| パワー | power | `powerVsR`, `powerVsL` | 打球の力。本塁打に最も、二塁打・三塁打・単打にも |
| コンタクト | contact | `contact` | 三振を減らす |
| 選球眼 | eye | `eye` | 四球を増やす |
| クラッチ | clutch | `clutch`, `clutchFactor` | 得点圏でミート（打者）または hits（投手）に掛かる係数。f(50) = 1.0 |
| 走力 / 盗塁 / 走塁 | speed / stealing / baserunning | `speed`, `stealing`, `baserunning` | 素の脚力。盗塁技術。判断力 |
| 肩（強さ / 正確さ） | arm (strength / accuracy) | `armStrength`, `armAccuracy` | |
| 反応 | reaction | `ReactionRatings` | 前・後・左・右の4方向 |
| 守備（ポジション別） | fielding by position | `fielding: Record<Position, number>` | 守備位置ごとの適性 |
| 守備位置 | fielding position | `Position`, `POSITIONS` | P、C、1B、2B、3B、SS、LF、CF、RF。DH は守備位置ではない |
| 打順枠 | lineup slot | `LineupSlot`, `LINEUP_SLOTS` | 9つの守備位置＋DH |
| 指名打者 | designated hitter (DH) | `dh`, `'DH'` | 打つが守らない。打順枠の1つ |
| DH 解除 | loss of the DH | `dhLost` | 試合中に DH が守備につく。以後は投手の枠が打席に立つ |
| ポップタイム | pop time | `popTime` | 捕手: 捕球から二塁タッグまでの総時間。1点 = 0.005秒 |
| ブロッキング | blocking | `blocking` | 捕手: 暴投と捕逸を防ぐ |
| 球種構成 | arsenal | `arsenal: Pitch[]` | 球速・変化・制球を持つ球種の集まり。結果指標はここから導出 |
| 結果指標（投手） | outcome ratings | `hits`, `homeRuns`, `strikeouts`, `walks` | H/9、HR/9、K/9、BB/9 の抑止力 |
| スタミナ / 回復 | stamina / recovery | `stamina`, `recovery` | 1試合の球数。1日に回復する疲労 |
| 耐久 / 怪我耐性 | durability | `durability` | 故障リスクの弱い因子 |
| 利き（投・打） | handedness (throws / bats) | `throws`, `bats` | `'R' \| 'L'`。打席は `'S'`（両打ち）もありうる |
| プラトーン | platoon | `platoon` | 左右の対戦相性に基づく起用 |
| 主ポジション | primary position | `primaryPosition` | |
| 投手の役割 | pitcher role | `pitcherRole: 'SP' \| 'RP' \| 'CL'` | 先発、救援、守護神 |
| 階層 | tier | `tier` | 生成時の階層: 主力、レギュラー、控え、二軍 |

## 4. ドメイン用語: シミュレーション、疲労、故障

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| Odds Ratio 法 | Odds Ratio Method | `oddsRatio.ts`, `combine` | 結果ごとに 打者 × 投手 ÷ リーグ のオッズを取り、1回だけ正規化 |
| リーグ平均（アンカー） | league-average anchor | `LEAGUE_AVERAGE` | 50 vs 50 の対戦の結果分布。水準を決める |
| 傾き | slope | `SLOPE` | 能力値 +10 あたりのロジットの変化。散らばりを決める |
| 再アンカー | re-anchoring | `reanchor` | プレシーズンにアンカーを実出場層の平均で差し替える |
| 打席結果 | plate-appearance outcome | `PaOutcome` | K、BB、HBP、HR、3B、2B、1B、インプレーのアウト |
| 打席イベント | plate-appearance event | `PlateAppearanceEvent` | 1打席の前後の状態 |
| 得点圏 | runners in scoring position (RISP) | `risp` | 二塁または三塁に走者 |
| 疲労（蓄積） | fatigue (accumulated) | `fatigue` | 0〜100。登板と球数で増え、毎日回復 |
| 球数上限 | pitch limit | `pitchLimit` | 先発ごとの上限。疲労で縮み、イニング境界で延びる |
| 連投 | consecutive-day appearances | `consecutiveDays` | 救援が連続する試合日に登板すること |
| ソフトゲート | soft gate | `softGate` | 直近 N 日の登板回数で登板確率を下げる規則 |
| 完投 | complete game | `completeGame` | 先発が全イニングを投げる |
| 中6日 | six days' rest | `daysRest` | NPB 標準の先発間隔 |
| 故障 | injury | `Injury`, `currentInjury` | 離脱日数。シーズン1では部位なし |
| 故障歴 | injury history | `health.history` | 今季・昨季・2季前の離脱日数 |
| 離脱日数 | days out | `daysRemaining`, `daysOut` | 右裾の重い分布 |
| 球数閾値 | pitch-count threshold | `PITCH_THRESHOLD` | 115〜120球。故障リスクの段差 |
| 守護神 / セットアッパー / 中継ぎ | closer / setup / middle reliever | `closer`, `setup`, `middle` | ブルペンの役割 |
| レバレッジ | leverage | `leverage` | ブルペン選択に使う局面の重要度 |
| 失策出塁 | reached on error | `roe`, `reachedOnError` | |
| 自責点 | earned run | `er` | 簡略規則: そのイニングの失策後の得点は非自責 |

## 5. ドメイン用語: 指標

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| 得点期待値表 | run expectancy table (RE24) | `RunExpectancyTable` | 24の塁・アウト状態からの期待得点 |
| 線形ウェイト | linear weights | `linearWeights` | ΔRE から求めた結果ごとの得点価値 |
| wOBA | weighted on-base average | `woba`, `WobaWeights`, `wobaScale` | シミュレーション自身のイベントから導出 |
| wRC+ | weighted runs created plus | `wrcPlus` | 100 = リーグ平均 |
| FIP | fielding independent pitching | `fip` | |
| WAR | wins above replacement | `war`, `battingWar`, `pitchingWar` | FanGraphs の構造。NPB のポジション調整 |
| ポジション調整 | positional adjustment | `POSITIONAL_ADJUSTMENT` | 1200イニングあたりの得点（DELTA）。出場内訳で按分 |
| 出場内訳 | appearances by slot | `appearances: Record<LineupSlot, number>` | 打順枠ごとの出場試合数 |
| パーセンタイル | percentile | `percentile` | 母集団内の 1〜100 の順位。Savant 風 |
| リーグ水準 | league level | `leagueLevel` | 較正に使うリーグ全体の率 |
| 較正 | calibration | `calibration` | シミュレーションの水準を NPB 目標に合わせること |
| 許容幅 | tolerance | `tolerance` | テストでシードごとに目標レンジを広げる幅 |
| 得点環境 | run environment | `RunEnvironment` | シーズン単位の RE24、ウェイト、アンカー |

## 6. ドメイン用語: スカウトと情報

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| スカウト | scout | `Scout` | 腕とバイアスを持つ球団職員 |
| 視察 | observation (scouting visit) | `observe`, `ScoutReport` | ノイズとバイアスを含む1回の観測 |
| 見抜きやすさ | visibility | `visibility` | その能力をどれだけ精密に観測できるか |
| バイアス | bias | `bias` | スカウトごとの持続的なずれ。縮まない |
| クロスチェック | cross-check | `crossCheck` | 1人の選手に複数のスカウト |
| 確信度 | confidence | `sigma`（濃淡で表示） | 不確実性の逆。視覚的に示し、数値では示さない |
| カルマンフィルタ | Kalman filter | `kalmanUpdate` | 推定の予測・更新の再帰 |
| 推定ビュー | ratings view | `RatingsView` | 球団の推定を返す関数。すべての意思決定の入力 |
| 情報の非対称性 | information asymmetry | — | 所有球団は真値を知り、他は推定を持つ |
| 期待値最大の指名 | expected-value bidding | `aiBid` | 獲得確率と価値を秤にかける AI のドラフト戦略 |

## 7. ビジネス・プロダクト用語

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| ゼネラルマネージャー（GM） | general manager (GM) | `gmClubId` | プレイヤーの役割 |
| AI 監督 | AI manager | `ai/manager` | 全球団の現場の判断 |
| AI 球団 | AI club | `isAi`, `ai/clubGm` | プレイヤーが操作しない球団 |
| 方針 | policy | `Policy` | GM の常設指示: 球数上限、エースの扱い、走塁 |
| 架空リーグ | fictional league | `generateGame` | 既定: 実在都市、架空の球団と選手 |
| 実名データ | real-name data | `importData` | ユーザーが用意。同梱しない |
| シーズン1 | Season 1 | — | 最初にプレイ可能なリリースの範囲 |
| 後続フェーズ | later phase | — | 契約、コーチ、二軍シミュレーション、打球層、デスクトップ |
| 説明可能性 | explainability | — | 表示されるすべての数字が仕組みまで辿れること |
| 較正目標 | calibration target | — | `product-requirements.md` 第7節の NPB 水準レンジ |
| 永続文書 / 作業文書 | permanent / work-unit document | `docs/`, `.steering/` | CLAUDE.md の分類 |

## 8. UI 用語

| 日本語 | 英語 | コード | 定義 |
|---|---|---|---|
| ダッシュボード | dashboard | `Dashboard` | 日の画面: 今日の試合、ニュース、順位の抜粋 |
| 選手ページ | player page | `PlayerPage` | 能力値（ビュー依存）、パーセンタイル、成績、健康 |
| ロスター画面 | roster screen | `Roster` | 一軍／二軍／支配下のタブ |
| スカウト画面 | scouting screen | `Scouting` | アマチュア一覧、割り当て、報告 |
| ドラフト画面 | draft screen | `Draft` | 入札、抽選、各巡 |
| 方針画面 | policy screen | `Policy` | 3つのダイヤルと上書き |
| 成績画面 | stats screen | `Stats` | リーダーと表 |
| セーブ / ロード | save / load | `SaveLoad` | スロット、書き出し、取り込み |
| 1日進める | advance one day | `advanceDay` | 主操作 |
| 次のイベントまで | advance to next event | `advanceToEvent` | 次の判断点で止まる |
| パーセンタイルバー | percentile bar | `PercentileBar` | Savant 風の横棒 |
| グレード表示 | grade cell | `GradeCell` | `55/70` の Present/Future |
| 濃淡 | visual weight | `confidenceClass` | 不確実性を表す不透明度や文字の太さ |
| 拒否（理由） | refusal | `Refusal` | ダイアログで示す規則に基づく却下 |
| ニュース | news | `news` | ロスター移動、故障、節目の日次フィード |

## 9. 英日対応表（簡約）

| 英語 | 日本語 | 英語 | 日本語 |
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

## 10. コード内の命名規則

1. 識別子にはこの用語集の**コード**列を使う。同義語を作らない（`team` と `club`、`demote` と `deactivate`、
   `minor` と `farm`）。
2. 能力値はプロトタイプのフィールド名（`meetVsR`、`powerVsL`、`hits`、`homeRuns`、`strikeouts`、`walks`）を保つ。
   英語の用語と異なる場合（`hits` = H/9 の抑止）でも、較正コードとテストがこれらを参照しているため。
3. 制度の定数は名前に NPB の用語を含める: `REREGISTRATION_DAYS`、`foreignActive`、`controlledMax`。
4. 統計の略語はコードでは小文字（`pa`、`hr`、`woba`）、UI 文言では大文字（PA、HR、wOBA）。
5. コード内の日本語はコメント、エラーメッセージ、`strings/` モジュールにのみ現れる。識別子は英語。
6. 新しい用語が必要になったら、まずここに追加し（英語、日本語、コード、定義）、それから使う。

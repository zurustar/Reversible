# Domain Entities — U1 Core

技術非依存のドメインエンティティ、関係、値の定義域(制約)。型は `src/domain/` に集約(U2 は型のみ参照)。

## 定数
| 定数 | 値 | 備考 |
|---|---|---|
| `SCHEMA_VERSION` | 1 | 保存フォーマット版数(FR-5.3) |
| `STEP_COUNT` | 16 | 1パターンのステップ数(FR-4.1) |
| `BPM_MIN` / `BPM_MAX` | 20 / 300 | テンポ範囲(US-02) |
| `BPM_DEFAULT` | 120 | 初期テンポ |
| `NOTE_MIN` / `NOTE_MAX` | 0 / 35 | 絶対半音インデックス(C2〜B4、3オクターブ) |
| `OCTAVE_BANDS` / `DEFAULT_OCTAVE_BAND` | 3 / 1 | 低=0 / 中=1 / 高=2。既定は中 |
| `DRUM_VOICE_IDS` | `['bd','sd','lt','mt','ht','rs','clap','cb','cy','ch','oh']` | 11音色(BD/SN/Low・Mid・Hi Tom/Rim/Clap/Cowbell/Cymbal/CH/OH)。順序=UI表示順 |

**bassline 音程モデル**: 入力は「1オクターブ12音(pitchClass 0..11 = C..B)+ ステップ単位のオクターブ帯(0/1/2)」。保存する `note` は絶対半音で `note = pitchClass + 12 * octaveBand`(範囲 0..35、実質3オクターブ)。UIではオクターブ帯を色で表現(低=青/中=橙/高=黄)。

## エンティティ

### Song(集約ルート)
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `schemaVersion` | number | `=== SCHEMA_VERSION`(=2)。v1 は読み込み時に移行(下記) |
| `name` | string | 1..64 文字(UI編集可) |
| `patterns` | Pattern[] | 1個以上 |
| `patternOrder` | string[] | ソングチェーン(パターンidの並び、繰り返し可)。ソングモードで順に再生(US-07 実装済み)。AppState に `songMode`/`songPos` を追加 |

### Pattern
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `id` | string | 一意(非空) |
| `length` | number | `=== STEP_COUNT`(MVP=16) |
| `bpm` | number | `[BPM_MIN, BPM_MAX]`、小数許容。範囲外はクランプ。**パターンごと**(ソングチェーンではパターン境界でテンポが変わる) |
| `swing` | number | `[0, 1]`。奇数16分音符を最大50%遅延。**パターンごと** |
| `bassline` | BasslineTrack[] | basslineトラックの配列(BASSLINE_COUNT=2)。各要素は下記 |
| `drums` | DrumTrack[] | ドラムマシンの配列(DRUM_MACHINE_COUNT=2, analog/digital)。各要素は下記 |
| `effects` | EffectsParams | マスターエフェクト設定。**パターンごと** |

#### 設定のスコープ(パターン単位 / 曲全体)
| スコープ | 設定 |
|---|---|
| **パターン単位** | `bpm`、`swing`、`effects`(Distortion / Delay / PCF / Compressor)、`BasslineParams`(waveform / Tune / Cutoff / Resonance / EnvMod / Decay / Accent / Drive / Slide / Volume)、`DrumVoiceParams`(Level / Tone / Decay / Tune / Snappy)、全ステップ |
| **曲全体** | `name`、`patternOrder`(ソングチェーン) |

#### スキーマ移行(v1 → v2)
v1 は `bpm` / `swing` / `effects` を Song 直下に持っていた。v2 ではこれらが Pattern に移動。
`validator.ts` が読み込み時に移行する: ルートの値を**全パターンへコピー**し(パターン側が
自前の値を持つ場合はそちらを優先)、ルートのフィールドは削除して `schemaVersion` を 2 にする。
`effects` はパターンごとに別オブジェクトとして生成する(1つを共有しない)。
これにより既存の保存データ(localStorage / エクスポート済み JSON)はそのまま読める。

#### 実装上の要点(パターン単位の設定を音に反映する)
楽器ノードとエフェクトチェーンは曲で**1組を共有**するため、パターン単位の設定は
「いま鳴っているパターン」の値を音声側へ適用しないと効かない。

- `applyPatternParams(target, pattern, when)` — bassline / ドラム / effects をまとめて適用。
  ライブ再生(Scheduler)と WAV 書き出し(offline-render)が同じ関数を共有し、同じ音になることを保証する。
  Scheduler は毎ステップ適用(値が変わらなければ no-op)。
- `when` 指定でスケジュールする。オフラインレンダリングは `currentTime` が進まないため、
  即時の `.value` 書き込みは曲全体に効いてしまう。
- **スケジュールできない API を避ける**:
  - `osc.type` は即時変更のみ → BasslineVoice は波形ごとのオシレータをゲインでクロスフェード。
  - `WaveShaper.curve` は即時変更のみ → Distortion は Amount ごとに shaper を持ち、ゲインで切り替える。
- `bpm` / `swing` は Scheduler がステップごとに、そのステップのパターンから読む
  (ソングチェーンではパターン境界でテンポが変わる)。offline-render も同様にステップ時刻を積算する。

### BasslineTrack
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `steps` | BasslineStep[] | `length === STEP_COUNT` |
| `params` | BasslineParams | 下記 |

### BasslineStep
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `on` | boolean | false = レスト(無音) |
| `note` | number | 整数 `[NOTE_MIN, NOTE_MAX]`(=0..35, 絶対半音 = pitchClass + 12*octaveBand)。`on=false` のとき無視(値は保持) |
| `accent` | boolean | アクセント(US-05) |
| `slide` | boolean | スライド/グライド(US-05) |

### BasslineParams(すべて 0..1 正規化、waveform を除く)
| フィールド | 型 | 定義域 |
|---|---|---|
| `waveform` | 'saw' \| 'square' | 列挙(FR-2.2) |
| `tune` | number | `[0,1]`(中央0.5=基準) |
| `cutoff` | number | `[0,1]` |
| `resonance` | number | `[0,1]` |
| `envMod` | number | `[0,1]` |
| `decay` | number | `[0,1]` |
| `accent` | number | `[0,1]`(アクセント強度) |
| `volume` | number | `[0,1]` |

### DrumTrack
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `voices` | Record<voiceId, DrumVoicePattern> | キーは `DRUM_VOICE_IDS` と一致 |

### DrumVoicePattern
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `steps` | DrumStep[] | `length === STEP_COUNT` |
| `params` | DrumVoiceParams | 下記 |

### DrumStep
| フィールド | 型 | 定義域/制約 |
|---|---|---|
| `on` | boolean | 発音するか |
| `accent` | boolean (任意) | ステップアクセント(省略時 false) |

### DrumVoiceParams(0..1 正規化)
| フィールド | 型 | 定義域 | 備考 |
|---|---|---|---|
| `level` | number | `[0,1]` | 音量(FR-3.3) |
| `tone` | number? | `[0,1]` | 音色依存(任意) |
| `decay` | number? | `[0,1]` | 減衰(任意) |
| `tune` | number? | `[0,1]` | ピッチ(任意) |

## アプリ実行時状態(非永続 / Store が保持)
| フィールド | 型 | 定義域 |
|---|---|---|
| `song` | Song | 上記(永続対象) |
| `playing` | boolean | 再生中か |
| `currentStep` | number | `[0, STEP_COUNT-1]`(表示用) |
| `selectedPatternId` | string | `song.patterns` のいずれかの id |

## 関係
```
Song 1 ── * Pattern
Pattern 1 ── 1 BasslineTrack ── 16 BasslineStep
Pattern 1 ── 1 DrumTrack ── (5 voices) ── 各 16 DrumStep
```

## ファクトリ(純粋)
- `createEmptySong(name?)`: パターン1個だけを持つ曲(name / patternOrder のみが曲スコープ)。
- `createEmptyPattern(id)`: 16ステップの空トラック群 + bpm=120 / swing=0 / デフォルトエフェクト。
- デフォルト `BasslineParams` / `DrumVoiceParams`: 中庸値(cutoff=0.5 等)。

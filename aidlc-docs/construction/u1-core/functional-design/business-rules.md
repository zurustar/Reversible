# Business Rules — U1 Core

検証・制約・状態遷移の規則と、テスト可能プロパティ。PBT(部分適用)では **PBT-03(不変条件)** が強制対象。ここで特定した不変条件は Code Generation で property-based test として実装する。

---

## 検証・制約ルール
| ID | ルール | 関連 |
|---|---|---|
| BR-01 | `bpm` は常に `[20,300]` にクランプされる(範囲外入力もクラッシュしない) | US-02 GWT-3 |
| BR-02 | `swing` は常に `[0,1]` にクランプ | US-06(将来) |
| BR-03 | 各トラックの `steps.length` は常に `STEP_COUNT(=16)`。編集で増減しない | FR-4.1 |
| BR-04 | `BasslineStep.note` は整数かつ `[0,35]` にクランプ(3オクターブ = pitchClass + 12*octaveBand) | Q2=A |
| BR-05 | 0..1 正規化パラメータ(bassline/ドラム)は `setParam` 後も常に `[0,1]` | US-09 |
| BR-06 | `waveform` は `'saw'|'square'` のみ受理 | FR-2.2 |
| BR-07 | `currentStep` は常に `[0,15]` | 表示整合 |
| BR-08 | `DrumTrack.voices` のキー集合は常に `DRUM_VOICE_IDS` と一致 | Q1=C |
| BR-09 | `on=false`(レスト)の bassline ステップは発音しない。note値は保持(復元用) | US-04 GWT-2 |
| BR-10 | ステップ操作の `index` は `[0,15]`。範囲外はno-op(例外を投げない) | フェイルセーフ |

## 状態遷移ルール
| ID | ルール |
|---|---|
| TR-01 | `play()` は `playing=false` のときのみ再生開始。`playing=true` では no-op(二重再生防止、US-01 GWT-3) |
| TR-02 | `stop()` で `playing=false` かつ `currentStep=0`。次回再生は先頭から(US-01 GWT-2) |
| TR-03 | 再生中の `setBpm` はループ停止を伴わず次スケジュールから反映(US-02 GWT-2) |
| TR-04 | `loadSong` は既存状態を置換し `currentStep=0`。事前に U3 Validator を通過したデータのみ受理(US-18) |
| TR-05 | すべての `dispatch` はイミュータブル更新(元state を破壊しない) |

## 発音ルール(スケジューラ)
| ID | ルール |
|---|---|
| PR-01 | 発音は必ず AudioContext 時刻 `when` で先行予約。UIタイマーで直接発音しない(NFR-1、JS-2) |
| PR-02 | 1ループ(16ステップ)で、あるトラックの発音回数 = そのトラックの `on` ステップ数(取りこぼし/重複なし) |
| PR-03 | `slide=true` のステップは**次のノートへスライド(タイ)**する。よって直前ステップが `slide=true` のノートがレガート(エンベロープ非再トリガ・前ピッチからグライド)になる。`accent=true` は一定量ブースト(U2で実装) |
| PR-04 | テンポ/スウィング変更は次に計算されるステップ時刻から反映(既にスケジュール済みの音は変えない) |

## テスト可能プロパティ(PBT-03 強制対象)
Code Generation で fast-check により実装する不変条件。

| ID | プロパティ | カテゴリ | 生成器(PBT-07) |
|---|---|---|---|
| P-01 | 任意の Action 列を適用後も、全トラックの `steps.length === 16` | Invariant(サイズ保存) | ランダムAction列(有効な index/voiceId/値) |
| P-02 | 任意の実数 `x` に対し `setBpm(x)` 後、`state.bpm ∈ [20,300]` | Invariant(範囲) | 実数(極値・NaN近傍含む) |
| P-03 | 任意の値に対し `setBasslineParam`/`setDrumParam` 後、正規化値 ∈ [0,1] | Invariant(範囲) | 実数(範囲外含む) |
| P-04 | 任意の整数/実数 `n` に対し `setBasslineStep({note:n})` 後、`note ∈ [0,35]` かつ整数 | Invariant(範囲) | 整数・実数 |
| P-05 | `toggleDrumStep` を同じ (voiceId,index) に2回適用すると元の `on` に戻る | Involution/不変 | voiceId∈集合, index∈[0,15] |
| P-06 | 静的パターン+固定BPMで1ループ回すと、各トラックの trigger 回数 = `on` ステップ数(PR-02) | Invariant(計数) | ランダムパターン(on/off) |
| P-07 | `voices` のキー集合は任意の Action 列後も `DRUM_VOICE_IDS` と一致(BR-08) | Invariant | ランダムAction列 |

- **注**: シリアライズのラウンドトリップ(PBT-02、FR-5.7)は U3(Serializer)の責務。U1 では上記の不変条件(PBT-03)を対象とする。
- P-06 はスケジューラをヘッドレスに(モックの AudioContext 時刻 + trigger スパイで)検証する(NFR-4)。

## エラーハンドリング(フェイルセーフ、SEC-15 の U1 該当分)
- 範囲外の index/パラメータは**クランプまたは no-op** とし、例外を投げてループやUIを壊さない。
- `loadSong` に渡るのは検証済みデータのみ(未検証データは U3 で弾く)。

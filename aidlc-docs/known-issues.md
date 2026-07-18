# Known Issues / 修正事項

## スライダーの効き(音質への影響)監査 — 2026-07-11(実測)

**方法**: オフライン合成(`node-web-audio-api`)で実際の音源をレンダリングし、FFTで
各スライダーの low→high の変化を実測。ツール: `tools/` 、実行 `npm run probe`
(WAV / 波形PNG / スペクトルPNG を `tools/out/` に出力、`tools/out/metrics.txt` に数値表)。

**総評**: 完全に無効(配線されていない)スライダーは無し。ただし以下の分類。

### ❌ 要修正A — 条件付きでしか効かない(単発では変化ゼロ)
| スライダー | 実測 | 内容 | 修正案 |
|---|---|---|---|
| bassline **Accent**(量) | アクセント無ステップ: **0.0%**(変化なし)/ アクセント有: 37.7% | ステップの A フラグが立った音にしか作用しない | UIで「アクセント量(要Aフラグ)」と明示、または非アクセント音にも僅かに反映 |
| bassline **Slide**(時間) | (定常解析では測定困難) | S フラグの音にしかグライドしない。単体では変化を感じない | UIで「スライド時間(要Sフラグ)」と明示 |

### ✅ 修正B — 効きが弱かったもの(2026-07-13 修正済み)
可聴幅を拡大し、`npm run probe` で再実測して改善を確認。
| スライダー | 修正前 | 修正後(適切な指標で再測) | 内容 |
|---|---|---|---|
| Snare **Tone** | 4.1%(centroid) | **+171%**(body pitch 151→409Hz) | Tone をボディ音程(150〜410Hz)+ノイズHP(800〜5300Hz)にワイドに割当 |
| Snare **Snappy** | 4.2%(centroid) | **-96%**(low/high energy比) | ボディ/ノイズのゲイン比を大きく(body 1.7→0.2 / noise 0.3→1.8) |
| Cymbal **Tone** | 8.7% | **+27%**(centroid) | ハイパス可変幅を 3k 幅→8.5k 幅に拡大 |

> 注: 当初 centroid で「弱い」と出たスネアは、明るいノイズが centroid を支配していたための**指標の誤り**。body pitch / low-high energy 比で測ると明確に効いていた(=可聴幅拡大で更に強化)。

### ✅ 実測で明確に効く(問題なし)
| スライダー | 実測 delta |
|---|---|
| bassline Cutoff | +191% (centroid) |
| bassline Resonance | +99% |
| bassline EnvMod | +706% |
| bassline Decay | +1987% (tail) |
| bassline Drive | +97% (centroid; スペクトル画像でも倍音増を確認) |
| bassline Volume | +400% (rms) |
| BD Tone(analog) | +1343%(※当初"弱い"と誤推測→実測で強い) |
| BD Decay | +212% (tail) |
| Tom Tune | +66% (pitch) |
| Cowbell Tune | +35% (pitch) |
| Cymbal Decay | +186% (tail) |
| Closed Hat Decay | +63% (tail) |
| Open Hat Decay | +112% (tail) |

## 対応方針
1. **A(条件付き)**: bassline Accent/Slide はUIで「フラグ前提」を明示 or 常時わずかに効くように。
2. **B(弱い)**: Snare Tone / Snappy / Cymbal Tone の可変幅を拡大(数値調整、低リスク)。修正後は `npm run probe` で再実測して delta を確認。
3. 以後、音に関わる変更は `npm run probe` の数値+画像で回帰確認する。

## 音の検証環境(新規)
- `tools/audio-lib.ts` — オフライン合成 + FFT解析 + WAV/PNG出力
- `tools/probe.test.ts` — 音程正当性の検証、全スライダーの効き実測、成果物出力
- `npm run probe` で実行。数値は `tools/out/metrics.txt`、画像は `tools/out/*.png`、試聴用WAVは `tools/out/*.wav`

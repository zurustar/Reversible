# Roadmap / Backlog — Reversible

MVP(bassline×1 + ドラム×1 + 16ステップ + JSON入出力 + 単一ファイル配布)は完了。
本ファイルは以降の拡張を1か所に集約した**やることリスト**。各項目は既存のストーリー/要件に紐づく。
進め方: 1項目ずつ「設計メモ→実装→テスト→docs同期」の小サイクルで対応する。

## ステータス凡例
- ☐ 未着手 / ◐ 進行中 / ☑ 完了

---

## 推奨順(依存と効果を考慮)

| # | 項目 | 紐づく | 影響ユニット | 規模 | 状態 |
|---|---|---|---|---|---|
| R1 | **スウィング/シャッフル** UI(グルーヴ) | US-06 | U1(Scheduler既に`swingOffset`実装済)+ UI | 小 | ☑ |
| R2 | **basslineフィルターの AudioWorklet 化**(音を濃く) | 設計の差し替え点、FR-2.3 | U2(`BasslineFilter`差し替え) | 中 | ☑ |
| R3 | **エフェクト**: Distortion / Delay / PCF / Compressor | FR-7, US-20 | U2(masterへ insert チェーン)+ UI | 中〜大 | ☑ |
| R4 | **2台目bassline**(ベースライン2本) | FR-2.6, US-13 | U1(モデル/複数トラック)+ U2 + UI | 中 | ☑ |
| R5 | **2台目ドラム(digital系)** / 音色拡張 | FR-3.4, US-12 | U2(digitalボイス)+ U1 + UI | 中 | ☑ |
| R6 | **パターンチェーン / ソングモード** | FR-4.1, US-07 | U1(`patternOrder`をScheduler解釈)+ UI | 大 | ☑ |
| R7 | **ハードウェア風リッチUI**(スキン刷新) | FR-6.2 | U3(UIのみ差し替え) | 大 | ☑(初版) |

### 順序の考え方
- **R1** は Scheduler に計算(`swingOffset`)が既にあり、UIを足すだけの**クイックウィン**。
- **R2** は自己完結で音質インパクト大(basslineの「濃さ」)。
- **R3** エフェクトは AudioEngine の master 経路に insert 点が設計済み。
- **R4/R5** 楽器増設は `Instrument` 抽象で拡張可能(設計済み)。モデル(複数bassline/複数ドラム)拡張を伴う。
- **R6** ソングは状態モデル・UI とも影響大なので後半。
- **R7** UI刷新は最後(機能が出そろってから)。UIは疎結合なので他ユニットに影響しない。

## 既知の課題
- スライダーの効き監査(効果が薄い/条件付きのもの)は [known-issues.md](known-issues.md) に記録。

## アイスボックス(将来検討・現状スコープ外)
- WAV等のオーディオ書き出し、MIDI入出力、DAW連携(現状 out of scope)。
- YAML等の追加保存フォーマット(FR-5、現状 JSON のみ)。
- キーボードショートカット、パターンのコピー/クリア等の操作性向上。

## 進捗ログ
- 2026-07-06: MVP完了・main へマージ(`c57ead6`)。本ロードマップ作成。
- 2026-07-07: R1〜R7 を自走実装(feature/enhancements)。R1 スウィング / R2 AudioWorklet basslineフィルタ / R3 エフェクト / R4 bassline×2 / R5 ドラムanalog+digital / R6 ソングモード / R7 リッチUI(初版)。各コミットでビルド+テスト(30件)+docs同期。**音と見た目の最終調整はユーザー確認待ち**。

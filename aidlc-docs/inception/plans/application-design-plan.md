# Application Design プラン(Reversible)

確定した要件([requirements.md](../requirements/requirements.md))とストーリー([stories.md](../user-stories/stories.md))に基づく、高レベルのコンポーネント/サービス設計の計画。
まず下部の **質問** に `[Answer]:` で回答してください。回答後に設計成果物を生成します。

---

## 設計スコープ
- 主要な機能コンポーネントとその責務の特定
- コンポーネントのインターフェース(メソッドシグネチャ。詳細ロジックは Functional Design)
- オーケストレーション用のサービス層
- コンポーネント依存関係と通信パターン
- 対象は MVP(bassline×1 + ドラム×1 + 16ステップ + 保存 + JSON入出力 + 機能UI)。将来拡張(bassline×2、analog+digital、ソング、エフェクト、モダンUI)を見据えた拡張点も明記。

## 生成する成果物(承認後に実施)
- [x] `components.md` — コンポーネント定義と高レベル責務・インターフェース
- [x] `component-methods.md` — メソッドシグネチャと入出力(ビジネスルール詳細は Functional Design)
- [x] `services.md` — サービス定義とオーケストレーション
- [x] `component-dependency.md` — 依存マトリクス・通信パターン・データフロー
- [x] `application-design.md` — 上記を統合したドキュメント
- [x] 設計の完全性・一貫性の検証

## 確定した設計判断
- Q1: **A** 層構成(UI / 状態・ドメイン / シーケンサー / オーディオエンジン / 永続化・入出力)
- Q2: **C** ハイブリッド合成(MVPは標準ノード、basslineフィルタは後でAudioWorkletに差し替え可能)
- Q3: **A** バニラTS + 小リアクティブストア
- Q4: **A** 中央ストア + Observer(購読)

## たたき台(提案アーキテクチャ)
UI とオーディオエンジンを疎結合にする層構成を提案(NFR-3):
```
UI 層(機能優先)         : コントロール表示・入力 → 中央ストアを購読/更新
  |  (状態の読み書き / イベント)
状態・ドメイン層          : 曲/パターンのデータモデル(バージョン付き)、中央ストア
  |
シーケンサー層            : look-aheadスケジューラ(オーディオクロック同期)→ 発音イベント
  |
オーディオエンジン層      : basslineボイス / ドラムボイス(合成)、マスター出力
永続化・入出力            : localStorage 保存/復元、JSONエクスポート/インポート+検証
```

---

# 質問(回答をお願いします)

## Question 1
全体のアーキテクチャ/モジュール構成はどうしますか?

A) 上記たたき台の層構成(UI / 状態・ドメイン / シーケンサー / オーディオエンジン / 永続化・入出力 を分離。UIとエンジンは疎結合) — 推奨

B) よりシンプルなフラット構成(まず1〜2モジュールで最短実装、あとで分割)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2
音声合成の実装方式は?(リアルタイム性と実装容易性のトレードオフ。最重要の技術判断)

A) AudioWorklet で自前DSP(サンプル単位で合成。最も低レイテンシでbasslineフィルターの質感を作り込みやすいが実装は重め)

B) Web Audio 標準ノード中心(OscillatorNode / BiquadFilter 等。実装が速く十分実用的だが、basslineフィルターの「濃さ」は標準ノードの範囲に依存)

C) ハイブリッド(MVPは標準ノードで素早く形にし、要所=特にbasslineフィルターを後で AudioWorklet に置き換え可能な設計にする) — 推奨

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 3
UI 層の実装方針は?(最終的な技術スタック確定は次の NFR Requirements で行いますが、コンポーネント設計に影響するため方向性を確認します)

A) バニラ TypeScript + 小さなリアクティブ・ストア(依存最小、MVP向き。将来モダンUIへ移行も可) — 推奨

B) UIフレームワーク採用(React / Svelte / Vue 等。将来のリッチUIを見据える)

C) この場では決めず NFR Requirements で確定する(設計は「UI層はストアを購読する」という抽象で進める)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 4
オーディオエンジンと UI/状態 の通信パターンは?

A) 中央ストア + Observer/購読(UIはストアを購読して描画、エンジンはストアのスナップショットを読む。疎結合・テスト容易) — 推奨

B) 直接メソッド呼び出し(UI→エンジンを直接叩く。単純だが結合が強い)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

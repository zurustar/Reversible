# User Stories 生成プラン(Reversible)

このプランは、確定した要件([requirements.md](../requirements/requirements.md))をユーザー中心のストーリーへ変換するための計画です。
まず下部の **質問** に `[Answer]:` タグで回答してください。回答後にストーリーとペルソナを生成します。

---

## 生成方針(メソドロジー)
- プロダクトオーナー視点で、要件をユーザー中心のストーリーに変換する
- 各ストーリーは **INVEST**(Independent / Negotiable / Valuable / Estimable / Small / Testable)を満たす
- 各ストーリーに **受け入れ基準(Acceptance Criteria)** を付与する
- ペルソナを定義し、ストーリーと対応付ける
- MVPスコープ(bassline×1 + ドラム×1 + 16ステップ + 保存 + JSON入出力 + 機能優先UI)と将来拡張を明確に区別する

## 実行チェックリスト(承認後に実施)
- [x] 回答の分析(曖昧点があればフォローアップ質問) — Q1空欄・Q2解釈を clarification で解消
- [x] `personas.md` を生成(ユーザー原型と特性)
- [x] `stories.md` を生成(INVEST準拠、受け入れ基準つき)
- [x] ストーリーとペルソナの対応付け
- [x] MVP / 将来拡張のタグ付け
- [x] セキュリティ(FR-5.6の検証)・PBT(FR-5.7のラウンドトリップ)観点を受け入れ基準に反映

## 確定した計画パラメータ
- 分割アプローチ: **C ハイブリッド**(Feature骨格 + 主要ジャーニー横断)
- ペルソナ: **2種**(宅録エレクトロニック制作者 / ライブ・ジャム志向パフォーマー)
- 受け入れ基準: **Given-When-Then**
- 粒度: **中**(1機能=1〜2ストーリー)
- 範囲: **MVP中心 + 将来拡張を「将来」タグで薄く**

## ストーリー分割アプローチ(選択肢)
- **A) User Journey ベース**: 起動→打ち込み→音作り→再生→保存→エクスポート/インポート、という一連の流れに沿って分割
- **B) Feature ベース**: 機能単位(basslineシンセ / ドラム / シーケンサー / 永続化 / 入出力 / UI)で分割
- **C) Persona ベース**: ユーザー種別ごとに分割
- **D) ハイブリッド(推奨)**: Feature ベースで骨格を作り、主要な User Journey を横断ストーリーとして併記

---

# 質問(回答をお願いします)

## Question 1
ストーリーの分割アプローチはどれにしますか?

A) User Journey ベース

B) Feature ベース

C) Persona ベース

D) ハイブリッド(Featureベース + 主要ジャーニー横断) — 推奨

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2
想定ユーザー(ペルソナ)はどう扱いますか?

A) 単一ペルソナ(音楽制作を楽しむ個人=あなた自身に近い像)。まずはシンプルに

B) 2種類程度(例: 初心者ビートメイカー / 経験者トラックメイカー)で操作性の幅を意識

C) ライブ演奏者も含めた複数ペルソナ(リアルタイム操作重視の視点も入れる)

X) Other (please describe after [Answer]: tag below)

[Answer]: アシッド系グルーヴボックスの想定ユーザ(エレクトロニック/ダンスミュージック制作者)に合わせる

## Question 3
受け入れ基準(Acceptance Criteria)の書式は?

A) Given-When-Then(BDD風。テストに落としやすい) — 推奨

B) チェックリスト形式(箇条書きの達成条件)

C) 両方併用(重要なストーリーはGWT、その他はチェックリスト)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
ストーリーの粒度(サイズ)はどれくらいにしますか?

A) 細かめ(1機能=複数の小さなストーリー。進捗が見えやすい)

B) 中くらい(1機能=1〜2ストーリー) — 推奨

C) 粗め(エピック中心。ざっくり全体像優先)

X) Other (please describe after [Answer]: tag below)

[Answer]: おまかせ

## Question 5
ストーリーの対象範囲は、今回どこまで含めますか?

A) MVPのみ(bassline×1 + ドラム×1 + 16ステップ + 保存 + JSON入出力 + 機能優先UI)に絞る

B) MVPを中心にしつつ、将来拡張(bassline×2、analog+digital、ソング、エフェクト、モダンUI)も「将来」タグ付きで薄く含める — 推奨

X) Other (please describe after [Answer]: tag below)

[Answer]: B

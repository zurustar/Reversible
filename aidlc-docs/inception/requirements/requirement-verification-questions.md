# 要件確認のための質問

オリジナルのアシッド・グルーヴボックス(Reversible)の要件を明確にするための質問です。各質問の `[Answer]:` タグの後に、選択肢の記号(A, B, C...)を記入してください。どの選択肢も合わない場合は最後の「Other」を選び、`[Answer]:` の後に内容を記述してください。すべて回答したら「完了」とお知らせください。

---

## Question 1
どのプラットフォーム/実行形態で作りますか?

A) Webブラウザ (Web Audio API / TypeScript) — インストール不要、URLですぐ動く。まず動くものを作るのに最適

B) ネイティブ・デスクトップアプリ (C++/JUCE や Rust など) — 低レイテンシ・高音質、スタンドアロン

C) DAW用プラグイン (VST3 / AU) — 既存の音楽制作環境に組み込む

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 2
最初のバージョン(MVP)に含める構成要素はどれですか?

A) フルセット: Basslineベースライン×2 + analog drum machine + digital drum machine + エフェクト(ディストーション/ディレイ/PCF/コンプ)

B) コアから: Basslineベースライン×1 + ドラムマシン×1(まず土台を作り、後から拡張)

C) ドラムマシンのみ(analog/digital)

D) ベースライン(bassline)のみ

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 3
音の生成方式はどうしますか?

A) リアルタイム・アナログモデリング合成 — オシレータ/フィルタをコードで実装。サンプル不使用の独自実装

B) サンプルベース — 録音済みのanalog/digitalサンプルを再生(ロイヤリティフリー素材を用意する必要あり)

C) ハイブリッド — basslineはモデリング合成、ドラムはサンプル

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 4
UI(見た目・操作感)の方向性は?

A) クラシックなハードウェア風UI(ノブ、LED、16ステップボタン)。グラフィックはすべてオリジナル素材

B) モダンでオリジナルなUI(独自デザイン)

C) 最小限・機能優先のUI(まず音のエンジンを固める)

X) Other (please describe after [Answer]: tag below)

[Answer]: まずはC。将来的にはBにしていく可能性あり。

## Question 5
知的財産(IP)の扱いについて。本プロジェクトの方針は?

A) すべて独自: 独自名称(Reversible)、独自の音源/グラフィック素材とし、いかなるメーカーの商標・著作物・素材も使わない — 最も安全で公開・配布可能

B) 個人利用・学習目的に限定(配布はしない前提)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 6
シーケンサー機能はどこまで作りますか?

A) クラシック相当: 16ステップのパターン、パターンをつなげてソング化、basslineのアクセント/スライド、シャッフル、ドラムのフラム等

B) まずは基本の16ステップパターンのみ(パターンチェーンや高度な機能は後回し)

X) Other (please describe after [Answer]: tag below)

[Answer]: A。作る工程で一時的にBを作った方が良いならまずはBでも良い。

## Question 7: セキュリティ拡張
このプロジェクトでセキュリティ拡張ルールを強制しますか?

A) はい — すべてのSECURITYルールをブロッキング制約として強制(本番品質のアプリに推奨)

B) いいえ — SECURITYルールをスキップ(PoC・プロトタイプ・実験的プロジェクトに適する)

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question 8: レジリエンシー拡張
レジリエンシー・ベースライン(AWS Well-Architected 信頼性の柱に基づく設計時ベストプラクティス)を適用しますか? ※クライアントサイドの音楽アプリでは関連が薄い場合があります。

A) はい — レジリエンシー・ベースラインを設計指針として適用(ビジネスクリティカルなワークロードに推奨)

B) いいえ — レジリエンシー・ベースラインをスキップ(PoC・プロトタイプ・迅速な反復を重視する実験的プロジェクトに適する)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question 9: プロパティベーステスト拡張
プロパティベーステスト(PBT)ルールを強制しますか?

A) はい — すべてのPBTルールをブロッキング制約として強制(ビジネスロジック、データ変換、シリアライズ、状態を持つコンポーネントがある場合に推奨)

B) 部分的 — 純粋関数とシリアライズのラウンドトリップのみPBTを適用

C) いいえ — PBTルールをスキップ(単純なCRUD、UIのみ、ロジックの薄い統合層に適する)

X) Other (please describe after [Answer]: tag below)

[Answer]: B

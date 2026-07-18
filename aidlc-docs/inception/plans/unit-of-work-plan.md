# Unit of Work プラン(Reversible)

Application Design([application-design.md](../application-design/application-design.md))に基づき、システムを構築ユニット(論理モジュール)へ分解する計画。
本プロジェクトは**クライアントのみの単一Webアプリ(モノリス)**のため、独立デプロイ単位ではなく「1パッケージ内の論理モジュール = 開発ユニット」として扱う。
まず下部の **質問** に `[Answer]:` で回答してください。回答後にユニット成果物を生成します。

---

## 生成する成果物(承認後に実施)
- [x] `unit-of-work.md` — ユニット定義・責務 + コード編成戦略(greenfield)
- [x] `unit-of-work-dependency.md` — ユニット依存マトリクス
- [x] `unit-of-work-story-map.md` — ストーリー↔ユニットの対応(全ストーリーを割当)
- [x] ユニット境界・依存の検証

## 確定した分解方針
- Q1: **A** 3ユニット(U1 Core / U2 Audio Engine / U3 IO+UI)
- Q2: **A** 構築順序 U1 Core → U2 Audio Engine → U3 IO+UI
- Q3: **A** 単一パッケージ(Vite)+ `src/` モジュール分割

## 前提(重要)
CONSTRUCTION は**ユニット単位**で「Functional Design → NFR → Code Generation」を回す。
- ユニット多め = 細かく管理できるが承認サイクル増
- ユニット少なめ = 最短だが1ユニットの粒度が大きくなる

## たたき台(Application Design からのユニット候補)
1. Sound Engine(C-04〜C-07: AudioEngine, Instrument, BasslineVoice, DrumMachine)
2. Sequencer & State(C-01〜C-03, S-01〜S-03: DomainModel, Store, Scheduler, 各サービス)
3. Persistence & IO(C-08〜C-11, S-04: Serializer, Validator, Persistence, ImportExport)
4. UI(C-12, S-05)

---

# 質問(回答をお願いします)

## Question 1
ユニットの分割数/まとめ方はどうしますか?

A) **3ユニット**: 「Core(Domain+State+Sequencer)」/「Audio Engine」/「IO + UI」— バランス型・推奨

B) **4ユニット**(設計提案どおり): Sound Engine / Sequencer+State / Persistence+IO / UI — 細かく管理、承認サイクル増

C) **1ユニット**(MVP全体を単一ユニット)— 最短。CONSTRUCTIONの設計/コード生成を1回で回す。承認回数最小

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2
(複数ユニットの場合)構築の順序はどうしますか? ※Q1でCを選んだ場合はこの質問は不要(空欄でOK)

A) Core(状態+タイミングの土台)→ Audio Engine → IO + UI — 推奨(データモデルとスケジューラを先に固める)

B) Audio Engine(まず音が鳴る)→ Core → IO + UI — 早く音を確認したい志向

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 3
コード編成(greenfield)。ディレクトリ構造の方針は?

A) 単一パッケージ(Vite想定)+ `src/` 配下をモジュール分割: `domain/ state/ sequencer/ audio/ io/ ui/`(+ `tests/`)— 推奨

B) その他(具体的な構造を記述)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

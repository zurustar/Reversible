# Functional Design プラン — U1 Core

対象ユニット: **U1 Core**(C-01 DomainModel、C-02 Store、C-03 Scheduler、S-01 Transport、S-02 SoundDesign、S-03 PatternEdit)。
割当ストーリー: US-01/02/03/04/05(+ 将来 US-06/07)。詳細は [unit-of-work.md](../../inception/application-design/unit-of-work.md) / [stories.md](../../inception/user-stories/stories.md)。
まず下部の **質問** に `[Answer]:` で回答してください。回答後に詳細設計を生成します。

---

## 設計スコープ(技術非依存のビジネスロジック)
- ドメインエンティティの確定(Song/Pattern/Track/Step/Params の値と制約)
- ストアのリデューサ規則(Action → 状態遷移)とビジネスルール
- look-ahead スケジューラのタイミング・アルゴリズム(BPM/スウィング → ステップ発音時刻)
- 再生制御・打ち込み・音作り反映のルール
- テスト可能プロパティの特定(PBT-03 不変条件は強制対象。PBT-01の特定自体は助言的)

## 生成する成果物(承認後に実施)
- [x] `business-logic-model.md` — スケジューラ/ストア/サービスのロジックとデータフロー
- [x] `business-rules.md` — 検証・制約・遷移規則、テスト可能プロパティ(PBT-03)
- [x] `domain-entities.md` — エンティティ・関係・値の定義域

## 確定した設計判断
- Q1: **C** 最小5音色(bd / sd / ch / oh / clap)
- Q2: **A** 半音整数の音程モデル(約2〜3オクターブ、レスト= on=false)
- Q3: **A** BPM 20〜300、初期 120(範囲外クランプ)
- Q4: **A** スケジューラ 25ms間隔 / 0.1秒先読み / 1ステップ=16分音符(定数として調整可能)
- Q5: **A** 固定挙動(スライド=固定グライド、アクセント=一定量の音量+フィルタ強調)

---

# 質問(回答をお願いします)

## Question 1
MVPのドラムマシンのベースと音色セットは?(U1のドメイン=voiceId集合、U2の合成に影響)

A) analogスタイル: Bass Drum / Snare / Low Tom / Mid Tom / Hi Tom / Rim / Clap / Closed Hat / Open Hat / Cymbal(定番の広めセット)

B) digitalスタイル: Bass Drum / Snare / Low Tom / Mid Tom / Hi Tom / Rim / Clap / Closed Hat / Open Hat / Crash / Ride

C) まず最小: Bass Drum / Snare / Closed Hat / Open Hat / Clap(5音色で土台。後で追加) — 推奨

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 2
basslineベースラインの音域と音程表現は?

A) 半音整数で管理し、UIは約2〜3オクターブ(例: C1〜C3相当)。レストはステップの on=false — 推奨

B) もっと広い音域(例: 4オクターブ以上)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 3
BPM(テンポ)の範囲と初期値は?

A) 範囲 20〜300 BPM、初期値 120 BPM(範囲外は自動クランプ) — 推奨

B) 別の範囲/初期値を指定

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 4
シーケンサーの look-ahead スケジューリングのパラメータは?(Web Audio 定番方式)

A) 定番の既定値: スケジューラ起動間隔 25ms、先読みウィンドウ 0.1秒(100ms)。1ステップ=16分音符。※これらは調整可能な定数として実装 — 推奨

B) 別の値を指定

X) Other (please describe after [Answer]: tag below)

[Answer]: 

## Question 5
basslineのスライド(グライド)/アクセントの挙動は?

A) シンプル・固定: スライドは固定時間のグライド(レガート)、アクセントは音量+フィルタ強調を一定量。まずは固定挙動を優先 — 推奨

B) 調整可能: スライド時間やアクセント量をパラメータ化(GUIで可変)

X) Other (please describe after [Answer]: tag below)

[Answer]: 

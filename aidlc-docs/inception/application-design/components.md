# Components — Reversible

高レベルのコンポーネント定義と責務・インターフェース。詳細なビジネスルールは Functional Design(CONSTRUCTION)で定義する。
アーキテクチャは層構成(UIとオーディオエンジンを疎結合)。合成はハイブリッド(MVPは標準ノード、basslineフィルタは後でAudioWorkletに差し替え可能)。

## 層構成の概要
```
UI 層              : 表示と入力。中央ストアを購読し、アクションを dispatch
状態・ドメイン層    : Song データモデル(バージョン付き)+ 中央ストア(単一の真実源)
サービス層          : ユースケースのオーケストレーション(再生/保存/入出力)
シーケンサー層      : look-ahead スケジューラ(オーディオクロック同期)
オーディオエンジン層 : Instrument 実装(bassline/ドラム)+ マスター出力
永続化・入出力層    : localStorage、JSONシリアライズ、検証
```

---

## 状態・ドメイン層

### C-01: DomainModel(データモデル)
- **目的**: 曲・パターン・トラック・ステップ・各デバイスのパラメータを表す、シリアライズ可能なプレーンデータ型群。
- **責務**:
  - `Song`(バージョン付きスキーマ、BPM、swing、パターン集合、将来のパターン順)を定義
  - `Pattern` / `BasslineTrack` / `DrumTrack` / 各 `Step` / 各 `*Params` を定義
  - ファクトリ(空の曲/パターン生成)と定数(ステップ数=16 等)
- **インターフェース**: 型定義 + 純粋なファクトリ関数(副作用なし)。
- **関連**: FR-2〜5、US-03〜05、US-08〜11、US-14〜17

### C-02: Store(中央リアクティブストア)
- **目的**: アプリの単一の真実源。ドメイン状態 + トランスポート状態 + 選択状態を保持し、購読者へ変更を通知(Observer)。
- **責務**:
  - 現在の `Song`、再生状態(playing/stopped、現在ステップ)、選択中パターン/トラックを保持
  - `getState()` によるスナップショット提供(シーケンサー/エンジンが読む)
  - `dispatch(action)` による更新と購読通知(UIが購読)
  - 変更のたびに永続化フック(自動保存)を発火(サービス経由)
- **インターフェース**: `getState`, `dispatch`, `subscribe`(下記 component-methods.md)。
- **関連**: NFR-3(疎結合)、Q4=A

---

## シーケンサー層

### C-03: Scheduler(look-ahead スケジューラ)
- **目的**: オーディオクロックに同期して、先読み(look-ahead)で発音イベントをスケジュールする。UIタイマーに依存しない安定タイミング(NFR-1、FR-4.5)。
- **責務**:
  - `AudioContext.currentTime` を基準に、一定間隔で「次の区間に鳴るステップ」を先行スケジュール
  - BPM/スウィングからステップの発音時刻を算出
  - 各ステップで、そのステップにオンのトラック/ボイスの `trigger` を予約
  - 現在ステップを Store に反映(UIのステップ表示用)
- **インターフェース**: `start`, `stop`, `setTempo`, `setSwing`(内部で `requestScheduling` ループ)。
- **関連**: FR-4.1/4.3/4.5、US-01/02/06、JS-2

---

## オーディオエンジン層

### C-04: AudioEngine(エンジン・ファサード)
- **目的**: `AudioContext` とマスター出力を管理し、Instrument 群を保持する窓口。
- **責務**:
  - `AudioContext` の生成/再開(ユーザー操作でresume)、マスターゲイン、出力接続
  - Instrument の登録・取得(bassline、ドラム)。将来の追加(2台目bassline、analog+digital、エフェクト挿入)を許容
  - 初期化失敗時のフェイルセーフ(SEC-15)
- **インターフェース**: `init`, `resume`, `getInstrument`, `addInstrument`, `masterOut`。
- **関連**: FR-1.2、FR-2/3、FR-7(将来)、SEC-15

### C-05: Instrument(共通インターフェース)
- **目的**: 音源の共通契約。シーケンサーは具体音源を知らずに `trigger` できる(プラガブル)。
- **責務**: `trigger(event, when)` で指定時刻に発音、`setParam` でパラメータ更新、`connect(destination)`。
- **インターフェース**: 抽象(下記)。実装は C-06 / C-07。
- **関連**: NFR-3、将来拡張(FR-2.6/3.4/7)

### C-06: BasslineVoice(basslineスタイル・ベースライン音源)
- **目的**: モノフォニックな basslineスタイル・シンセ。saw/square → レゾナントLPF → アンプエンベロープ。アクセント/スライド対応。
- **責務**:
  - 波形選択、Tune、Cutoff/Resonance/EnvMod/Decay/Accent、Volume の反映(FR-2.2〜2.5)
  - スライド(グライド/レガート)とアクセント(音量+フィルタ強調)の発音処理
  - フィルタ段は `BasslineFilter` として抽象化(Q2=C)。**実装2種**: `BiquadBasslineFilter`(標準ノード)と `WorkletBasslineFilter`(AudioWorkletのMoog風4ポール・ラダー、`bassline-worklet.ts`)。起動時にワークレットを優先し、読み込み失敗時は Biquad に自動フォールバック(SEC-15)。ワークレットは Blob URL 経由で読むため単一ファイル(file://)でも動作
- **インターフェース**: `Instrument` を実装。
- **関連**: FR-2、US-04/05/08/09/10、US-13(将来)

### C-07: DrumMachine(ドラム音源集合) / DrumVoice(個別音色)
- **目的**: 合成ドラム音の集合(例: BassDrum, Snare, ClosedHat, OpenHat, Clap, Tom, Cymbal 等。MVPの音色セットは Functional Design で確定)。
- **責務**:
  - 各 `DrumVoice` が自前の合成(オシレータ+ノイズ+エンベロープ)で発音
  - 音色ごとのパラメータ(Level、Tone/Decay/Tune 等)反映(FR-3.3)
  - `DrumMachine` は voiceId → DrumVoice を束ね、`trigger(voiceId, when, opts)` を提供
- **インターフェース**: `DrumMachine` は `Instrument` を実装(voiceId 指定で発音)。
- **関連**: FR-3、US-03/11、US-12(将来)

---

## 永続化・入出力層

### C-08: SongSerializer(シリアライズ)
- **目的**: `Song` ⇄ プレーンJSONオブジェクトの相互変換(バージョン付き)。
- **責務**: `serialize(song) -> object`、`deserialize(object) -> Song`。ラウンドトリップ同一性を保証(FR-5.2/5.7、PBT-02)。
- **関連**: FR-5.2/5.3/5.7、US-14/15/16、PBT-02

### C-09: SongValidator(検証/安全な取り込み)
- **目的**: 信頼できない外部JSONを安全に取り込むための検証。
- **責務**:
  - JSON文字列のパース(例外を捕捉、SEC-15)
  - スキーマ/型検証(SEC-05)、非対応バージョンの検知と可能なら移行
  - 安全なデシリアライズ(データとしてのみ扱う、SEC-13)。失敗時は明示的な検証エラーを返す(例外を投げっぱなしにしない)
- **インターフェース**: `parseAndValidate(text) -> Result<Song, ValidationError>`。
- **関連**: FR-5.6、US-18、SEC-05/13/15

### C-10: PersistenceService(ブラウザ保存)
- **目的**: localStorage への保存と復元。
- **責務**: `save(song)`、`load() -> Song | null`、`clear()`。Serializer を利用。読み込み時は Validator を通す。
- **関連**: FR-5.1/5.2、US-14

### C-11: ImportExportManager(JSON入出力)
- **目的**: 曲データのダウンロード(エクスポート)とコピペ/ファイルからの取り込み(インポート)。
- **責務**:
  - `exportToJsonBlob(song) -> {filename, blob}` とブラウザダウンロードのトリガ(サーバ非経由、FR-5.4)
  - `importFromText(text)` / `importFromFile(file)` → Validator 経由で `Song` を復元(FR-5.5)
  - コピペ経路(必須)とファイル経路(任意)で同一結果(US-16/17)
- **関連**: FR-5.4〜5.7、US-15/16/17/18

---

## UI 層(機能優先)

### C-12: UI Views(機能優先ビュー群)
- **目的**: コントロールの表示と入力。中央ストアを購読して描画、操作を dispatch。
- **構成(MVP)** — 実装は「楽器ごとに 音色コントロール(上)+ その楽器のシーケンサー(下)」を1カードにまとめる:
  - `TransportView`(再生/停止、BPM、曲名) — US-01/02(`src/ui/transport-view.ts`)
  - `BasslineSection`(basslineの音色: 波形/Tune/Cutoff/Reso/EnvMod/Decay/Accent/Volume + **ピアノロール**: pitchClass×16、オクターブ帯を色分け、Oct/Accent/Slide 行) — US-04/05/08/09/10(`src/ui/bassline-section.ts`)
  - `DrumSection`(各音色の Level + 5音色×16ステップのグリッド) — US-03/11(`src/ui/drum-section.ts`)
  - `IoView`(エクスポート、コピペ/ファイルのインポート、検証エラー表示) — US-15/16/17/18(`src/ui/io-view.ts`)
- **責務**: 状態のずれを起こさない(ストア購読で単方向)。低遅延な反映(NFR-1、US-19)。
- **関連**: FR-6.1、US-01〜05/08〜11/15〜19。モダンUI(FR-6.2)は将来差し替え(UIは疎結合なので可能)。
- **備考**: 当初案の `StepGridView`/`BasslinePanelView`/`DrumPanelView` は、レイアウト方針(楽器ごとに音色+シーケンサーをペア化)に合わせて `BasslineSection`/`DrumSection` に統合済み。

---

## 将来拡張ポイント(設計上の余地)
- **2台目bassline / analog+digital**: `Instrument` を追加登録するだけで拡張可能(C-04/C-05)。
- **ソング/パターンチェーン**: `Song.patternOrder` を Scheduler が解釈(C-03)。
- **エフェクト**: AudioEngine のマスター経路に insert チェーンを追加(C-04)。
- **モダンUI**: UI層のみ差し替え(状態・ドメイン層は不変)。
- **AudioWorklet 化**: `BasslineFilter`(および将来はボイス全体)を Worklet 実装に差し替え(C-06)。

# Component Methods — Reversible

各コンポーネントのメソッドシグネチャ(TypeScript風)と入出力・目的。**詳細なビジネスルール/アルゴリズムは Functional Design(CONSTRUCTION)で定義**する。ここでは契約(インターフェース)を確定させる。

---

## 共通型(ドメイン, C-01 DomainModel)
```ts
type Waveform = 'saw' | 'square';

// スキーマ版数(バージョン付き; FR-5.3)
const SCHEMA_VERSION = 1;

interface BasslineStep {
  on: boolean;        // 発音するか(レストは on=false)
  note: number;       // 半音(例: 0=C, 12=+1oct)。on=false のとき無視
  accent: boolean;    // アクセント(FR-2.5, US-05)
  slide: boolean;     // スライド/グライド(FR-2.5, US-05)
}

interface BasslineParams {
  waveform: Waveform; // FR-2.2
  tune: number;       // FR-2.4
  cutoff: number;     // 0..1 正規化(FR-2.3)
  resonance: number;  // 0..1
  envMod: number;     // 0..1
  decay: number;      // 0..1
  accent: number;     // 0..1 アクセント量
  volume: number;     // 0..1
}

interface DrumVoiceParams {
  level: number;      // 0..1 音量(FR-3.3)
  tone?: number;      // 0..1(音色依存)
  decay?: number;     // 0..1
  tune?: number;      // 0..1
}

interface DrumStep { on: boolean; accent?: boolean; }

interface BasslineTrack { steps: BasslineStep[]; params: BasslineParams; } // steps.length === 16
interface DrumTrack { voices: Record<string, { steps: DrumStep[]; params: DrumVoiceParams }>; }

interface Pattern {
  id: string;
  length: number;     // MVP=16
  bassline: BasslineTrack;
  drums: DrumTrack;
}

interface Song {
  schemaVersion: number;   // === SCHEMA_VERSION
  name: string;
  bpm: number;             // FR-4.3
  swing: number;           // 0..1(将来: US-06)
  patterns: Pattern[];
  patternOrder: string[];  // 将来のソング(US-07)。MVPは単一/先頭
}

// ファクトリ(純粋・副作用なし)
function createEmptySong(name?: string): Song;
function createEmptyPattern(id: string): Pattern;
const STEP_COUNT = 16;
```

---

## C-02: Store
```ts
type Action =
  | { type: 'toggleDrumStep'; voiceId: string; index: number }
  | { type: 'setBasslineStep'; index: number; step: Partial<BasslineStep> }
  | { type: 'setBasslineParam'; key: keyof BasslineParams; value: number | Waveform }
  | { type: 'setDrumParam'; voiceId: string; key: keyof DrumVoiceParams; value: number }
  | { type: 'setBpm'; bpm: number }
  | { type: 'setSwing'; swing: number }
  | { type: 'transport'; playing: boolean }
  | { type: 'setCurrentStep'; index: number }
  | { type: 'loadSong'; song: Song }
  | { type: 'selectPattern'; id: string };

interface AppState {
  song: Song;
  playing: boolean;
  currentStep: number;
  selectedPatternId: string;
}

interface Store {
  getState(): Readonly<AppState>;              // スナップショット(Scheduler/Engineが読む)
  dispatch(action: Action): void;              // 状態更新 + 購読通知 + 自動保存フック
  subscribe(listener: (s: Readonly<AppState>) => void): () => void; // 解除関数を返す
}
```

## C-03: Scheduler
```ts
interface Scheduler {
  start(): void;                 // look-ahead ループ開始(FR-4.3)
  stop(): void;                  // 停止(次回は先頭から, US-01)
  setTempo(bpm: number): void;   // 再生中も滑らかに(US-02)
  setSwing(swing: number): void; // 将来(US-06)
}
// 内部: currentTime基準でステップ発音時刻を算出し、オンのトラック/ボイスの trigger を予約。
// 現在ステップを store.dispatch({type:'setCurrentStep'}) で反映。
```

## C-04: AudioEngine
```ts
interface AudioEngine {
  init(): Promise<void>;                       // AudioContext生成; 失敗時フェイルセーフ(SEC-15)
  resume(): Promise<void>;                     // ユーザー操作で resume
  getInstrument(id: string): Instrument | undefined;
  addInstrument(id: string, inst: Instrument): void;  // 将来拡張(2nd bassline / analog+digital)
  readonly masterOut: AudioNode;               // 将来: ここに insert エフェクト(FR-7)
  readonly context: BaseAudioContext;
}
```

## C-05: Instrument(共通契約)
```ts
interface TriggerEvent {
  // bassline: note/accent/slide を含む; ドラム: voiceId/accent を含む
  note?: number;
  accent?: boolean;
  slide?: boolean;
  voiceId?: string;
}

interface Instrument {
  trigger(event: TriggerEvent, when: number): void; // when = AudioContext時刻(先行予約)
  setParam(key: string, value: number | string): void;
  connect(destination: AudioNode): void;
}
```

## C-06: BasslineVoice implements Instrument
```ts
interface BasslineVoice extends Instrument {
  setParam(key: keyof BasslineParams, value: number | Waveform): void;
  // trigger: note/accent/slide に応じて osc→filter→amp を発音。slide 時は前音からグライド。
}
// フィルタ段は差し替え可能に抽象化(Q2=C):
interface BasslineFilter {
  readonly input: AudioNode;
  readonly output: AudioNode;
  setCutoff(v: number): void;      // 0..1
  setResonance(v: number): void;   // 0..1
}
// MVP: BiquadFilterベース実装 / 将来: AudioWorkletベース実装(同一インターフェース)
```

## C-07: DrumMachine implements Instrument / DrumVoice
```ts
interface DrumVoice {
  trigger(when: number, opts?: { accent?: boolean }): void;
  setParam(key: keyof DrumVoiceParams, value: number): void;
  connect(destination: AudioNode): void;
}
interface DrumMachine extends Instrument {
  // trigger({voiceId}, when) で該当 DrumVoice を発音
  getVoiceIds(): string[];
  setVoiceParam(voiceId: string, key: keyof DrumVoiceParams, value: number): void;
}
```

## C-08: SongSerializer
```ts
interface SongSerializer {
  serialize(song: Song): object;      // プレーンオブジェクト(JSON.stringify対象)
  deserialize(data: object): Song;    // 逆変換。deserialize(serialize(x)) === x (PBT-02)
}
```

## C-09: SongValidator
```ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
interface ValidationError { code: string; message: string; path?: string; }

interface SongValidator {
  parseAndValidate(text: string): Result<Song, ValidationError>;
  // 1) JSON.parse を try/catch(SEC-15) 2) 型/スキーマ検証(SEC-05)
  // 3) schemaVersion 検査・必要なら移行 4) 安全にデータのみ復元(SEC-13)
}
```

## C-10: PersistenceService
```ts
interface PersistenceService {
  save(song: Song): void;             // localStorage へ(Serializer利用)
  load(): Song | null;                // 復元(Validator経由; 破損時は null + ログ)
  clear(): void;
}
```

## C-11: ImportExportManager
```ts
interface ExportResult { filename: string; blob: Blob; }
interface ImportExportManager {
  exportToJson(song: Song): ExportResult;      // song.json 相当(FR-5.4)
  downloadExport(song: Song): void;            // ブラウザダウンロード起動(サーバ非経由)
  importFromText(text: string): Result<Song, ValidationError>;   // 必須(US-16)
  importFromFile(file: File): Promise<Result<Song, ValidationError>>; // 任意(US-17)
}
```

## C-12: UI Views(代表シグネチャ)
```ts
interface View {
  mount(root: HTMLElement): void;
  // 各Viewは store.subscribe で再描画、入力で store.dispatch(action)
  dispose(): void;                    // subscribe解除(リーク防止)
}
// 例: TransportView, StepGridView, BasslinePanelView, DrumPanelView, ImportExportView
```

---

## 備考
- 0..1 正規化パラメータ → 実周波数/時間 への変換は純粋関数として実装し、範囲不変(定義域内)を PBT-03 で検証(US-09 GWT-3)。
- `trigger` の `when` は必ず `AudioContext` 時刻での先行予約とし、UIスレッドのタイマーで発音しない(NFR-1, JS-2)。

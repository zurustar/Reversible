# Business Logic Model — U1 Core

技術非依存のロジック設計。スケジューラのタイミング、ストアの状態遷移、サービスのオーケストレーション、データフロー。

---

## 1. Store(中央リアクティブストア)
- **モデル**: `AppState { song, playing, currentStep, selectedPatternId }`。単一の真実源。
- **更新**: `dispatch(action)` は純粋なリデューサで新状態を算出 → 変更時に購読者へ通知 → 自動保存フック発火(U3 Persistence へ)。
- **購読**: `subscribe(listener)` は現在状態を渡し、解除関数を返す。
- **リデューサの原則**: 不変(イミュータブル)更新。ステップ数・定義域は常に維持(§ business-rules)。

### Action → 状態遷移(要約)
| Action | 遷移 | 検証/クランプ |
|---|---|---|
| `toggleDrumStep{voiceId,index}` | 該当 DrumStep.on を反転 | index∈[0,15], voiceId∈DRUM_VOICE_IDS |
| `setBasslineStep{index,step}` | 該当 BasslineStep を部分更新 | index∈[0,15], note∈[0,24](クランプ) |
| `setBasslineParam{key,value}` | params[key] 更新 | 数値は[0,1]クランプ / waveformは列挙 |
| `setDrumParam{voiceId,key,value}` | voice.params[key] 更新 | [0,1]クランプ |
| `setBpm{bpm}` | song.bpm 更新 | [20,300]クランプ |
| `setSwing{swing}` | song.swing 更新 | [0,1]クランプ |
| `transport{playing}` | playing 更新 | — |
| `setCurrentStep{index}` | currentStep 更新(表示用) | [0,15] |
| `loadSong{song}` | song 差し替え、currentStep=0 | 事前に検証済み(U3 Validator) |
| `selectPattern{id}` | selectedPatternId 更新 | id 実在 |

---

## 2. Scheduler(look-ahead、AudioクロックベースのタイミングロジックFR-4.5)

### 定数(調整可能)
- `LOOKAHEAD_MS = 25`(スケジューラ起動間隔)
- `SCHEDULE_AHEAD_SEC = 0.1`(先読みウィンドウ)
- 1ステップ = 16分音符

### 時間計算(純粋関数)
```
sixteenthSec(bpm) = 60 / bpm / 4            // 16分音符の長さ(秒)
stepDuration = sixteenthSec(bpm)
// スウィング(将来 US-06): 奇数インデックスのステップを遅らせる
swingOffset(index, bpm, swing) =
    (index が奇数) ? stepDuration * swing * SWING_MAX_RATIO : 0
    // MVPは swing=0 のため offset=0。SWING_MAX_RATIO は定数(例 0.5)
```

### スケジューリング・ループ(概念)
```
start():
  nextNoteTime = audioContext.currentTime
  currentStepIndex = 0
  timer = setInterval(scheduler, LOOKAHEAD_MS)

scheduler():                       // 25msごと
  snapshot = store.getState()
  bpm = snapshot.song.bpm
  while nextNoteTime < audioContext.currentTime + SCHEDULE_AHEAD_SEC:
      scheduleStep(currentStepIndex, nextNoteTime, snapshot)
      enqueueForDisplay(currentStepIndex, nextNoteTime)   // UI表示用キュー
      nextNoteTime += stepDuration(bpm) + swingOffset(...)
      currentStepIndex = (currentStepIndex + 1) mod STEP_COUNT

stop():
  clearInterval(timer)
  store.dispatch(setCurrentStep 0)
```

### scheduleStep(index, when, snapshot)
```
pattern = 現在の選択パターン(snapshot)
// bassline
bstep = pattern.bassline.steps[index]
if bstep.on:
    engine.getInstrument('bassline').trigger(
        { note: bstep.note, accent: bstep.accent, slide: bstep.slide }, when)
// ドラム(5音色)
for voiceId in DRUM_VOICE_IDS:
    ds = pattern.drums.voices[voiceId].steps[index]
    if ds.on:
        engine.getInstrument('drums').trigger(
            { voiceId, accent: ds.accent ?? false }, when)
```
- **重要**: 発音は必ず `when`(AudioContext時刻)で**先行予約**。UIスレッドのタイマーで直接発音しない(NFR-1、JS-2)。
- **テンポ変更中**: 各ループで `bpm` を再読込するため、再生を止めずに追従(US-02 GWT-2)。

### 表示同期(currentStep)
- `enqueueForDisplay` で `{index, time}` を貯め、`requestAnimationFrame` ループが `audioContext.currentTime` を見て、到達済みの最新 index を `store.dispatch(setCurrentStep)` する。これにより音とUIが分離しつつ視覚的に同期(NFR-1)。

---

## 3. サービス(オーケストレーション)

### S-01 TransportService
```
play():  await engine.resume(); scheduler.start(); dispatch(transport true)
stop():  scheduler.stop(); dispatch(transport false)   // currentStep=0 は scheduler.stop 内
setBpm(v): dispatch(setBpm v)   // クランプはリデューサ側。scheduler は次ループで反映
setSwing(v): dispatch(setSwing v)
```
- 二重再生防止: `play()` は `playing===true` のとき no-op(US-01 GWT-3)。

### S-02 SoundDesignService(リアルタイム反映、US-09/NFR-1)
```
setBasslineParam(key,value): dispatch(setBasslineParam) ; engine.getInstrument('bassline').setParam(key, value)
setDrumParam(voiceId,key,value): dispatch(setDrumParam) ; engine.getInstrument('drums').setVoiceParam(voiceId,key,value)
```
- 再生を止めずに反映。パラメータ 0..1 → 実値の変換は U2 側(範囲不変は PBT-03、§ business-rules)。

### S-03 PatternEditService(US-03/04/05)
```
toggleDrumStep(voiceId,index): dispatch(toggleDrumStep)
setBasslineStep(index,partial): dispatch(setBasslineStep)   // note/accent/slide/on
```

---

## 4. データフロー(U1内)
```
UI 操作
  -> Service(Transport/SoundDesign/PatternEdit)
      -> Store.dispatch(action)   // 純粋リデューサ + クランプ
          -> 購読UI再描画(単方向)
          -> 自動保存フック(U3)
Scheduler(25msループ)
  -> Store.getState()(スナップショット読取)
  -> Instrument.trigger(event, when)(U2、AudioContext時刻で先行予約)
  -> rAF で currentStep を Store に反映(表示用)
```

## 5. スライド/アクセントの機能ルール(固定挙動、Q5=A)
- **スライド**: `step.slide === true` のとき、当該ステップは前の発音から**ピッチを固定時間でグライド**して繋ぐ(グライド時間 ~55ms、U2実装)。音量エンベロープは**必ず発音する**(スライドでも無音にしない)が、ゼロからの再アタック(クリック)を避けてレガートに繋ぐ(ピーク付近から開始→減衰)。フィルターエンベロープはスライド時は再トリガしない(うねりを滑らかに保つ)。
  - 注: 旧仕様は「エンベロープ再トリガなし」だったが、これだと前音が減衰済みのときスライド音が無音になる不具合があったため、上記に修正(音量は再発音・ピッチはグライド)。
- **アクセント**: `step.accent === true` のとき、音量とフィルタエンベロープを**一定量ブースト**(ブースト量は `params.accent`[0,1] でスケール)。
- これらの音響実装(時間・係数)は U2 Functional/実装で確定。U1 は「どのステップが slide/accent か」という**データと発火条件**まで責務。

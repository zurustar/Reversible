# Services — Reversible

サービス層は、コンポーネント群を束ねてユースケース(ユーザーの操作)をオーケストレーションする。UIは基本的にサービス経由(またはストアの dispatch 経由)で操作を行い、低レベルのコンポーネントを直接触らない。

---

## S-01: TransportService
- **責務**: 再生に関するユースケースの調整。
- **オーケストレーション**:
  - `play()`: AudioEngine を `resume()`(ユーザー操作起点) → Scheduler を `start()` → Store を `playing=true`
  - `stop()`: Scheduler を `stop()` → Store を `playing=false`, `currentStep=0`
  - `setBpm(bpm)`: 検証(範囲クランプ, US-02 GWT-3) → Store 更新 → Scheduler へ反映
  - `setSwing(swing)`: Store 更新 → Scheduler へ反映(将来 US-06)
- **利用**: C-03 Scheduler, C-04 AudioEngine, C-02 Store
- **関連**: US-01/02、JS-2、NFR-1

## S-02: SoundDesignService(音作りの反映)
- **責務**: bassline/ドラムのパラメータ変更を Store と Instrument の双方に一貫反映。
- **オーケストレーション**:
  - `setBasslineParam(key, value)`: Store 更新 → BasslineVoice.setParam。再生を止めずリアルタイム反映(US-09, NFR-1)
  - `setDrumParam(voiceId, key, value)`: Store 更新 → DrumMachine.setVoiceParam
  - 0..1 → 実値の変換(純粋関数)を適用(範囲不変, PBT-03)
- **利用**: C-02 Store, C-06 BasslineVoice, C-07 DrumMachine
- **関連**: US-08〜11

## S-03: PatternEditService(打ち込み)
- **責務**: ステップ入力のユースケース。
- **オーケストレーション**:
  - `toggleDrumStep(voiceId, index)` → Store dispatch
  - `setBasslineStep(index, {note|accent|slide|on})` → Store dispatch
  - 入力の範囲/整合(index<16 等)を保証
- **利用**: C-02 Store
- **関連**: US-03/04/05

## S-04: ProjectService(保存/新規/入出力)
- **責務**: 曲プロジェクトのライフサイクルと JSON 入出力の調整。
- **オーケストレーション**:
  - `newSong()`: DomainModel.createEmptySong → Store loadSong
  - `saveToBrowser()`: PersistenceService.save(現在のsong)(自動保存フックからも呼ぶ, US-14)
  - `restoreFromBrowser()`: PersistenceService.load → あれば Store loadSong(起動時)
  - `exportSong()`: ImportExportManager.downloadExport(現在のsong)(FR-5.4, US-15)
  - `importFromText(text)` / `importFromFile(file)`:
    - ImportExportManager → Validator の `Result` を受け、
    - ok なら Store loadSong、失敗なら UI に検証エラーを返す(既存状態は保持, US-18 GWT-1)
- **利用**: C-08 Serializer, C-09 Validator, C-10 PersistenceService, C-11 ImportExportManager, C-02 Store
- **関連**: FR-5、US-14〜18、SEC-05/13/15、PBT-02

## S-05: AppBootstrap(初期化)
- **責務**: 起動時の組み立て。
- **オーケストレーション**:
  - AudioEngine.init → Instrument(bassline/ドラム)を生成・登録 → masterOut へ接続
  - Store 生成 → PersistenceService.restore(あれば復元、なければ createEmptySong)
  - Scheduler 生成(Store + AudioEngine を注入)
  - UI Views を mount(Store を購読)、自動保存フックを Store に接続
  - AudioContext は resume をユーザー操作(再生/クリック)に紐付け(ブラウザ制約)
- **利用**: ほぼ全コンポーネント
- **関連**: FR-1、SEC-15(初期化失敗時フェイルセーフ)

---

## サービス⇔UIの原則(Q4=A)
- UI → **Service.dispatch 相当の操作** または **Store.dispatch** で状態変更
- Store 変更 → **購読**しているUIが再描画(単方向データフロー)
- Scheduler/Engine は Store の**スナップショットを読む**(UIとは直接結合しない)
- これにより UI 層は差し替え可能(将来のモダンUI, FR-6.2)、テスト時はサービス/ストアをヘッドレスに検証可能(NFR-4)

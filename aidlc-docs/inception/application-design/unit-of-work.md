# Units of Work — Reversible

本プロジェクトはクライアントのみの単一Webアプリ(モノリス)。独立デプロイ単位ではなく、**1パッケージ内の論理モジュール = 開発ユニット**として3つに分解する。CONSTRUCTION はこの順で per-unit ループを回す。

**構築順序**: U1 Core → U2 Audio Engine → U3 IO + UI

---

## U1: Core(Domain + State + Sequencer)
- **含むコンポーネント/サービス**: C-01 DomainModel、C-02 Store、C-03 Scheduler、S-01 TransportService、S-02 SoundDesignService、S-03 PatternEditService
- **責務**:
  - 曲/パターン/ステップ/パラメータのデータモデル(バージョン付き)とファクトリ
  - 中央リアクティブ・ストア(単一の真実源、Observer)
  - look-ahead スケジューラ(AudioContext時刻でステップ発音を先行予約)
  - 再生制御・音作り反映・打ち込みのオーケストレーション(サービス)
- **他ユニットとの関係**: U2 の `Instrument`/`AudioEngine` インターフェースに依存(実体は注入)。U2 の音源へ `trigger(event, when)` を発行。
- **主なストーリー**: US-01/02/03/04/05、JS-2(タイミング面)
- **PBT対象**: パラメータ 0..1 → 実値 変換の範囲不変(PBT-03)、スケジューラ不変条件(将来 US-06 の PBT-03)

## U2: Audio Engine(音源)
- **含むコンポーネント**: C-04 AudioEngine、C-05 Instrument(契約)、C-06 BasslineVoice(+ BasslineFilter 抽象)、C-07 DrumMachine/DrumVoice
- **責務**:
  - AudioContext/マスター出力の管理、Instrument の保持・登録
  - basslineスタイル合成(saw/square → レゾナントLPF → アンプ包絡、アクセント/スライド)
  - 合成ドラム音源(voice ごとの合成とパラメータ)
  - フィルタ段は差し替え可能(MVP: BiquadFilter、将来: AudioWorklet)
- **他ユニットとの関係**: U1 のドメイン**型のみ**(Waveform、各Params、TriggerEvent)を型参照(ランタイム依存なし)。UI/状態には依存しない(逆流なし)。
- **主なストーリー**: US-08/09/10/11、US-04/05(発音面)、JS-1/JS-2(音)
- **PBT対象**: なし〜限定的(合成は主観評価。パラメータ→係数変換の範囲は U1 側で検証)

## U3: IO + UI(永続化・入出力 + 画面)
- **含むコンポーネント/サービス**: C-08 SongSerializer、C-09 SongValidator、C-10 PersistenceService、C-11 ImportExportManager、S-04 ProjectService、C-12 UI Views、S-05 AppBootstrap
- **責務**:
  - 曲の localStorage 保存/復元
  - JSON エクスポート(ダウンロード)/インポート(コピペ必須・ファイル任意)と**検証**(SEC-05/13/15)
  - 機能優先UI(Transport/StepGrid/BasslinePanel/DrumPanel/ImportExport)。ストア購読で単方向描画
  - 起動時の組み立て(Engine/Store/Scheduler/Views の配線、自動保存フック)
- **他ユニットとの関係**: U1(Store/Domain/サービス)と U2(Bootstrap で Engine 配線)に依存。
- **主なストーリー**: US-14/15/16/17/18/19、JS-1(保存・エクスポート)
- **PBT対象**: Serializer ラウンドトリップ(PBT-02、FR-5.7)

---

## コード編成戦略(Greenfield / 単一パッケージ + Vite想定)
最終的な技術スタック(ビルドツール・テスト・PBTフレームワーク)は次段 NFR Requirements で確定するが、ディレクトリ方針は以下。

```
reversible/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  src/
    domain/        # U1: 型・ファクトリ・定数(Song, Pattern, Params, TriggerEvent, STEP_COUNT)
    state/         # U1: store, actions
    sequencer/     # U1: scheduler(look-ahead)
    audio/         # U2: engine, instrument, bassline(+filter), drums, param-maps
    io/            # U3: serializer, validator, persistence, import-export
    ui/            # U3: views(transport, step-grid, bassline-panel, drum-panel, import-export)
    services/      # transport/sound-design/pattern-edit(U1), project(U3)
    main.ts        # U3: bootstrap(S-05)
  tests/
    unit/          # 例示テスト
    pbt/           # property-based(serializer round-trip 等)
```

- **アプリコードはワークスペース直下**(aidlc-docs/ には置かない)。
- 型は `domain/` に集約し、U2 は型のみ import(ランタイム循環を避ける)。
- サービスは `services/` 配下に置き、所属ユニットを本ドキュメントで管理。

## ユニット境界の検証
- 依存は U1 → U2(実行時: インターフェース注入)、U3 → U1/U2。U2 → U1 は**型のみ**でランタイム循環なし。
- 全ストーリーがいずれかのユニットに割当済み(`unit-of-work-story-map.md` 参照)。
- 各ユニットは単独で設計・実装・テスト可能(NFR-4)。

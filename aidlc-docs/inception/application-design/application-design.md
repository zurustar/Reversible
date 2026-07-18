# Application Design (統合ドキュメント) — Reversible

本ドキュメントは Application Design の成果物を統合したもの。詳細は各ファイル参照:
- [components.md](components.md) — コンポーネント定義・責務・インターフェース
- [component-methods.md](component-methods.md) — メソッドシグネチャ・型
- [services.md](services.md) — サービス層・オーケストレーション
- [component-dependency.md](component-dependency.md) — 依存・通信・データフロー

## 確定した設計判断
| 項目 | 決定 | 根拠 |
|---|---|---|
| アーキテクチャ | 層構成(UI / 状態・ドメイン / サービス / シーケンサー / オーディオエンジン / 永続化・入出力) | NFR-3 疎結合、UI差し替え可能(FR-6.2) |
| 合成方式 | ハイブリッド(MVPは標準ノード、basslineフィルタは AudioWorklet に差し替え可能な抽象化) | Q2=C、実装容易性と将来の質感向上の両立 |
| UI | バニラ TypeScript + 小リアクティブ・ストア | Q3=A、依存最小、MVP向き |
| 通信 | 中央ストア + Observer(単方向データフロー) | Q4=A、テスト容易・疎結合 |
| タイミング | look-ahead スケジューラ(AudioContext時刻で先行予約) | NFR-1、FR-4.5、JS-2 |
| 音源の抽象 | `Instrument` インターフェース(プラガブル) | 将来: 2nd bassline / analog+digital / エフェクト |
| データ | バージョン付き `Song` モデル + Serializer/Validator | FR-5.3、SEC-05/13/15、PBT-02 |

## コンポーネント一覧(要約)
- **状態・ドメイン**: C-01 DomainModel、C-02 Store
- **シーケンサー**: C-03 Scheduler
- **オーディオエンジン**: C-04 AudioEngine、C-05 Instrument(契約)、C-06 BasslineVoice、C-07 DrumMachine/DrumVoice
- **永続化・入出力**: C-08 SongSerializer、C-09 SongValidator、C-10 PersistenceService、C-11 ImportExportManager
- **UI**: C-12 UI Views(Transport / StepGrid / BasslinePanel / DrumPanel / ImportExport)
- **サービス**: S-01 Transport、S-02 SoundDesign、S-03 PatternEdit、S-04 Project、S-05 Bootstrap

## 要件トレーサビリティ(抜粋)
| 要件/ストーリー | 対応コンポーネント/サービス |
|---|---|
| FR-2 bassline合成 / US-04/05/08/09/10 | C-06 BasslineVoice、S-02 SoundDesign、S-03 PatternEdit |
| FR-3 ドラム合成 / US-03/11 | C-07 DrumMachine、S-02、S-03 |
| FR-4 シーケンサー / US-01/02、JS-2 | C-03 Scheduler、S-01 Transport |
| FR-5.1/5.2 保存/復元 / US-14 | C-10 Persistence、C-08 Serializer、S-04 Project |
| FR-5.4〜5.7 JSON入出力 / US-15/16/17 | C-11 ImportExport、C-08 Serializer、S-04 |
| FR-5.6 検証 / US-18 / SEC-05/13/15 | C-09 SongValidator、S-04 |
| FR-6.1 機能UI / US-19 | C-12 UI Views、Store 購読 |
| NFR-1 リアルタイム性 | C-03 Scheduler(look-ahead)、Instrument.trigger(when) |
| NFR-4 テスト容易性 / PBT-02/03 | ヘッドレスな Store/Serializer/Validator、純粋パラメータ変換 |

## 拡張ポイント(将来)
- 2台目bassline / analog+digital: `AudioEngine.addInstrument` で追加(C-04/C-05)
- ソング/パターンチェーン: `Song.patternOrder` を Scheduler が解釈(US-07)
- エフェクト: `AudioEngine.masterOut` に insert チェーン(FR-7、US-20)
- モダンUI: UI層のみ差し替え(状態・ドメインは不変、FR-6.2)
- AudioWorklet: `BasslineFilter`(将来はボイス全体)を Worklet 実装へ

## 拡張ルール適合(本ステージ)
- 🔐 **Security**: 入出力の検証を C-09 SongValidator に集約(SEC-05/13/15)。エンジンは外部入力を直接受けない設計。ブロッキング指摘なし。
- 🧪 **PBT(部分適用)**: Serializer のラウンドトリップ(PBT-02)とパラメータ変換の範囲不変(PBT-03)を、対象コンポーネント(C-08、C-06/C-07の変換)として明示。詳細プロパティ特定は Functional Design(PBT-01)。ブロッキング指摘なし。
- 🛟 **Resiliency**: 無効(適用外)。

## 次段(Units Generation)への示唆(参考)
層/責務のまとまりから、ユニット候補は概ね次の通り(確定は Units Generation):
1. **Sound Engine ユニット**(C-04〜C-07)
2. **Sequencer & State ユニット**(C-01〜C-03、S-01〜S-03)
3. **Persistence & IO ユニット**(C-08〜C-11、S-04)
4. **UI ユニット**(C-12、S-05 の一部)

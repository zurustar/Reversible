# NFR Design (全ユニット共通) — Reversible

## パターン
- **Look-ahead スケジューラ**(Chris Wilson の2クロック方式): `setInterval(25ms)` でオーディオクロックを先読み(0.1s)し、`AudioParam` 系APIで `when` 指定発音。UI表示は rAF で `currentStep` を反映。→ NFR-1。
- **単方向データフロー + Observer ストア**: UIは購読で再描画、更新は dispatch。→ 疎結合・テスト容易(NFR-3/4)。
- **検証レイヤ集約**: 外部JSONは `SongValidator` を必ず通してから `loadSong`。`Result<T,E>` 型で成功/失敗を明示、例外を投げっぱなしにしない。→ SEC-05/13/15。
- **差し替え可能フィルタ**: `BasslineFilter` を interface 化。MVPは `BiquadFilter` 実装、将来 AudioWorklet 実装へ。→ Q2=C。
- **純粋なパラメータ変換**: `param-maps.ts` の 0..1→実値 関数はクランプ付き純粋関数。→ PBT-03(範囲不変)。
- **単一ファイル配布**: `vite-plugin-singlefile` でビルド時に全JS/CSSをHTMLへインライン。ランタイムのアセット取得が無い(音は合成)ので `file://` 実行が可能。→ NFR-2、「開くだけで動く」配布要件。
- **UIレイアウト**: 楽器ごとに「音色コントロール(上)+ その楽器のシーケンサー(下)」を1カード化(`bassline-section` / `drum-section`)。UIは疎結合のままなので将来のモダンUI差し替えに影響しない(FR-6.2)。

## エラーハンドリング(SEC-15)
- AudioContext 初期化/resume 失敗を捕捉し、UIに通知(致命的にしない)。
- localStorage 例外(容量/無効)を捕捉。
- インポート失敗は既存状態を保持しエラー表示。

## テスト容易性(NFR-4)
- Store / reducer / serializer / validator / param-maps はヘッドレスにテスト可能(DOM/AudioContext 非依存)。
- スケジューラは時刻とtriggerをモックして計数検証(P-06)。

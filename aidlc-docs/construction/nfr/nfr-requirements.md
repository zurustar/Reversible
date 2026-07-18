# NFR Requirements (全ユニット共通) — Reversible

ユーザー指示(「操作できるものができるまで一気に進める」)により、NFR Requirements はユニット横断で1本化。

## 技術スタック(確定)
| 項目 | 選定 | 理由 |
|---|---|---|
| 言語 | TypeScript (strict) | 型安全、Web Audio と相性良 |
| ビルド/開発 | Vite 7 | 高速dev server、静的ビルド(NFR-2 静的配信) |
| 単一ファイル化 | vite-plugin-singlefile | JS/CSSを1つのHTMLにインライン → `file://` で開くだけで動く配布形態 |
| 音声 | Web Audio API | FR-1.2 |
| UI | バニラTS + 自前の小リアクティブ・ストア | Q3=A、依存最小 |
| テスト | Vitest 4(設定は `vitest.config.ts` に分離) | Vite統合、高速 |
| PBT | fast-check | PBT-09、TS対応、shrink/seed対応 |
| Lint/整形 | (任意) ESLint/Prettier | 後追い可 |

**配布形態(確定)**: `npm run build` で **単一の自己完結 `dist/index.html`** を生成(外部参照ゼロ)。静的ホスティングでもよいが、**ファイルをダブルクリックしてブラウザで開くだけ**でも動く(音は合成のみでランタイムのアセット取得が無いため)。「落として即実行」形態。
**依存バージョン(SEC-10)**: Vite 7 + Vitest 4 に更新済みで `npm audit` は脆弱性0。`package-lock.json` をコミットしピン留め、`latest` タグ不使用。

## 性能(NFR-1)
- オーディオ・グリッチなしのリアルタイム再生。発音は AudioContext 時刻で先行予約(look-ahead)。
- UI更新は rAF、オーディオスケジュールと分離。

## セキュリティ(Security Full、該当分)
- SEC-05/13: JSONインポートは検証(型/スキーマ/バージョン)、安全なデシリアライズ。
- SEC-15: 例外は捕捉しフェイルセーフ(範囲外クランプ/no-op、破損データで落ちない)。
- SEC-04: 配信時の CSP 等ヘッダは配信手順で文書化(Build & Test)。
- SEC-10: 依存はロックファイル(package-lock.json)で固定、`latest` タグ不使用、脆弱性スキャン手順を Build & Test に記載。
- その他(DB/認証/ネットワーク/IAM 等)は client-only のため N/A。

## PBT(Partial: PBT-02/03/07/08/09)
- PBT-02: Serializer ラウンドトリップ(U3)。
- PBT-03: 不変条件(U1 の P-01..P-07、パラメータ変換の範囲)。
- PBT-07: ドメイン型のジェネレータを用意。
- PBT-08: seed/shrink は fast-check 既定を使用、CIでseedログ。
- PBT-09: fast-check を依存に追加。

## Resiliency
- 無効(適用外)。

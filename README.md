# RenDot

8×8ドット絵を色番号、ランレングス圧縮、二進数、偶数パリティ、QRライクデータへ変換し、元の絵へ復元するWebアプリです。

## 主な機能

- iPad Safari向けのタップ・ドラッグ連続描画（1ストローク単位のUndo / Redo）
- 色番号0〜7を共通に使うカラフル・モノクロ・オーシャン・サンセットの4パレット、全消去確認、7種類のサンプル
- 個数・色を各3bitで表すランレングス圧縮と、式付き圧縮率表示
- 3bitごとの偶数パリティと、データbit反転によるエラー検出体験
- 25×25マスを余りなく使う、縦横タイミングとCRC-8付き40bitヘッダーの独自形式
- 4色の位置マーカー、全画面表示、カメラ・射影変換による読み取り
- QRライクデータの任意bit反転、位置特定、Undo、復元エラー体験
- localStorageによるドット絵・カラーモード・現在ステップ・QR変更の端末内保存
- レスポンシブ、ライト / ダークモード、`prefers-reduced-motion` 対応
- 外部API、データベース、外部画像、Webフォントへの実行時依存なし

## 開発

Node.js 20.9以上を使用します。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開いてください。

## 検証

```bash
npm test          # 変換・カメラ読取ロジックのVitest
npm run typecheck # TypeScript
npm run lint      # ESLint
npm run build     # Next.js本番ビルド
```

ローカルでアプリを起動した状態で、Edge / Chromeを使う7ステップのUIスモークテストも実行できます。

```bash
npm run test:ui
```

別ポートを使う場合は `UI_BASE_URL`、ブラウザーを指定する場合は `BROWSER_PATH` を設定してください。

## 構成

```text
src/
  app/                  App Router、テーマCSS
  components/           shadcn/uiベースのUIと7ステップ画面
  lib/                  UIから分離した変換・検証ロジック
tests/
  codec.test.ts         RLE、二進数、パリティ、QRライク、復元テスト
scripts/
  ui-smoke.mjs          実ブラウザーによる操作テスト
```

QRライク形式は25×25マスです。四隅の3×3色マーカー36マス、4行目・4列目のタイミング37マス、ヘッダー40bit、データ領域512bitで全625マスを使い切ります。ヘッダーは識別用magic 16bit、件数6bit、payload長とカラーモード10bit、CRC-8 8bitです。1まとまりが必ず8bitでpayload長の下位3bitが空く性質を利用し、そのうち下位2bitへ4種類のカラーモードを格納します。従来コードの値 `00` はカラフルとして扱うため、既存のQRライクも引き続き読み取れます。ヘッダーとデータは、右下から2列単位で上下を切り替えるジグザグ順に配置します。実データ以降のデータ領域は、物理的な行・列座標を基準にした市松模様のダミーです。画面では配置番号とダミー範囲を確認できます。1まとまりは `個数3bit + parity + 色3bit + parity` の8bitで、個数の `000` は8です。カメラはHTTPSまたはlocalhostで利用できます。

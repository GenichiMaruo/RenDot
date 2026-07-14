import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright-core";

const browserCandidates = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/microsoft-edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

const executablePath = browserCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) {
  throw new Error("UIテストに使えるEdge / Chromeが見つかりません。BROWSER_PATHを指定してください。");
}

const baseUrl = process.env.UI_BASE_URL ?? "http://127.0.0.1:3000";
const artifacts = path.resolve(".artifacts");
mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 1180, height: 820 },
  colorScheme: "light",
  locale: "ja-JP",
  reducedMotion: "reduce",
});
const page = await context.newPage();

const revealStepActions = async () => {
  const trigger = page.getByRole("button", { name: /操作を表示/ });
  if (await trigger.count()) await trigger.click();
};

const advanceStep = async () => {
  await revealStepActions();
  await page.getByRole("button", { name: "次へ", exact: true }).click();
};

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "ドット絵を描く" }).waitFor();
  assert.equal(await page.locator("[data-pixel-index]").count(), 64);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const resizableCanvas = page.locator('[data-resizable-canvas="true"]');
  const initialCanvasBox = await resizableCanvas.boundingBox();
  assert.ok(initialCanvasBox && initialCanvasBox.width > 540, `Canvas is too small: ${JSON.stringify(initialCanvasBox)}`);
  const canvasSizeControl = page.getByRole("slider", { name: "キャンバスの表示サイズ" });
  const initialCanvasSize = Number(await canvasSizeControl.getAttribute("aria-valuenow"));
  await canvasSizeControl.press("ArrowLeft");
  assert.ok(Number(await canvasSizeControl.getAttribute("aria-valuenow")) < initialCanvasSize);
  await canvasSizeControl.press("ArrowRight");
  await page.screenshot({ path: path.join(artifacts, "light-ipad-landscape.png"), fullPage: true });

  let firstCell = page.locator('[data-pixel-index="0"]').first();
  await firstCell.click();
  await page.reload({ waitUntil: "networkidle" });
  firstCell = page.locator('[data-pixel-index="0"]').first();
  await firstCell.waitFor();
  assert.match(await firstCell.getAttribute("aria-label"), /色番号2/);
  const pixelBeforeScanner = await firstCell.getAttribute("aria-label");
  await page.getByRole("button", { name: "QRライクを読み取る" }).click();
  const scannerDialog = page.getByRole("alertdialog", { name: "QRライクを読み取る" });
  await scannerDialog.waitFor();
  await scannerDialog.getByText(/制作中の絵は自動では変更されません/).waitFor();
  assert.equal(await firstCell.getAttribute("aria-label"), pixelBeforeScanner);
  await scannerDialog.getByRole("button", { name: "閉じる", exact: true }).click();
  await scannerDialog.waitFor({ state: "hidden" });
  assert.equal(await firstCell.getAttribute("aria-label"), pixelBeforeScanner);

  await page.getByRole("button", { name: "現在の絵を保存" }).click();
  await page.getByText("1 / 8", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "この絵は保存済み" }).isDisabled(), true);
  assert.equal(
    await page.evaluate(() => JSON.parse(window.localStorage.getItem("rendot:artworks:v1")).artworks.length),
    1,
  );

  await page.getByRole("button", { name: /色番号0、白/ }).click();
  await firstCell.click();
  await page.getByRole("button", { name: /色番号2、赤/ }).click();
  const lastCellInFirstRow = page.locator('[data-pixel-index="7"]').first();
  const startBox = await firstCell.boundingBox();
  const endBox = await lastCellInFirstRow.boundingBox();
  assert.ok(startBox && endBox);
  await page.mouse.move(startBox.x + startBox.width / 2, startBox.y + startBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(endBox.x + endBox.width / 2, endBox.y + endBox.height / 2);
  await page.mouse.up();
  for (let index = 0; index < 8; index += 1) {
    assert.match(
      await page.locator(`[data-pixel-index="${index}"]`).first().getAttribute("aria-label"),
      /色番号2/,
    );
  }
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();
  await page.getByRole("button", { name: /カラーノイズのサンプルを読み込む/ }).click();
  await page.getByRole("button", { name: "この絵を編集", exact: true }).click();
  firstCell = page.locator('[data-pixel-index="0"]').first();
  assert.match(await firstCell.getAttribute("aria-label"), /色番号2/);
  await page.getByRole("button", { name: "元に戻す", exact: true }).click();

  assert.equal(await page.getByRole("button", { name: "次へ", exact: true }).count(), 0);
  await revealStepActions();
  await page.getByRole("button", { name: "操作を隠す", exact: true }).click();
  await page.getByRole("button", { name: /操作を表示/ }).waitFor();
  await advanceStep();
  await page.getByRole("heading", { name: "絵を色番号に変換" }).waitFor();
  await page.getByRole("button", { name: "操作を隠す", exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: /操作を表示/ }).count(), 0);
  await advanceStep();
  await page.getByRole("heading", { name: "同じ色をまとめて圧縮" }).waitFor();
  assert.equal(await page.locator('[data-bit-sequence="before"]').count(), 1);
  assert.equal(await page.locator('[data-bit-sequence="after"]').count(), 1);
  assert.equal(await page.getByText(/bitは、0か1のどちらか1つ/).count(), 0);
  await page.getByRole("button", { name: "bitと圧縮率の説明を読む" }).click();
  await page.getByText(/bitは、0か1のどちらか1つ/).waitFor();
  await page.getByRole("button", { name: "bitと圧縮率の説明を閉じる" }).click();
  const slowScan = page.getByRole("button", { name: "ゆっくり", exact: true });
  await slowScan.click();
  assert.equal(await slowScan.getAttribute("aria-pressed"), "true");
  await advanceStep();
  await page.getByRole("heading", { name: "数字を二進数に変換" }).waitFor();
  assert.equal(await page.getByText(/コンピューターの回路は/).count(), 0);
  await page.getByRole("button", { name: "なぜ2進数なのかを読む" }).click();
  await page.getByText(/コンピューターの回路は/).waitFor();
  await page.getByRole("button", { name: "2進数の仕組みを読む" }).click();
  await page.getByText("101 = 4 + 0 + 1 = 5", { exact: true }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(artifacts, "binary-max.png"), fullPage: false });
  await advanceStep();
  await page.getByRole("heading", { name: "3bitずつ見張り役を付けよう" }).waitFor();
  assert.equal(await page.getByText("偶数パリティの作り方", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "パリティビットの詳しい説明を読む" }).click();
  await page.getByText("偶数パリティの作り方", { exact: true }).waitFor();
  await page.getByRole("button", { name: "パリティビットの詳しい説明を閉じる" }).click();

  await page.getByRole("button", { name: "1ビットを反転" }).click();
  await page.getByText("エラーを検出しました", { exact: true }).waitFor();
  await page.getByRole("button", { name: "エラーを元に戻す" }).click();

  await advanceStep();
  await page.getByRole("heading", { name: "ビットを読み取れる形にする" }).waitFor();
  assert.equal(await page.locator("[data-region]").count(), 625);
  const cellNumberSwitch = page.getByRole("switch", { name: "セル番号" });
  const placementSwitch = page.getByRole("switch", { name: "配置順" });
  await cellNumberSwitch.click();
  assert.equal(await cellNumberSwitch.getAttribute("data-state"), "checked");
  assert.equal(await placementSwitch.getAttribute("data-state"), "unchecked");
  await placementSwitch.click();
  assert.equal(await cellNumberSwitch.getAttribute("data-state"), "unchecked");
  assert.equal(await placementSwitch.getAttribute("data-state"), "checked");
  await placementSwitch.click();
  assert.equal(await cellNumberSwitch.getAttribute("data-state"), "unchecked");
  assert.equal(await placementSwitch.getAttribute("data-state"), "unchecked");
  await page.getByRole("button", { name: "個数セルを強調" }).click();
  assert.ok(await page.locator('[data-length-highlighted="true"][data-block="length"]').count() > 0);
  assert.equal(await page.locator('[data-length-highlighted="true"][data-block="color"]').count(), 0);
  assert.match(
    await page.locator('[data-length-highlight-pattern="true"]').first().evaluate((element) => getComputedStyle(element).backgroundImage),
    /repeating-linear-gradient/,
  );
  await page.getByRole("button", { name: "パリティ位置を強調" }).click();
  assert.ok(await page.locator('[data-parity-highlighted="true"][data-bit-role="parity"]').count() > 0);
  assert.equal(await page.locator('[data-parity-highlighted="true"][data-bit-role="data"]').count(), 0);
  assert.ok(await page.locator('[data-parity-highlighted="true"][data-length-highlighted="true"]').count() > 0);
  assert.match(
    await page.locator('[data-parity-highlight-pattern="true"]').first().evaluate((element) => getComputedStyle(element).backgroundImage),
    /repeating-linear-gradient/,
  );
  await page.getByRole("button", { name: "パリティ位置を隠す" }).click();
  assert.equal(await page.locator('[data-parity-highlighted="true"]').count(), 0);
  await page.getByRole("button", { name: "個数セルを隠す" }).click();
  assert.equal(await page.locator('[data-length-highlighted="true"]').count(), 0);
  await page.getByRole("button", { name: "領域を斜線表示" }).click();
  assert.ok(await page.locator('[data-hatched="true"]').count() > 77);
  assert.match(
    await page.locator('[data-region="dummy"]').first().evaluate((element) => getComputedStyle(element).backgroundImage),
    /repeating-linear-gradient/,
  );
  await page.getByRole("button", { name: "斜線を隠す" }).click();
  await page.getByRole("button", { name: "全画面" }).click();
  const fullscreenDialog = page.getByRole("dialog", { name: "QRライクデータ全画面表示" });
  await fullscreenDialog.waitFor();
  assert.equal(
    await fullscreenDialog.locator('[data-marker="red"]').first().evaluate((element) => getComputedStyle(element).boxShadow),
    "none",
  );
  await page.setViewportSize({ width: 1180, height: 420 });
  await page.waitForFunction(() => {
    const dialog = document.querySelector('[aria-label="QRライクデータ全画面表示"]');
    return dialog?.getBoundingClientRect().height === window.innerHeight;
  });
  const fullscreenQr = await fullscreenDialog.getByRole("grid").boundingBox();
  assert.ok(
    fullscreenQr && fullscreenQr.y >= 0 && fullscreenQr.y + fullscreenQr.height <= 420,
    `Fullscreen QR is clipped: ${JSON.stringify(fullscreenQr)}`,
  );
  await fullscreenDialog.click({ position: { x: 12, y: 210 } });
  await fullscreenDialog.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.getByRole("tab", { name: "しくみ" }).click();
  await page.getByText("4色マーカー", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "データ" }).click();
  await page.screenshot({ path: path.join(artifacts, "qr-like-max.png"), fullPage: false });
  await page.setViewportSize({ width: 768, height: 1024 });
  const ipadQrCell = await page.locator('[data-region="payload"]').first().boundingBox();
  assert.ok(ipadQrCell && ipadQrCell.width > 5 && ipadQrCell.height > 5);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.setViewportSize({ width: 1024, height: 768 });
  const ipadLandscapeQrCell = await page.locator('[data-region="payload"]').first().boundingBox();
  assert.ok(ipadLandscapeQrCell && ipadLandscapeQrCell.width > 5 && ipadLandscapeQrCell.height > 5);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.setViewportSize({ width: 1180, height: 820 });
  const headerCell = page.locator('[data-region="header"]').first();
  await headerCell.click();
  await page.getByText("ヘッダーエラー", { exact: true }).waitFor();
  await page.getByRole("button", { name: "戻す", exact: true }).click();
  const payloadCell = page.locator('[data-entry-index="0"][data-entry-bit-index="0"]');
  await payloadCell.click();
  await page.getByText("パリティエラー", { exact: true }).waitFor();
  await page.waitForTimeout(260);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "ビットを読み取れる形にする" }).waitFor();
  await page.getByText("パリティエラー", { exact: true }).waitFor();

  await advanceStep();
  await page.getByRole("heading", { name: "データから絵を復元" }).waitFor();
  await revealStepActions();
  assert.equal(await page.getByRole("button", { name: "完了", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "操作を隠す", exact: true }).click();
  await page.getByRole("button", { name: "復元する" }).click();
  await page.getByRole("heading", { name: "データに誤りが見つかりました" }).waitFor();
  await page.getByRole("button", { name: "エラーを直して戻る" }).click();

  await advanceStep();
  await page.getByRole("button", { name: "復元する" }).click();
  await page.getByRole("heading", { name: "データに誤りが見つかりました" }).waitFor();
  await page.getByRole("button", { name: "そのまま復元してみる" }).click();
  await page.getByRole("heading", { name: "正常に復元できませんでした" }).waitFor();
  await page.getByRole("button", { name: "QRライクデータに戻る" }).click();

  await page.getByRole("button", { name: "リセット" }).click();
  await advanceStep();
  await page.getByRole("button", { name: "復元する" }).click();
  await page.getByRole("heading", { name: "元の画像と一致しました" }).waitFor();

  await revealStepActions();
  const complete = page.getByRole("button", { name: "完了", exact: true });
  assert.equal(await complete.isEnabled(), true);
  await complete.click();
  await page.getByRole("heading", { name: "体験を完了しました" }).waitFor();
  await page.getByRole("button", { name: "閉じる", exact: true }).click();

  await page.getByRole("button", { name: "表示テーマを切り替える" }).click();
  await page.locator("html.dark").waitFor();
  await page.screenshot({ path: path.join(artifacts, "dark-restored.png"), fullPage: true });

  await page.setViewportSize({ width: 820, height: 1180 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, "ipad-portrait.png"), fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(artifacts, "phone-narrow.png"), fullPage: false });

  await page.getByRole("button", { name: "最初からやり直す", exact: true }).first().click();
  await page.getByRole("button", { name: "最初からやり直す", exact: true }).last().click();
  await page.getByRole("heading", { name: "ドット絵を描く" }).waitFor();
  assert.equal(
    await page.evaluate(() => window.localStorage.getItem("rendot:workshop:v3")),
    null,
  );
  assert.equal(
    await page.evaluate(() => JSON.parse(window.localStorage.getItem("rendot:artworks:v1")).artworks.length),
    1,
  );

  process.stdout.write("UI smoke test passed: draw → 7 steps → parity error → QR error → restore.\n");
} finally {
  await context.close();
  await browser.close();
}

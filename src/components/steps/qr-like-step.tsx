"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Expand, Grid2X2, Hash, Info, RotateCcw, ScanLine, ShieldCheck, Undo2, X } from "lucide-react";

import { QrLikeGrid } from "@/components/qr-like-grid";
import { StepHeading } from "@/components/step-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  getQrLikeCellInfo,
  inspectQrLikeData,
  toUserMessage,
  type QrLikeCellInfo,
  type QrLikeData,
} from "@/lib";
import { cn } from "@/lib/utils";

type QrLikeStepProps = {
  data: QrLikeData;
  modifiedIndices: ReadonlySet<number>;
  selectedIndex: number | null;
  onFlip: (index: number) => void;
  onSelectedIndexChange: (index: number) => void;
  onUndo: () => void;
  onResetChanges: () => void;
  canUndo: boolean;
};

type View = "data" | "design";
type CellLabelMode = "none" | "number" | "placement";

type FullscreenBox = {
  width: number;
  height: number;
  top: number;
  left: number;
  qrSize: number;
};

export function QrLikeStep({
  data,
  modifiedIndices,
  selectedIndex,
  onFlip,
  onSelectedIndexChange,
  onUndo,
  onResetChanges,
  canUndo,
}: QrLikeStepProps) {
  const [view, setView] = useState<View>("data");
  const [showGrid, setShowGrid] = useState(true);
  const [cellLabelMode, setCellLabelMode] = useState<CellLabelMode>("none");
  const [showRegionHatching, setShowRegionHatching] = useState(false);
  const [highlightLengthCells, setHighlightLengthCells] = useState(false);
  const [highlightParityCells, setHighlightParityCells] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullscreenBox, setFullscreenBox] = useState<FullscreenBox | null>(null);
  const inspection = useMemo(() => {
    try {
      return { value: inspectQrLikeData(data), error: null };
    } catch (error) {
      return { value: null, error: toUserMessage(error) };
    }
  }, [data]);
  const selected = useMemo<QrLikeCellInfo | null>(() => {
    if (selectedIndex === null) return null;
    try { return getQrLikeCellInfo(data, selectedIndex); } catch { return null; }
  }, [data, selectedIndex]);
  const usedBits = inspection.value?.header.payloadLength ?? null;
  const dummyBits = usedBits === null ? null : 512 - usedBits;

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); };
    const updateBox = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      setFullscreenBox({
        width,
        height,
        top: viewport?.offsetTop ?? 0,
        left: viewport?.offsetLeft ?? 0,
        qrSize: Math.max(48, Math.min(width * 0.92, height - 88)),
      });
    };
    updateBox();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    window.addEventListener("resize", updateBox);
    window.visualViewport?.addEventListener("resize", updateBox);
    window.visualViewport?.addEventListener("scroll", updateBox);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", updateBox);
      window.visualViewport?.removeEventListener("resize", updateBox);
      window.visualViewport?.removeEventListener("scroll", updateBox);
    };
  }, [expanded]);

  return (
    <section className="step-enter">
      <StepHeading
        step={6}
        eyebrow="QR-LIKE FORMAT"
        title="ビットを読み取れる形にする"
        description="25×25へ、予約領域を除いて右下からジグザグ配置します。"
        icon={Grid2X2}
        trailing={<Badge variant="warning">独自形式</Badge>}
      />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1" role="tablist">
        {([
          ["data", Grid2X2, "データ"],
          ["design", Info, "しくみ"],
        ] as const).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold", view === id && "bg-card text-primary shadow-sm")}
          >
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>

      {view === "data" ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>QRライクデータ</CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={onUndo} disabled={!canUndo}><Undo2 />戻す</Button>
                  <Button size="sm" variant="ghost" onClick={onResetChanges} disabled={!canUndo}><RotateCcw />リセット</Button>
                  <Button size="sm" onClick={() => setExpanded(true)}><Expand />全画面</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <QrLikeGrid
                data={data}
                showGrid={showGrid}
                showNumbers={cellLabelMode === "number"}
                showPlacement={cellLabelMode === "placement"}
                showRegionHatching={showRegionHatching}
                highlightLengthCells={highlightLengthCells}
                highlightParityCells={highlightParityCells}
                modifiedIndices={modifiedIndices}
                selectedIndex={selectedIndex}
                onCellClick={onFlip}
                onCellFocus={onSelectedIndexChange}
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:sticky lg:top-4">
            <Card>
              <CardContent className="grid gap-3 pt-5">
                <label className="flex items-center justify-between gap-3 text-sm font-bold">区切り線 <Switch checked={showGrid} onCheckedChange={setShowGrid} /></label>
                <label className="flex items-center justify-between gap-3 text-sm font-bold">セル番号 <Switch checked={cellLabelMode === "number"} onCheckedChange={(checked) => setCellLabelMode(checked ? "number" : "none")} /></label>
                <label className="flex items-center justify-between gap-3 text-sm font-bold">配置順 <Switch checked={cellLabelMode === "placement"} onCheckedChange={(checked) => setCellLabelMode(checked ? "placement" : "none")} /></label>
                <Button
                  type="button"
                  variant={highlightLengthCells ? "default" : "secondary"}
                  className="w-full"
                  onClick={() => setHighlightLengthCells((value) => !value)}
                  aria-pressed={highlightLengthCells}
                >
                  <Hash />
                  {highlightLengthCells ? "個数セルを隠す" : "個数セルを強調"}
                </Button>
                <Button
                  type="button"
                  variant={highlightParityCells ? "default" : "secondary"}
                  className="w-full"
                  onClick={() => setHighlightParityCells((value) => !value)}
                  aria-pressed={highlightParityCells}
                >
                  <ShieldCheck />
                  {highlightParityCells ? "パリティ位置を隠す" : "パリティ位置を強調"}
                </Button>
                <Button
                  type="button"
                  variant={showRegionHatching ? "default" : "secondary"}
                  className="w-full"
                  onClick={() => setShowRegionHatching((value) => !value)}
                  aria-pressed={showRegionHatching}
                >
                  <ScanLine />
                  {showRegionHatching ? "斜線を隠す" : "領域を斜線表示"}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-2 pt-5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">使用データ</span><b>{inspection.value?.payloadBits.length ?? "?"} / 512bit</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ヘッダー</span><b>40bit</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ダミー</span><b>{dummyBits ?? "?"}bit</b></div>
                {usedBits !== null && dummyBits ? <p className="rounded-lg bg-violet-500/10 px-2 py-1.5 text-xs text-violet-700 dark:text-violet-300">payload {usedBits + 1}〜512bit</p> : null}
                <div className="flex justify-between"><span className="text-muted-foreground">状態</span><b className={inspection.error || !inspection.value?.isParityValid ? "text-destructive" : "text-emerald-600 dark:text-emerald-300"}>{inspection.error ? "ヘッダーエラー" : inspection.value?.isParityValid ? "正常" : "パリティエラー"}</b></div>
                {selected ? <div className="border-t pt-2 text-muted-foreground">選択: {selected.region} / {selected.bit}</div> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {view === "design" ? (
        <Card>
          <CardHeader><CardTitle>フォーマット構成</CardTitle></CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
            <QrLikeGrid data={data} showPlacement showRegionHatching />
            <div className="grid content-start gap-3 sm:grid-cols-2">
              <div className="space-y-3 rounded-2xl border bg-background/60 p-4 sm:col-span-2">
                <p className="font-black">552bitの配置範囲</p>
                <div className="flex h-8 overflow-hidden rounded-lg border font-mono text-[10px] font-black text-white">
                  <span className="grid place-items-center bg-amber-500" style={{ width: `${(40 / 552) * 100}%` }}>H</span>
                  <span className="grid place-items-center bg-slate-800" style={{ width: `${((usedBits ?? 0) / 552) * 100}%` }}>DATA</span>
                  <span className="grid place-items-center text-violet-950" style={{ width: `${((dummyBits ?? 0) / 552) * 100}%`, backgroundColor: "#ddd6fe", backgroundImage: "linear-gradient(45deg,#8b5cf6 25%,transparent 25%,transparent 75%,#8b5cf6 75%),linear-gradient(45deg,#8b5cf6 25%,transparent 25%,transparent 75%,#8b5cf6 75%)", backgroundPosition: "0 0,6px 6px", backgroundSize: "12px 12px" }}>DUMMY</span>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <span><b className="text-amber-600">1〜40</b> ヘッダー</span>
                  <span><b className="text-foreground">41〜{40 + (usedBits ?? 0)}</b> 実データ</span>
                  <span><b className="text-violet-600">{41 + (usedBits ?? 0)}〜552</b> ダミー</span>
                </div>
              </div>
              {[
                ["25 × 25", "625マスを余りなく、マーカー36・タイミング37・ヘッダー40・データ512に割り当てます。"],
                ["ヘッダー40bit", "識別子・まとまり数・データ長・CRCを、配置順の先頭へ記録します。"],
                ["縦横1列", "4行目と4列目の白黒交互パターンで、行・列とセル幅を確認します。"],
                ["4色マーカー", "赤=左上、青=右上、緑=右下、橙=左下。4点から射影変換します。"],
                ["ジグザグ配置", "右下から2列ずつ読み、上向き・下向きを交互に切り替えます。予約セルは飛ばします。"],
                ["ダミー範囲", usedBits === null ? "ヘッダーを読めません。" : dummyBits ? `payload ${usedBits + 1}〜512bit（配置 ${41 + usedBits}〜552）です。` : "512bitすべてが実データです。"],
                ["1まとまり", "個数3bit + P1 + 色3bit + P2 = 8bit。個数000は8です。"],
                ["検証", "ヘッダーCRCと各3bitの偶数パリティを確認してから復元します。"],
              ].map(([title, body]) => <div key={title} className="rounded-2xl border bg-background/60 p-4"><p className="font-black text-primary">{title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p></div>)}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {expanded ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="QRライクデータ全画面表示"
          className="fullscreen-surface fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-white"
          onClick={() => setExpanded(false)}
          style={fullscreenBox ? {
            width: `${fullscreenBox.width}px`,
            height: `${fullscreenBox.height}px`,
            top: `${fullscreenBox.top}px`,
            left: `${fullscreenBox.left}px`,
            right: "auto",
            bottom: "auto",
          } : undefined}
        >
          <Button variant="secondary" size="icon" className="fullscreen-close absolute right-4 z-10" onClick={() => setExpanded(false)} aria-label="全画面表示を閉じる"><X /></Button>
          <QrLikeGrid data={data} fullscreen fullscreenSize={fullscreenBox?.qrSize} className="pointer-events-none" />
          <p className="fullscreen-hint pointer-events-none absolute text-xs font-bold text-slate-600">画面をタップして戻る</p>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}

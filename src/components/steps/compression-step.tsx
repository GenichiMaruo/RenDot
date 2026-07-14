"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, Boxes, Pause, Play, Route } from "lucide-react";

import { PixelGrid } from "@/components/pixel-grid";
import { ExplanationPanel } from "@/components/explanation-panel";
import { StepHeading } from "@/components/step-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COLORS,
  flattenGrid,
  getPixelRangeForRun,
  getRunIndexAtPixel,
  toBinaryRunLengthEntry,
  type PixelGrid as PixelGridData,
  type RunLengthEntry,
} from "@/lib";
import { cn } from "@/lib/utils";

type CompressionStepProps = {
  grid: PixelGridData;
  entries: RunLengthEntry[];
  selectedRunIndex: number;
  onSelectRun: (index: number) => void;
};

const SCAN_SPEEDS = [
  { id: "slow", label: "ゆっくり", interval: 480 },
  { id: "normal", label: "標準", interval: 220 },
  { id: "fast", label: "速い", interval: 90 },
] as const;

function MetricCard({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-background/60 p-4",
        accent && "border-primary/25 bg-primary/8",
      )}
    >
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{note}</p>
    </div>
  );
}

export function CompressionStep({
  grid,
  entries,
  selectedRunIndex,
  onSelectRun,
}: CompressionStepProps) {
  const [scanIndex, setScanIndex] = useState<number | null>(null);
  const [scanSpeed, setScanSpeed] = useState<(typeof SCAN_SPEEDS)[number]["id"]>("normal");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pixels = useMemo(() => flattenGrid(grid), [grid]);
  const range = getPixelRangeForRun(entries, selectedRunIndex);
  const highlightedIndices = Array.from(
    { length: range.end - range.start + 1 },
    (_, index) => range.start + index,
  );
  const compressedBits = entries.length * 6;
  const protectedBits = entries.length * 8;
  const reduction = ((192 - compressedBits) / 192) * 100;
  const compressionRate = (compressedBits / 192) * 100;
  const scanInterval = SCAN_SPEEDS.find((speed) => speed.id === scanSpeed)?.interval ?? 220;
  const originalBitGroups = pixels.map((color) => color.toString(2).padStart(3, "0"));
  const compressedBitGroups = entries.map((entry) => {
    const binary = toBinaryRunLengthEntry(entry);
    return binary.lengthBits + binary.colorBits;
  });

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopScan = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setScanIndex(null);
  };

  const startScan = () => {
    if (timerRef.current) {
      stopScan();
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onSelectRun(getRunIndexAtPixel(entries, 63));
      setScanIndex(null);
      return;
    }
    let index = 0;
    setScanIndex(0);
    timerRef.current = setInterval(() => {
      index += 1;
      if (index >= 64) {
        stopScan();
        return;
      }
      setScanIndex(index);
      onSelectRun(getRunIndexAtPixel(entries, index));
    }, scanInterval);
  };

  return (
    <section className="step-enter">
      <StepHeading
        step={3}
        eyebrow="RUN-LENGTH ENCODING"
        title="同じ色をまとめて圧縮"
        description="同じ色を最大8マスずつ「色 × 個数」にまとめます。"
        icon={Boxes}
        trailing={
          <Badge variant={compressedBits < 192 ? "success" : compressedBits === 192 ? "warning" : "danger"} className="h-8 px-3">
            {compressedBits < 192
              ? `${Math.abs(reduction).toFixed(1)}% 小さくなった`
              : compressedBits === 192
                ? "同じ長さ"
                : `${Math.abs(reduction).toFixed(1)}% 大きくなった`}
          </Badge>
        }
      />

      <Card className="mb-4">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>どの順番で読む？</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="走査速度" className="flex rounded-xl bg-secondary p-1">
                {SCAN_SPEEDS.map((speed) => (
                  <button
                    key={speed.id}
                    type="button"
                    aria-pressed={scanSpeed === speed.id}
                    disabled={scanIndex !== null}
                    onClick={() => setScanSpeed(speed.id)}
                    className={cn(
                      "min-h-9 rounded-lg px-3 text-xs font-bold text-muted-foreground transition disabled:opacity-45",
                      scanSpeed === speed.id && "bg-card text-primary shadow-sm",
                    )}
                  >
                    {speed.label}
                  </button>
                ))}
              </div>
              <Button variant="secondary" onClick={startScan}>
                {scanIndex === null ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                {scanIndex === null ? "走査を見る" : "止める"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-muted-foreground">
            {Array.from({ length: 8 }, (_, row) => (
              <div key={row} className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2">
                <Route className="size-4 text-primary" aria-hidden="true" />
                {row + 1}行目 <span className="font-mono text-foreground">→ → →</span>
                {row < 7 && <ArrowDownRight className="size-4 text-primary" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>ドット絵との対応</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto w-full max-w-[30rem]">
              <PixelGrid
                grid={grid}
                readOnly
                highlightedIndices={highlightedIndices}
                selectedCellIndex={scanIndex ?? undefined}
                onCellSelect={(index) => onSelectRun(getRunIndexAtPixel(entries, index))}
                ariaLabel="圧縮のまとまりと対応するドット絵"
              />
            </div>
            <div className="mt-4 rounded-2xl bg-primary/8 p-3 text-sm leading-6">
              選択中：<strong>#{selectedRunIndex + 1}</strong> ・{" "}
              <strong>{COLORS[entries[selectedRunIndex].color].name} × {entries[selectedRunIndex].length}</strong>
              <span className="ml-1 text-muted-foreground">（{range.start + 1}〜{range.end + 1}マス目）</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>圧縮後のまとまり</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex max-h-[28rem] flex-wrap gap-2 overflow-y-auto pr-1" aria-label="ランレングス圧縮の結果">
              {entries.map((entry, index) => (
                <button
                  type="button"
                  key={`${index}-${entry.color}-${entry.length}`}
                  onClick={() => onSelectRun(index)}
                  className={cn(
                    "flex min-h-12 items-center gap-2 rounded-xl border bg-background/70 px-3 py-2 text-sm font-bold outline-none transition hover:border-primary/35 hover:bg-accent focus-visible:ring-4 focus-visible:ring-ring/25",
                    selectedRunIndex === index && "border-primary bg-primary/10 text-foreground ring-2 ring-primary/15",
                  )}
                  aria-pressed={selectedRunIndex === index}
                >
                  <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
                  <span
                    className="size-5 rounded-md border border-black/15 shadow-sm dark:border-white/30"
                    style={{ backgroundColor: COLORS[entry.color].hex }}
                    aria-hidden="true"
                  />
                  {COLORS[entry.color].name} × {entry.length}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>まとまり数</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <MetricCard label="元の色番号数" value="64個" note="8 × 8マス" />
            <MetricCard label="圧縮後" value={`${entries.length}個`} note="同じ色のまとまり" accent />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle>圧縮率</CardTitle>
            <p className="font-mono text-sm font-bold text-primary">{compressedBits} ÷ 192 × 100 = {compressionRate.toFixed(1)}%</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="元の画像データ" value="192bit" note="64 × 色3bit" />
              <MetricCard label="圧縮データ" value={`${compressedBits}bit`} note={`${entries.length} × (個数3 + 色3)bit`} accent />
              <MetricCard label="パリティ付き" value={`${protectedBits}bit`} note={`${entries.length} × 8bit（ヘッダー除く）`} />
            </div>
            <ExplanationPanel label="bitと圧縮率の説明">
              <div className="space-y-2">
                <p><strong className="text-foreground">bit</strong>は、0か1のどちらか1つを記録するデータの最小単位です。8色は3bitで表せます。</p>
                <p>元データは <strong className="text-foreground">64マス × 色3bit = 192bit</strong>。圧縮後は、1まとまりにつき個数3bitと色3bitの合計6bitです。</p>
                <p>圧縮率は「圧縮後 ÷ 圧縮前 × 100」で求めます。100%より小さければデータが小さく、100%を超えると元より大きくなっています。</p>
              </div>
            </ExplanationPanel>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle>01のならびで比較</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 xl:grid-cols-2">
          <section className="min-w-0 rounded-2xl border bg-background/60 p-3" aria-labelledby="bits-before-title">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="bits-before-title" className="font-black">圧縮前</h3>
              <Badge variant="secondary">192bit</Badge>
            </div>
            <div
              data-bit-sequence="before"
              className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto font-mono text-xs font-black leading-none"
              aria-label={`圧縮前192bit、${originalBitGroups.join("")}`}
            >
              {originalBitGroups.map((bits, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    "rounded-md border bg-secondary px-1.5 py-2 tabular-nums",
                    index >= range.start && index <= range.end && "border-cyan-400 bg-cyan-400/15 text-cyan-800 dark:text-cyan-200",
                  )}
                >
                  {bits}
                </span>
              ))}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border bg-background/60 p-3" aria-labelledby="bits-after-title">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 id="bits-after-title" className="font-black">圧縮後</h3>
              <Badge variant="secondary">{compressedBits}bit</Badge>
            </div>
            <div
              data-bit-sequence="after"
              className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto font-mono text-xs font-black leading-none"
              aria-label={`圧縮後${compressedBits}bit、${compressedBitGroups.join("")}`}
            >
              {compressedBitGroups.map((bits, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`まとまり${index + 1}、${bits}`}
                  aria-pressed={selectedRunIndex === index}
                  onClick={() => onSelectRun(index)}
                  className={cn(
                    "min-h-8 rounded-md border bg-secondary px-1.5 font-mono font-black tabular-nums outline-none focus-visible:ring-4 focus-visible:ring-ring/25",
                    selectedRunIndex === index && "border-primary bg-primary/15 text-primary",
                  )}
                >
                  {bits}
                </button>
              ))}
            </div>
          </section>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">圧縮前の64個の色番号</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
            {pixels.map((color, index) => (
              <span
                key={index}
                className="grid aspect-square min-h-7 place-items-center rounded-lg border border-black/10 font-mono text-xs font-black sm:text-sm"
                style={{ backgroundColor: COLORS[color].hex, color: COLORS[color].foreground }}
              >
                {color}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

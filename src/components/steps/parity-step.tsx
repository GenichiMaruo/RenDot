"use client";

import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { ExplanationPanel } from "@/components/explanation-panel";
import { StepHeading } from "@/components/step-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  encodeEntry,
  getColor,
  inspectEncodedEntry,
  toBinaryRunLengthEntry,
} from "@/lib";
import type {
  ColorMode,
  EncodedEntryInspection,
  ParityBlock as ParityBlockData,
  ParityBlockKey,
  RunLengthEntry,
} from "@/lib";

export type ParityStepProps = {
  entries: RunLengthEntry[];
  colorMode: ColorMode;
  selectedRunIndex: number;
  onSelectRun: (index: number) => void;
  demoBits: string | null;
  flippedBitIndex: number | null;
  onFlip: () => void;
  onReset: () => void;
};

const BLOCK_LABELS: Record<ParityBlockKey, string> = {
  length: "個数ブロック",
  color: "色番号のブロック",
};

type BitBlockProps = {
  title: string;
  detail: string;
  parityLabel: "P1" | "P2";
  block: ParityBlockData;
  startIndex: 0 | 4;
  flippedBitIndex: number | null;
};

function BitBlock({
  title,
  detail,
  parityLabel,
  block,
  startIndex,
  flippedBitIndex,
}: BitBlockProps) {
  const bits = [...block.dataBits, String(block.parityBit)];

  return (
    <Card
      className={`overflow-hidden transition-[border-color,box-shadow,background-color] ${
        block.isValid
          ? "border-emerald-500/20"
          : "border-destructive/55 bg-destructive/[0.045] shadow-[0_12px_35px_-25px_var(--destructive)]"
      }`}
    >
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold text-muted-foreground">{detail}</p>
            <CardTitle className="mt-1 text-base">{title}</CardTitle>
          </div>
          <Badge variant={block.isValid ? "success" : "danger"}>
            {block.isValid ? (
              <CheckCircle2 aria-hidden="true" className="size-3.5" />
            ) : (
              <AlertTriangle aria-hidden="true" className="size-3.5" />
            )}
            {block.isValid ? "OK" : "エラー"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className="flex items-end gap-1.5"
          role="img"
          aria-label={`${title}。データ ${block.dataBits}、${parityLabel} ${block.parityBit}。${
            block.isValid ? "パリティは正しいです" : "パリティエラーがあります"
          }`}
        >
          {bits.map((bit, localIndex) => {
            const bitIndex = startIndex + localIndex;
            const isParity = localIndex === 3;
            const wasFlipped = flippedBitIndex === bitIndex;
            return (
              <div key={bitIndex} aria-hidden="true" className="space-y-1.5 text-center">
                <span
                  className={`block text-[0.65rem] font-extrabold ${
                    isParity ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {isParity ? parityLabel : `D${localIndex + 1}`}
                </span>
                <span
                  className={`bit-cell size-10 min-h-10 min-w-10 sm:size-11 sm:min-h-11 sm:min-w-11 ${
                    isParity
                      ? "border-primary/35 bg-primary/10 text-primary"
                      : "bg-secondary text-foreground"
                  } ${
                    wasFlipped
                      ? "bit-flip border-amber-500 bg-amber-400/20 text-amber-800 ring-4 ring-amber-400/20 dark:text-amber-200"
                      : ""
                  }`}
                >
                  {bit}
                </span>
              </div>
            );
          })}
        </div>
        <p
          className={`text-sm font-bold ${
            block.isValid
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-destructive"
          }`}
        >
          データと{parityLabel}にある1を合わせると
          {block.isValid ? "偶数個です" : "奇数個です"}
        </p>
      </CardContent>
    </Card>
  );
}

function getSafeInspection(
  fallbackBits: string,
  demoBits: string | null,
): EncodedEntryInspection | null {
  try {
    return inspectEncodedEntry(demoBits ?? fallbackBits);
  } catch {
    return null;
  }
}

export function ParityStep({
  entries,
  colorMode,
  selectedRunIndex,
  onSelectRun,
  demoBits,
  flippedBitIndex,
  onFlip,
  onReset,
}: ParityStepProps) {
  if (entries.length === 0) {
    return (
      <Card className="step-enter">
        <CardHeader>
          <CardTitle>パリティを付けるデータがありません</CardTitle>
          <CardDescription>
            先に「圧縮」のステップで、色のまとまりを作ってください。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const safeIndex =
    selectedRunIndex >= 0 && selectedRunIndex < entries.length
      ? selectedRunIndex
      : 0;
  const selectedEntry = entries[safeIndex];
  const encoded = encodeEntry(selectedEntry);
  const binary = toBinaryRunLengthEntry(selectedEntry);
  const color = getColor(selectedEntry.color, colorMode);
  const inspection = getSafeInspection(encoded.bits, demoBits);

  if (!inspection) {
    return (
      <Card className="step-enter border-destructive/40">
        <CardHeader>
          <CardTitle>bitデータを読み取れませんでした</CardTitle>
          <CardDescription>
            「エラーを元に戻す」を押して、もう一度ためしてください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="secondary" onClick={onReset}>
            <RotateCcw aria-hidden="true" />
            エラーを元に戻す
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasDemo = demoBits !== null;
  const hasError = !inspection.isValid;

  return (
    <section aria-label="パリティのステップ" className="step-enter space-y-4">
      <StepHeading
        step={5}
        eyebrow="EVEN PARITY"
        title="3bitずつ見張り役を付けよう"
        description="個数と色、それぞれ3bitに1bitのパリティを加えます。"
        icon={ShieldCheck}
        trailing={<Badge variant="outline" className="h-8 px-3">6bit + P×2 = 8bit</Badge>}
      />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">調べるまとまりを選ぶ</CardTitle>
          <CardDescription>
            まとまりごとの8bitを確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {entries.map((entry, index) => {
              const itemColor = getColor(entry.color, colorMode);
              const isSelected = safeIndex === index;
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectRun(index)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-bold outline-none transition-[border-color,background-color,box-shadow,transform] focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.98] ${
                    isSelected
                      ? "border-primary/60 bg-primary/10 text-primary ring-2 ring-primary/10"
                      : "bg-background/65 hover:border-primary/30 hover:bg-accent"
                  }`}
                >
                  <span className="block text-xs opacity-70">まとまり {index + 1}</span>
                  <span className="mt-0.5 block truncate">
                    {itemColor.name} × {entry.length}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/35 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-11 rounded-xl border border-black/15 shadow-inner dark:border-white/25"
                style={{ backgroundColor: color.hex }}
              />
              <div>
                <p className="text-xs font-bold text-muted-foreground">
                  まとまり {safeIndex + 1}
                </p>
                <CardTitle className="text-lg">
                  {color.name} × {selectedEntry.length}
                </CardTitle>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">個数 {binary.lengthBits}</Badge>
              <Badge variant="secondary">色 {binary.colorBits}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-3 lg:grid-cols-2">
            <BitBlock
              title="個数・3bit"
              detail={selectedEntry.length === 8 ? "000 は 8" : `個数 ${selectedEntry.length}`}
              parityLabel="P1"
              block={inspection.entry.length}
              startIndex={0}
              flippedBitIndex={flippedBitIndex}
            />
            <BitBlock
              title="色番号・3bit"
              detail={`${color.name}（色番号 ${selectedEntry.color}）`}
              parityLabel="P2"
              block={inspection.entry.color}
              startIndex={4}
              flippedBitIndex={flippedBitIndex}
            />
          </div>

          <div
            role="status"
            aria-live="polite"
            className={`mt-4 rounded-2xl border p-4 sm:flex sm:items-center sm:justify-between sm:gap-5 ${
              hasError
                ? "border-destructive/35 bg-destructive/[0.055]"
                : "border-emerald-500/25 bg-emerald-500/[0.06]"
            }`}
          >
            <div className="flex items-start gap-3">
              {hasError ? (
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-destructive"
                />
              ) : (
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-300"
                />
              )}
              <div>
                <p className="font-extrabold">
                  {hasError ? "エラーを検出しました" : "パリティは正常です"}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {hasError
                    ? inspection.invalidBlocks
                        .map((block) => `${BLOCK_LABELS[block]}に誤りがあります。`)
                        .join(" ")
                    : hasDemo
                      ? "反転したbitを元に戻すと、エラーが消えました。"
                      : "1bitを反転すると、どのブロックで変化したかを見つけられます。"}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-fit sm:flex-row">
              <Button type="button" onClick={onFlip}>
                {hasDemo ? (
                  <RefreshCw aria-hidden="true" />
                ) : (
                  <ShieldCheck aria-hidden="true" />
                )}
                {hasDemo ? "別の1bitを反転" : "1ビットを反転"}
              </Button>
              {hasDemo ? (
                <Button type="button" variant="secondary" onClick={onReset}>
                  <RotateCcw aria-hidden="true" />
                  エラーを元に戻す
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <ExplanationPanel label="パリティビットの詳しい説明">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-black text-foreground">偶数パリティの作り方</h3>
            <p>3bitの中にある1の個数を数え、パリティbitを加えた合計が偶数になるようにPを決めます。</p>
            <div className="grid gap-2 font-mono text-foreground sm:grid-cols-2">
              <p className="rounded-lg bg-background/70 px-3 py-2"><b>101</b>：1が2個 → P=<b>0</b></p>
              <p className="rounded-lg bg-background/70 px-3 py-2"><b>100</b>：1が1個 → P=<b>1</b></p>
            </div>
            <p>この形式では、個数3bitにP1、色3bitにP2を付け、1まとまりを合計8bitにします。</p>
          </div>
          <div className="space-y-2">
            <h3 className="font-black text-foreground">分かること・分からないこと</h3>
            <p>1つのブロックで1bitなど<strong className="text-foreground">奇数個</strong>が変化すると、1の個数が奇数になり、誤りを検出できます。</p>
            <p>ただし、どのbitが変わったかまでは特定できないため、自動では修正できません。また、同じブロックで2bitなど<strong className="text-foreground">偶数個</strong>が変わると見逃すことがあります。</p>
          </div>
        </div>
      </ExplanationPanel>
    </section>
  );
}

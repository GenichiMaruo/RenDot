"use client";

import { Binary, Check, ListTree } from "lucide-react";

import { ExplanationPanel } from "@/components/explanation-panel";
import { StepHeading } from "@/components/step-heading";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getColor, toBinaryRunLengthEntry } from "@/lib";
import type { ColorMode, RunLengthEntry } from "@/lib";

export type BinaryStepProps = {
  entries: RunLengthEntry[];
  colorMode: ColorMode;
  selectedRunIndex: number;
  onSelectRun: (index: number) => void;
};

function speakBits(bits: string): string {
  return bits.split("").join("、");
}

function BitCells({ bits, label }: { bits: string; label: string }) {
  return (
    <div role="group" aria-label={`${label}、${speakBits(bits)}`}>
      <span className="sr-only">{label}、{speakBits(bits)}</span>
      <div aria-hidden="true" className="flex flex-wrap gap-1.5">
        {bits.split("").map((bit, index) => (
          <span
            key={`${index}-${bit}`}
            className="bit-cell size-9 min-h-9 min-w-9 sm:size-10 sm:min-h-10 sm:min-w-10"
          >
            {bit}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BinaryStep({
  entries,
  colorMode,
  selectedRunIndex,
  onSelectRun,
}: BinaryStepProps) {
  const safeIndex =
    selectedRunIndex >= 0 && selectedRunIndex < entries.length
      ? selectedRunIndex
      : 0;

  return (
    <section className="step-enter">
      <StepHeading
        step={4}
        eyebrow="BINARY NUMBERS"
        title="数字を二進数に変換"
        description="個数と色を3bitずつで表します。個数の000は8です。"
        icon={Binary}
        trailing={
          <Badge variant="outline" className="h-8 px-3">
            全 {entries.length} まとまり
          </Badge>
        }
      />

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <ExplanationPanel label="なぜ2進数なのか">
          <div className="space-y-2">
            <p>コンピューターの回路は、電気が<strong className="text-foreground">低い／高い</strong>という2つの状態を区別するのが得意です。その2状態を0と1に対応させています。</p>
            <p>2状態なら多少の電圧の揺れがあっても判定しやすく、コピーや計算を安定して行えます。0と1の組み合わせを増やせば、色・文字・画像も同じ仕組みで表せます。</p>
          </div>
        </ExplanationPanel>

        <ExplanationPanel label="2進数の仕組み">
          <div className="space-y-3">
            <p>右から順に、位の値が<strong className="text-foreground">1、2、4、8…</strong>と2倍になります。1になっている位だけを足すと、いつもの10進数になります。</p>
            <div className="grid grid-cols-3 gap-2 text-center font-mono">
              <div className="rounded-lg bg-secondary p-2"><span className="block text-xs">4の位</span><b>1</b></div>
              <div className="rounded-lg bg-secondary p-2"><span className="block text-xs">2の位</span><b>0</b></div>
              <div className="rounded-lg bg-secondary p-2"><span className="block text-xs">1の位</span><b>1</b></div>
            </div>
            <p className="rounded-lg bg-background/70 px-3 py-2 font-mono font-black text-foreground">101 = 4 + 0 + 1 = 5</p>
            <p>3bitでは000〜111、つまり0〜7の8通りを表せます。このアプリの個数だけは、独自の決まりとして<strong className="text-foreground">000を8</strong>に割り当てています。</p>
          </div>
        </ExplanationPanel>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>二進数にするデータがありません</CardTitle>
            <CardDescription>
              先に「圧縮」のステップで、色のまとまりを作ってください。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(19rem,0.78fr)_minmax(0,1.22fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/25 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTree aria-hidden="true" className="size-5 text-primary" />
                まとまりを選ぶ
              </CardTitle>
              <CardDescription>
                全{entries.length}件です。一覧の中を上下にスクロールできます。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              <ul
                aria-label="二進数に変換したすべてのまとまり"
                className="max-h-[27rem] space-y-1.5 overflow-y-auto overscroll-contain p-2.5 sm:max-h-[31rem] sm:p-3 lg:max-h-[36rem]"
              >
                {entries.map((entry, index) => {
                  const binary = toBinaryRunLengthEntry(entry);
                  const color = getColor(entry.color, colorMode);
                  const isSelected = safeIndex === index;
                  const accessibleLabel = [
                    `まとまり${index + 1}`,
                    `${color.name}`,
                    `実際の個数${binary.originalLength}`,
                    binary.originalLength === 8 ? "000は個数8" : `個数${binary.originalLength}`,
                    `個数の3bit、${speakBits(binary.lengthBits)}`,
                    `色番号${entry.color}`,
                    `色の3bit、${speakBits(binary.colorBits)}`,
                    isSelected ? "選択中" : "選んで詳しく見る",
                  ].join("。 ");

                  return (
                    <li key={index}>
                      <button
                        type="button"
                        aria-label={accessibleLabel}
                        aria-pressed={isSelected}
                        onClick={() => onSelectRun(index)}
                        className={`grid min-h-20 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left outline-none transition-[border-color,background-color,box-shadow,transform] focus-visible:ring-4 focus-visible:ring-ring/25 active:scale-[0.99] sm:grid-cols-[auto_minmax(7rem,0.75fr)_minmax(9rem,1.25fr)] ${
                          isSelected
                            ? "border-primary/60 bg-primary/10 ring-2 ring-primary/10"
                            : "border-border bg-background/65 hover:border-primary/30 hover:bg-accent/60"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="size-9 rounded-lg border border-black/15 shadow-inner dark:border-white/25"
                          style={{ backgroundColor: color.hex }}
                        />

                        <span aria-hidden="true" className="min-w-0">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                            #{index + 1}
                            {isSelected ? (
                              <span className="inline-flex items-center gap-1 text-primary">
                                <Check className="size-3.5" /> 選択中
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate text-sm font-extrabold">
                            {color.name} × {entry.length}
                          </span>
                        </span>

                        <span
                          aria-hidden="true"
                          className="col-span-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-secondary/75 px-2.5 py-2 text-xs sm:col-span-1"
                        >
                          <span className="text-muted-foreground">個数 {binary.originalLength}</span>
                          <span className="truncate text-right font-mono font-black tabular-nums">{binary.lengthBits}</span>
                          <span className="text-muted-foreground">色番号 {entry.color}</span>
                          <span className="truncate text-right font-mono font-black tabular-nums">{binary.colorBits}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {(() => {
            const entry = entries[safeIndex];
            const binary = toBinaryRunLengthEntry(entry);
            const color = getColor(entry.color, colorMode);

            return (
              <Card className="overflow-hidden lg:sticky lg:top-4">
                <CardHeader className="border-b bg-muted/35 pb-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="size-11 shrink-0 rounded-xl border border-black/15 shadow-inner dark:border-white/25"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-muted-foreground">
                          選択中のまとまり {safeIndex + 1}
                        </p>
                        <CardTitle className="truncate text-lg">
                          {color.name} × {entry.length}
                        </CardTitle>
                      </div>
                    </div>
                    <Badge>詳しい変換</Badge>
                  </div>
                </CardHeader>

                <CardContent className="grid gap-4 pt-5 sm:pt-6">
                  <div className="rounded-2xl border bg-background/65 p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold">個数を3bitにする</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          個数 <strong className="text-foreground">{binary.originalLength}</strong>
                          {binary.originalLength === 8 ? <span> は 000 として保存</span> : null}
                        </p>
                      </div>
                      <Badge variant="secondary">3bit</Badge>
                    </div>
                    <BitCells bits={binary.lengthBits} label={`個数${binary.originalLength}の3bit`} />
                  </div>

                  <div className="rounded-2xl border bg-background/65 p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-extrabold">色番号を3bitにする</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          色は <strong className="text-foreground">{color.name}</strong>
                          <span aria-hidden="true">・</span>
                          色番号 <strong className="text-foreground">{entry.color}</strong>
                        </p>
                      </div>
                      <Badge variant="secondary">3bit</Badge>
                    </div>
                    <BitCells bits={binary.colorBits} label={`色番号${entry.color}の3bit`} />
                  </div>

                  <div className="rounded-2xl bg-primary/[0.06] px-4 py-3 text-sm leading-6 text-muted-foreground">
                    <strong className="text-foreground">合計6bit。</strong>
                    次に、各3bitへパリティを1bitずつ加えます。
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </div>
      )}
    </section>
  );
}

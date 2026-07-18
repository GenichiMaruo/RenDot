"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  CheckCircle2,
  Image as ImageIcon,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  UnfoldHorizontal,
} from "lucide-react";

import { PixelGrid } from "@/components/pixel-grid";
import { StepHeading } from "@/components/step-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  gridsAreEqual,
  inspectQrLikeData,
  PIXEL_COUNT,
  restorePixelGrid,
  toUserMessage,
  type PixelGrid as PixelGridData,
  type QrLikeData,
} from "@/lib";
import { cn } from "@/lib/utils";

type RestoreStepProps = {
  originalGrid: PixelGridData;
  data: QrLikeData;
  onReturnToFix: () => void;
  onCompletionChange: (complete: boolean) => void;
};

type RestoreStatus = "idle" | "running" | "needs-choice" | "success" | "failure";

type RestoreDiagnostics = {
  parityIssues: Array<{
    entryIndex: number;
    block: "length" | "color";
  }>;
  decodedPixelCount: number;
};

const PHASES = [
  { label: "ヘッダーを読んでいます", icon: ScanLine },
  { label: "パリティを確認しています", icon: ShieldCheck },
  { label: "圧縮データを広げています", icon: UnfoldHorizontal },
  { label: "画像に戻しています", icon: ImageIcon },
] as const;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function RestoreDiagnosticsPanel({
  diagnostics,
  overflowWasDiscarded = false,
}: {
  diagnostics: RestoreDiagnostics;
  overflowWasDiscarded?: boolean;
}) {
  const overflow = Math.max(0, diagnostics.decodedPixelCount - PIXEL_COUNT);
  const missing = Math.max(0, PIXEL_COUNT - diagnostics.decodedPixelCount);
  if (diagnostics.parityIssues.length === 0 && overflow === 0 && missing === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4" role="status">
      <p className="font-black text-amber-800 dark:text-amber-200">検出したエラーの詳細</p>
      <ul className="mt-2 grid gap-2 text-sm leading-6">
        {diagnostics.parityIssues.map((issue) => (
          <li key={`${issue.entryIndex}-${issue.block}`} className="rounded-xl bg-background/75 px-3 py-2">
            <b>{issue.entryIndex + 1}個目のまとまり</b>
            ：{issue.block === "length" ? "個数（P1）" : "色（P2）"}のパリティエラー
          </li>
        ))}
        {overflow > 0 ? (
          <li className="rounded-xl bg-background/75 px-3 py-2">
            <b>個数エラー</b>
            ：合計{diagnostics.decodedPixelCount}マスで、{overflow}マス長くなっています。
            {overflowWasDiscarded ? (
              <> {PIXEL_COUNT + 1}〜{diagnostics.decodedPixelCount}マス目は無効として復元しました。</>
            ) : (
              <> 強制復元では{PIXEL_COUNT + 1}〜{diagnostics.decodedPixelCount}マス目を無効にします。</>
            )}
          </li>
        ) : null}
        {missing > 0 ? (
          <li className="rounded-xl bg-background/75 px-3 py-2">
            <b>個数エラー</b>
            ：合計{diagnostics.decodedPixelCount}マスで、{missing}マス不足しています。8×8に復元できません。
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function RestoreStep({ originalGrid, data, onReturnToFix, onCompletionChange }: RestoreStepProps) {
  const [status, setStatus] = useState<RestoreStatus>("idle");
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [restoredGrid, setRestoredGrid] = useState<PixelGridData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<RestoreDiagnostics | null>(null);

  const runRestore = async (forceRestore = false) => {
    onCompletionChange(false);
    setStatus("running");
    setRestoredGrid(null);
    setErrorMessage(null);
    setDiagnostics(null);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduceMotion ? 40 : 360;

    try {
      setPhaseIndex(0);
      await wait(delay);
      const inspection = inspectQrLikeData(data);
      const nextDiagnostics: RestoreDiagnostics = {
        parityIssues: inspection.parityIssues,
        decodedPixelCount: inspection.decodedPixelCount,
      };
      setDiagnostics(nextDiagnostics);

      setPhaseIndex(1);
      await wait(delay);
      const hasParityError = !inspection.isParityValid;
      const hasOverflow = inspection.decodedPixelCount > PIXEL_COUNT;
      if ((hasParityError || hasOverflow) && !forceRestore) {
        setStatus("needs-choice");
        return;
      }

      setPhaseIndex(2);
      await wait(delay);
      const grid = restorePixelGrid(data, {
        validateParity: !forceRestore,
        truncateOverflow: forceRestore,
      });

      setPhaseIndex(3);
      await wait(delay);
      setRestoredGrid(grid);
      setStatus("success");
      onCompletionChange(true);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
      setStatus("failure");
    }
  };

  const matches = restoredGrid ? gridsAreEqual(originalGrid, restoredGrid) : false;

  return (
    <section className="step-enter">
      <StepHeading
        step={7}
        eyebrow="DECODE & RESTORE"
        title="データから絵を復元"
        description="ヘッダーとパリティを検証し、64マスへ戻します。"
        icon={RotateCcw}
        trailing={<Badge variant="secondary" className="h-8 px-3">最後の実験</Badge>}
      />

      {status === "idle" ? (
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="relative grid min-h-[24rem] place-items-center p-6 text-center">
            <div className="lab-grid-bg pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
            <div className="relative max-w-lg">
              <div className="mx-auto mb-5 grid size-20 place-items-center rounded-3xl bg-primary/12 text-primary ring-1 ring-primary/20">
                <RotateCcw className="size-9" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">復元を開始</h2>
              <Button size="lg" className="mt-6 min-w-52" onClick={() => void runRestore()}>
                <ScanLine aria-hidden="true" />
                復元する
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {status === "running" ? (
        <Card>
          <CardHeader className="pb-4 text-center">
            <CardTitle>データを読み取っています</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mx-auto grid max-w-xl gap-2" aria-live="polite" aria-busy="true">
              {PHASES.map((phase, index) => {
                const Icon = phase.icon;
                const complete = index < phaseIndex;
                const active = index === phaseIndex;
                return (
                  <div key={phase.label}>
                    <div
                      className={cn(
                        "flex min-h-16 items-center gap-3 rounded-2xl border px-4 transition",
                        active && "border-primary/35 bg-primary/10",
                        complete && "border-emerald-500/25 bg-emerald-500/8",
                        !active && !complete && "opacity-45",
                      )}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary">
                        {active ? (
                          <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden="true" />
                        ) : complete ? (
                          <Check className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        ) : (
                          <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </span>
                      <span className="font-bold">{phase.label}</span>
                    </div>
                    {index < PHASES.length - 1 ? (
                      <ArrowDown className="mx-auto my-1 size-4 text-muted-foreground/60" aria-hidden="true" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {status === "needs-choice" ? (
        <Card className="border-amber-500/35">
          <CardContent className="grid gap-5 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-500/12 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="size-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black">データに誤りが見つかりました</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {diagnostics?.parityIssues.length
                    ? "このまま復元すると画像が崩れる可能性があります。パリティは誤りを見つけますが、勝手には直しません。"
                    : "個数の合計が64マスを超えています。余ったマスを無効にすれば、8×8として強制復元できます。"}
                </p>
              </div>
            </div>
            {diagnostics ? <RestoreDiagnosticsPanel diagnostics={diagnostics} /> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="secondary" onClick={onReturnToFix}>
                <RotateCcw aria-hidden="true" />
                エラーを直して戻る
              </Button>
              <Button onClick={() => void runRestore(true)}>
                そのまま復元してみる
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {status === "failure" ? (
        <Card className="border-destructive/35">
          <CardContent className="grid gap-5 p-6 sm:p-8">
            <div className="flex items-start gap-4" role="alert">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-black">正常に復元できませんでした</h2>
                <p className="mt-2 text-sm font-bold leading-6 text-destructive">{errorMessage}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  ヘッダーや個数が変わると、64マスの絵に戻せないことがあります。
                </p>
              </div>
            </div>
            {diagnostics ? <RestoreDiagnosticsPanel diagnostics={diagnostics} /> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onReturnToFix}>QRライクデータに戻る</Button>
              <Button variant="ghost" onClick={() => { setStatus("idle"); setPhaseIndex(-1); setDiagnostics(null); }}>もう一度ためす</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {status === "success" && restoredGrid ? (
        <div className="grid gap-4">
          <Card className={matches ? "border-emerald-500/35" : "border-amber-500/35"}>
            <CardContent className="flex items-start gap-4 p-5 sm:p-6" aria-live="polite">
              <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", matches ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/12 text-amber-700 dark:text-amber-300") }>
                {matches ? <CheckCircle2 className="size-6" aria-hidden="true" /> : <AlertTriangle className="size-6" aria-hidden="true" />}
              </div>
              <div>
                <h2 className="text-xl font-black">
                  {matches ? "元の画像と一致しました" : "元の画像と一致しませんでした"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {matches
                    ? "数字になっても、決めたルールを逆にたどれば絵へ戻せます。"
                    : "反転したbitが色や個数を変えたため、絵が崩れています。"}
                  {diagnostics?.parityIssues.length && matches ? " 今回は誤りが絵の形に影響しない場所でした。" : ""}
                </p>
              </div>
            </CardContent>
          </Card>

          {diagnostics ? (
            <RestoreDiagnosticsPanel
              diagnostics={diagnostics}
              overflowWasDiscarded={diagnostics.decodedPixelCount > PIXEL_COUNT}
            />
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-4"><CardTitle>もとの画像</CardTitle></CardHeader>
              <CardContent>
                <div className="mx-auto w-full max-w-[30rem]">
                  <PixelGrid grid={originalGrid} readOnly ariaLabel="もとのドット絵" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4"><CardTitle>復元した画像</CardTitle></CardHeader>
              <CardContent>
                <div className="mx-auto w-full max-w-[30rem] pop-in">
                  <PixelGrid grid={restoredGrid} readOnly ariaLabel="QRライクデータから復元したドット絵" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-center">
            <Button variant="secondary" onClick={() => { onCompletionChange(false); setStatus("idle"); setPhaseIndex(-1); setRestoredGrid(null); setDiagnostics(null); }}>
              <RotateCcw aria-hidden="true" />
              もう一度復元する
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import * as React from "react";
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Moon,
  RotateCcw,
  ScanLine,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export type SaveStatus = "saved" | "saving" | "unsaved";

export type AppHeaderProps = {
  onReset: () => void;
  onOpenScanner?: () => void;
  saveStatus?: SaveStatus;
  resetDisabled?: boolean;
  title?: string;
  subtitle?: string;
  className?: string;
};

const LOGO_COLORS = [3, 6, 2, 5, 4, 7, 1, 3] as const;

const SAVE_STATUS_CONTENT: Record<
  SaveStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  saved: {
    label: "このiPadに保存済み",
    icon: CheckCircle2,
    className:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  saving: {
    label: "保存しています",
    icon: LoaderCircle,
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  unsaved: {
    label: "保存待ち",
    icon: CircleAlert,
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};

/**
 * The compact global header. Theme switching and reset confirmation are kept
 * here so every step exposes them in the same place.
 */
export function AppHeader({
  onReset,
  onOpenScanner,
  saveStatus = "saved",
  resetDisabled = false,
  title = "ドットをデータに変えてみよう",
  subtitle = "RenDot",
  className,
}: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const status = SAVE_STATUS_CONTENT[saveStatus];
  const StatusIcon = status.icon;

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <header
      className={cn(
        "relative z-30 border-b border-border/75 bg-background/85 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex min-h-13 w-full max-w-7xl items-center gap-2 px-3 sm:px-5 lg:px-8">
        <div
          aria-hidden="true"
          className="grid size-9 shrink-0 grid-cols-3 gap-0.5 rounded-lg border border-border/80 bg-card p-1 shadow-sm"
        >
          {LOGO_COLORS.map((colorId, index) => (
            <span
              // The empty ninth space makes the mark feel like a drawing in progress.
              key={`${colorId}-${index}`}
              className="rounded-[2px]"
              style={{ backgroundColor: COLORS[colorId].hex }}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-black tracking-[0.2em] text-primary uppercase">
            {subtitle}
          </p>
          <p className="truncate text-sm font-extrabold tracking-tight text-foreground sm:text-base">
            {title}
          </p>
        </div>

        <Badge
          aria-live="polite"
          className={cn(
            "hidden min-h-9 gap-2 px-3 min-[560px]:inline-flex",
            status.className,
          )}
          variant="outline"
        >
          <StatusIcon
            aria-hidden="true"
            className={cn("size-4", saveStatus === "saving" && "animate-spin")}
          />
          <span className="hidden lg:inline">{status.label}</span>
          <span className="lg:hidden">
            {saveStatus === "saved"
              ? "保存済み"
              : saveStatus === "saving"
                ? "保存中"
                : "保存待ち"}
          </span>
        </Badge>

        <Button
          aria-label="QRライクを読み取る"
          className="size-11 px-0 min-[760px]:w-auto min-[760px]:px-3.5"
          onClick={onOpenScanner}
          title="QRライクを読み取る"
          type="button"
          variant="secondary"
        >
          <ScanLine aria-hidden="true" />
          <span className="hidden min-[760px]:inline">読み取る</span>
        </Button>

        <Button
          aria-label="表示テーマを切り替える"
          onClick={toggleTheme}
          size="icon"
          title="表示テーマを切り替える"
          type="button"
          variant="secondary"
        >
          <Moon aria-hidden="true" className="dark:hidden" />
          <Sun aria-hidden="true" className="hidden dark:block" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              aria-label="最初からやり直す"
              className="size-11 px-0 min-[760px]:w-auto min-[760px]:px-3.5"
              disabled={resetDisabled}
              size="default"
              title="最初からやり直す"
              type="button"
              variant="danger"
            >
              <RotateCcw aria-hidden="true" />
              <span className="hidden min-[760px]:inline">最初から</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>最初からやり直しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                描いたドット絵と、途中まで進めたデータをこのiPadから消します。作品棚へ保存した絵は残ります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>このまま続ける</AlertDialogCancel>
              <AlertDialogAction onClick={onReset}>最初からやり直す</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </header>
  );
}

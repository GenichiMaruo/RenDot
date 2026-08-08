"use client";

import { useState } from "react";
import { AlertTriangle, Pencil, RotateCcw, ScanLine } from "lucide-react";

import { CameraReader } from "@/components/camera-reader";
import { PixelGrid } from "@/components/pixel-grid";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getColorModeDefinition,
  restoreQrLikeArtwork,
  toUserMessage,
  type QrLikeData,
  type RestoredQrLikeArtwork,
} from "@/lib";

type StandaloneScannerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseArtwork: (artwork: RestoredQrLikeArtwork) => void;
};

export function StandaloneScanner({ open, onOpenChange, onUseArtwork }: StandaloneScannerProps) {
  const [scannedArtwork, setScannedArtwork] = useState<RestoredQrLikeArtwork | null>(null);
  const [scanSession, setScanSession] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetPreview = () => {
    setScannedArtwork(null);
    setErrorMessage(null);
    setScanSession((value) => value + 1);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetPreview();
    onOpenChange(nextOpen);
  };

  const handleDecoded = (data: QrLikeData) => {
    try {
      setScannedArtwork(restoreQrLikeArtwork(data));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(toUserMessage(error));
      setScanSession((value) => value + 1);
    }
  };

  const useScannedGrid = () => {
    if (!scannedArtwork) return;
    onUseArtwork(scannedArtwork);
    handleOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-5xl gap-4 overflow-y-auto p-3 sm:w-[calc(100%-2rem)] sm:p-5">
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
              <ScanLine className="size-5" aria-hidden="true" />
            </span>
            <AlertDialogTitle>QRライクを読み取る</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            読み取った絵は一時プレビューに表示します。制作中の絵は自動では変更されません。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {scannedArtwork ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(15rem,1fr)_minmax(12rem,.75fr)] sm:items-center">
            <div className="mx-auto w-full max-w-[28rem] rounded-2xl border bg-background/60 p-3">
              <PixelGrid
                grid={scannedArtwork.grid}
                colorMode={scannedArtwork.colorMode}
                readOnly
                ariaLabel="読み取ったドット絵の一時プレビュー"
              />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">未反映</Badge>
                <Badge variant="outline">
                  {getColorModeDefinition(scannedArtwork.colorMode).name}
                </Badge>
              </div>
              <div>
                <h3 className="text-lg font-black">読み取った絵</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  この画面を閉じるまでの一時表示です。編集を選ぶまで、さきほどの絵は残ります。
                </p>
              </div>
              <Button type="button" variant="secondary" className="w-full" onClick={resetPreview}>
                <RotateCcw aria-hidden="true" />
                別のコードを読む
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {errorMessage ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-sm font-bold text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {errorMessage}
              </p>
            ) : null}
            <CameraReader key={scanSession} onDecoded={handleDecoded} />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>閉じる</AlertDialogCancel>
          {scannedArtwork ? (
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={useScannedGrid}
            >
              <Pencil aria-hidden="true" />
              この絵を編集する
            </AlertDialogAction>
          ) : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

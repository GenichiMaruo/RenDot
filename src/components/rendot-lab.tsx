"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { AppHeader, type SaveStatus } from "@/components/app-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { CreatorCredit } from "@/components/creator-credit";
import { StandaloneScanner } from "@/components/standalone-scanner";
import { StepNavigation, DEFAULT_WORKSHOP_STEPS } from "@/components/step-navigation";
import { BinaryStep } from "@/components/steps/binary-step";
import { CompressionStep } from "@/components/steps/compression-step";
import { NumberStep } from "@/components/steps/number-step";
import { ParityStep } from "@/components/steps/parity-step";
import { PixelStep } from "@/components/steps/pixel-step";
import { QrLikeStep } from "@/components/steps/qr-like-step";
import { RestoreStep } from "@/components/steps/restore-step";
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
import {
  buildQrLikeData,
  cloneGrid,
  createEmptyGrid,
  DATA_BIT_INDICES,
  DEFAULT_COLOR_MODE,
  encodeEntry,
  encodeRunLength,
  flattenGrid,
  flipBit,
  flipQrLikeBit,
  gridsAreEqual,
  getQrLikeCellInfo,
  isColorMode,
  validateGrid,
  type ColorId,
  type ColorMode,
  type PixelGrid,
  type SavedArtwork,
} from "@/lib";

const STORAGE_KEY = "rendot:workshop:v3";
const STORAGE_VERSION = 4;
const ARTWORK_STORAGE_KEY = "rendot:artworks:v1";
const ARTWORK_STORAGE_VERSION = 2;
const MAX_SAVED_ARTWORKS = 8;
const LAST_STEP_INDEX = DEFAULT_WORKSHOP_STEPS.length - 1;

type StoredWorkshopState = {
  version: number;
  grid: PixelGrid;
  colorMode: ColorMode;
  currentStep: number;
  unlockedThrough: number;
  qrFlipHistory: number[];
};

type StoredArtworkGallery = {
  version: number;
  artworks: SavedArtwork[];
};

type ArtworkSnapshot = {
  grid: PixelGrid;
  colorMode: ColorMode;
};

function clampStep(value: unknown, fallback = 0): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(Math.max(Number(value), 0), LAST_STEP_INDEX);
}

function gridsMatch(left: PixelGrid, right: PixelGrid): boolean {
  try {
    return gridsAreEqual(left, right);
  } catch {
    return false;
  }
}

export function RenDotLab() {
  const [grid, setGrid] = useState<PixelGrid>(() => createEmptyGrid());
  const [colorMode, setColorMode] = useState<ColorMode>(DEFAULT_COLOR_MODE);
  const [selectedColor, setSelectedColor] = useState<ColorId>(2);
  const [past, setPast] = useState<ArtworkSnapshot[]>([]);
  const [future, setFuture] = useState<ArtworkSnapshot[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [unlockedThrough, setUnlockedThrough] = useState(0);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(null);
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [parityDemoBits, setParityDemoBits] = useState<string | null>(null);
  const [parityFlippedBitIndex, setParityFlippedBitIndex] = useState<number | null>(null);
  const [qrFlipHistory, setQrFlipHistory] = useState<number[]>([]);
  const [selectedQrIndex, setSelectedQrIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("unsaved");
  const [hydrated, setHydrated] = useState(false);
  const [storageResetToken, setStorageResetToken] = useState(0);
  const [restoreCompleted, setRestoreCompleted] = useState(false);
  const [workshopCompleted, setWorkshopCompleted] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [savedArtworks, setSavedArtworks] = useState<SavedArtwork[]>([]);
  const skipNextSaveRef = useRef(false);
  const hydratedRef = useRef(false);
  const latestStateRef = useRef<StoredWorkshopState>({
    version: STORAGE_VERSION,
    grid: createEmptyGrid(),
    colorMode: DEFAULT_COLOR_MODE,
    currentStep: 0,
    unlockedThrough: 0,
    qrFlipHistory: [],
  });
  const mainRef = useRef<HTMLElement>(null);

  const entries = useMemo(() => encodeRunLength(flattenGrid(grid)), [grid]);
  const currentSavedArtworkId = useMemo(
    () =>
      savedArtworks.find(
        (artwork) => artwork.colorMode === colorMode && gridsMatch(artwork.grid, grid),
      )?.id ?? null,
    [colorMode, grid, savedArtworks],
  );
  const baseQrData = useMemo(
    () => buildQrLikeData(entries, { colorMode }),
    [colorMode, entries],
  );
  const qrData = useMemo(
    () =>
      qrFlipHistory.reduce(
        (data, index) => {
          if (index < 0 || index >= data.displayBits.length) return data;
          try {
            return flipQrLikeBit(data, index);
          } catch {
            return data;
          }
        },
        baseQrData,
      ),
    [baseQrData, qrFlipHistory],
  );
  const modifiedQrIndices = useMemo(() => {
    const oddFlips = new Set<number>();
    qrFlipHistory.forEach((index) => {
      try {
        const region = getQrLikeCellInfo(baseQrData, index).region;
        if (region === "marker" || region === "timing") return;
      } catch {
        return;
      }
      if (oddFlips.has(index)) oddFlips.delete(index);
      else oddFlips.add(index);
    });
    return oddFlips;
  }, [baseQrData, qrFlipHistory]);

  const resetDerivedState = useCallback(() => {
    setCurrentStep(0);
    setUnlockedThrough(0);
    setSelectedCellIndex(null);
    setSelectedRunIndex(0);
    setParityDemoBits(null);
    setParityFlippedBitIndex(null);
    setQrFlipHistory([]);
    setSelectedQrIndex(null);
    setRestoreCompleted(false);
    setWorkshopCompleted(false);
    setCompletionOpen(false);
    setScannerOpen(false);
  }, []);

  const replaceArtwork = useCallback(
    (
      nextGrid: PixelGrid,
      nextColorMode: ColorMode = colorMode,
      previousGrid: PixelGrid = grid,
      previousColorMode: ColorMode = colorMode,
    ) => {
      if (
        previousColorMode === nextColorMode &&
        gridsMatch(previousGrid, nextGrid)
      ) return;
      setPast((history) => [
        ...history.slice(-39),
        { grid: cloneGrid(previousGrid), colorMode: previousColorMode },
      ]);
      setFuture([]);
      setGrid(cloneGrid(nextGrid));
      setColorMode(nextColorMode);
      resetDerivedState();
      setSaveStatus("unsaved");
    },
    [colorMode, grid, resetDerivedState],
  );

  const replaceGrid = useCallback(
    (nextGrid: PixelGrid, previousGrid: PixelGrid = grid) => {
      replaceArtwork(nextGrid, colorMode, previousGrid, colorMode);
    },
    [colorMode, grid, replaceArtwork],
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((history) => history.slice(0, -1));
    setFuture((history) => [
      { grid: cloneGrid(grid), colorMode },
      ...history,
    ].slice(0, 40));
    setGrid(cloneGrid(previous.grid));
    setColorMode(previous.colorMode);
    resetDerivedState();
    setSaveStatus("unsaved");
  }, [colorMode, grid, past, resetDerivedState]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((history) => history.slice(1));
    setPast((history) => [
      ...history.slice(-39),
      { grid: cloneGrid(grid), colorMode },
    ]);
    setGrid(cloneGrid(next.grid));
    setColorMode(next.colorMode);
    resetDerivedState();
    setSaveStatus("unsaved");
  }, [colorMode, future, grid, resetDerivedState]);

  const persistSavedArtworks = useCallback((artworks: SavedArtwork[]) => {
    const limited = artworks.slice(0, MAX_SAVED_ARTWORKS);
    setSavedArtworks(limited);
    try {
      const stored: StoredArtworkGallery = {
        version: ARTWORK_STORAGE_VERSION,
        artworks: limited,
      };
      window.localStorage.setItem(ARTWORK_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Saved works remain available for this session if storage is unavailable.
    }
  }, []);

  const handleSaveArtwork = useCallback(() => {
    if (currentSavedArtworkId || savedArtworks.length >= MAX_SAVED_ARTWORKS) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    persistSavedArtworks([
      ...savedArtworks,
      { id, grid: cloneGrid(grid), colorMode, savedAt: Date.now() },
    ]);
  }, [colorMode, currentSavedArtworkId, grid, persistSavedArtworks, savedArtworks]);

  const handleDeleteArtwork = useCallback((id: string) => {
    persistSavedArtworks(savedArtworks.filter((artwork) => artwork.id !== id));
  }, [persistSavedArtworks, savedArtworks]);

  const handleRunSelection = useCallback(
    (index: number) => {
      const safeIndex = Math.min(Math.max(index, 0), Math.max(entries.length - 1, 0));
      setSelectedRunIndex(safeIndex);
      setParityDemoBits(null);
      setParityFlippedBitIndex(null);
    },
    [entries.length],
  );

  const handleParityFlip = useCallback(() => {
    const canonicalBits = encodeEntry(entries[selectedRunIndex]).bits;
    const candidates = DATA_BIT_INDICES.filter((index) => index !== parityFlippedBitIndex);
    const chosenIndex = candidates[Math.floor(Math.random() * candidates.length)];
    setParityDemoBits(flipBit(canonicalBits, chosenIndex));
    setParityFlippedBitIndex(chosenIndex);
  }, [entries, parityFlippedBitIndex, selectedRunIndex]);

  const announceStepChange = useCallback(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep >= LAST_STEP_INDEX) {
      if (restoreCompleted) {
        setWorkshopCompleted(true);
        setCompletionOpen(true);
      }
      return;
    }
    const nextStep = currentStep + 1;
    if (nextStep === LAST_STEP_INDEX) {
      setRestoreCompleted(false);
      setWorkshopCompleted(false);
    }
    setUnlockedThrough((value) => Math.max(value, nextStep));
    setCurrentStep(nextStep);
    announceStepChange();
  }, [announceStepChange, currentStep, restoreCompleted]);

  const handleBack = useCallback(() => {
    if (currentStep <= 0) return;
    setCurrentStep((value) => Math.max(value - 1, 0));
    announceStepChange();
  }, [announceStepChange, currentStep]);

  const handleStepChange = useCallback(
    (index: number) => {
      const allowedThrough =
        currentStep === 4 && parityDemoBits !== null ? 4 : unlockedThrough;
      if (index < 0 || index > allowedThrough) return;
      setCurrentStep(index);
      announceStepChange();
    },
    [announceStepChange, currentStep, parityDemoBits, unlockedThrough],
  );

  const handleReset = useCallback(() => {
    skipNextSaveRef.current = true;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // The app remains usable when private browsing blocks storage.
    }
    setGrid(createEmptyGrid());
    setColorMode(DEFAULT_COLOR_MODE);
    setSelectedColor(2);
    setPast([]);
    setFuture([]);
    resetDerivedState();
    setStorageResetToken((value) => value + 1);
    setSaveStatus("unsaved");
  }, [resetDerivedState]);

  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(ARTWORK_STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as Partial<StoredArtworkGallery>;
        if (
          (stored.version !== 1 && stored.version !== ARTWORK_STORAGE_VERSION) ||
          !Array.isArray(stored.artworks)
        ) {
          throw new Error("Unsupported artwork storage version");
        }
        const restored = stored.artworks.slice(0, MAX_SAVED_ARTWORKS).map((artwork) => {
          if (!artwork || typeof artwork.id !== "string" || !Number.isFinite(artwork.savedAt)) {
            throw new Error("Invalid saved artwork");
          }
          validateGrid(artwork.grid);
          const restoredColorMode = isColorMode(artwork.colorMode)
            ? artwork.colorMode
            : stored.version === 1
              ? DEFAULT_COLOR_MODE
              : null;
          if (!restoredColorMode) throw new Error("Invalid saved artwork color mode");
          return {
            id: artwork.id,
            grid: cloneGrid(artwork.grid),
            colorMode: restoredColorMode,
            savedAt: artwork.savedAt,
          };
        });
        setSavedArtworks(restored);
      } catch {
        try {
          window.localStorage.removeItem(ARTWORK_STORAGE_KEY);
        } catch {
          // Keep the gallery empty when storage cannot be repaired.
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    hydratedRef.current = hydrated;
    latestStateRef.current = {
      version: STORAGE_VERSION,
      grid,
      colorMode,
      currentStep,
      unlockedThrough,
      qrFlipHistory,
    };
  }, [colorMode, currentStep, grid, hydrated, qrFlipHistory, unlockedThrough]);

  useEffect(() => {
    const flushLatestState = () => {
      if (!hydratedRef.current || skipNextSaveRef.current) return;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(latestStateRef.current));
      } catch {
        // Storage can be unavailable in private browsing; in-memory work continues.
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushLatestState();
    };

    window.addEventListener("pagehide", flushLatestState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushLatestState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw) as Partial<StoredWorkshopState>;
          if (stored.version !== 3 && stored.version !== STORAGE_VERSION) {
            throw new Error("Unsupported save version");
          }
          validateGrid(stored.grid);
          const restoredColorMode = isColorMode(stored.colorMode)
            ? stored.colorMode
            : stored.version === 3
              ? DEFAULT_COLOR_MODE
              : null;
          if (!restoredColorMode) throw new Error("Invalid color mode");
          const restoredGrid = cloneGrid(stored.grid);
          const restoredEntries = encodeRunLength(flattenGrid(restoredGrid));
          const restoredQr = buildQrLikeData(restoredEntries, {
            colorMode: restoredColorMode,
          });
          const restoredStep = clampStep(stored.currentStep);
          const restoredUnlocked = Math.max(
            restoredStep,
            clampStep(stored.unlockedThrough, restoredStep),
          );
          const restoredFlips = Array.isArray(stored.qrFlipHistory)
            ? stored.qrFlipHistory.filter(
                (index): index is number =>
                  Number.isInteger(index) && index >= 0 && index < restoredQr.displayBits.length,
              )
            : [];

          setGrid(restoredGrid);
          setColorMode(restoredColorMode);
          setCurrentStep(restoredStep);
          setUnlockedThrough(restoredUnlocked);
          setQrFlipHistory(restoredFlips);
          setSaveStatus("saved");
        }
      } catch {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore storage access failures and keep the safe initial state.
        }
        setSaveStatus("unsaved");
      } finally {
        setHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setSaveStatus("saving");
    const timeout = window.setTimeout(() => {
      const state: StoredWorkshopState = {
        version: STORAGE_VERSION,
        grid,
        colorMode,
        currentStep,
        unlockedThrough,
        qrFlipHistory,
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        setSaveStatus("saved");
      } catch {
        setSaveStatus("unsaved");
      }
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [colorMode, currentStep, grid, hydrated, qrFlipHistory, storageResetToken, unlockedThrough]);

  const renderedStep = (() => {
    switch (currentStep) {
      case 0:
        return (
          <PixelStep
            grid={grid}
            colorMode={colorMode}
            selectedColor={selectedColor}
            onColorModeChange={(nextColorMode) => {
              replaceArtwork(grid, nextColorMode, grid, colorMode);
            }}
            onSelectedColorChange={setSelectedColor}
            onGridCommit={(commit) => replaceGrid(commit.grid, commit.previousGrid)}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClear={() => replaceGrid(createEmptyGrid())}
            onLoadSample={(sampleGrid) => replaceGrid(sampleGrid)}
            canUndo={past.length > 0}
            canRedo={future.length > 0}
            savedArtworks={savedArtworks}
            currentSavedArtworkId={currentSavedArtworkId}
            onSaveArtwork={handleSaveArtwork}
            onLoadArtwork={(artwork) => replaceArtwork(artwork.grid, artwork.colorMode)}
            onDeleteArtwork={handleDeleteArtwork}
          />
        );
      case 1:
        return (
          <NumberStep
            grid={grid}
            colorMode={colorMode}
            selectedCellIndex={selectedCellIndex}
            onCellSelect={setSelectedCellIndex}
          />
        );
      case 2:
        return (
          <CompressionStep
            grid={grid}
            colorMode={colorMode}
            entries={entries}
            selectedRunIndex={Math.min(selectedRunIndex, entries.length - 1)}
            onSelectRun={handleRunSelection}
          />
        );
      case 3:
        return (
          <BinaryStep
            entries={entries}
            colorMode={colorMode}
            selectedRunIndex={Math.min(selectedRunIndex, entries.length - 1)}
            onSelectRun={handleRunSelection}
          />
        );
      case 4:
        return (
          <ParityStep
            entries={entries}
            colorMode={colorMode}
            selectedRunIndex={Math.min(selectedRunIndex, entries.length - 1)}
            onSelectRun={handleRunSelection}
            demoBits={parityDemoBits}
            flippedBitIndex={parityFlippedBitIndex}
            onFlip={handleParityFlip}
            onReset={() => {
              setParityDemoBits(null);
              setParityFlippedBitIndex(null);
            }}
          />
        );
      case 5:
        return (
          <QrLikeStep
            data={qrData}
            modifiedIndices={modifiedQrIndices}
            selectedIndex={selectedQrIndex}
            onFlip={(index) => {
              setQrFlipHistory((history) => [...history, index]);
              setRestoreCompleted(false);
              setWorkshopCompleted(false);
              setSaveStatus("unsaved");
            }}
            onSelectedIndexChange={setSelectedQrIndex}
            onUndo={() => {
              setQrFlipHistory((history) => history.slice(0, -1));
              setSaveStatus("unsaved");
            }}
            onResetChanges={() => {
              setQrFlipHistory([]);
              setRestoreCompleted(false);
              setWorkshopCompleted(false);
              setSaveStatus("unsaved");
            }}
            canUndo={qrFlipHistory.length > 0}
          />
        );
      case 6:
        return (
          <RestoreStep
            key={qrData.fullBits}
            originalGrid={grid}
            colorMode={colorMode}
            data={qrData}
            onReturnToFix={() => {
              setRestoreCompleted(false);
              setWorkshopCompleted(false);
              setCurrentStep(5);
              announceStepChange();
            }}
            onCompletionChange={(complete) => {
              setRestoreCompleted(complete);
              if (!complete) setWorkshopCompleted(false);
            }}
          />
        );
      default:
        return null;
    }
  })();

  const completedSteps = Array.from(
    { length: workshopCompleted ? LAST_STEP_INDEX + 1 : Math.max(unlockedThrough, 0) },
    (_, index) => index,
  );

  return (
    <div className="relative min-h-screen min-h-dvh pb-20">
      <div className="lab-grid-bg pointer-events-none fixed inset-0 z-[-1] opacity-55" aria-hidden="true" />

      <AppHeader
        onReset={handleReset}
        onOpenScanner={() => setScannerOpen(true)}
        saveStatus={saveStatus}
      />
      <StepNavigation
        currentStepIndex={currentStep}
        unlockedThroughIndex={
          currentStep === 4 && parityDemoBits !== null ? 4 : unlockedThrough
        }
        completedStepIndexes={completedSteps}
        onStepChange={handleStepChange}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        ステップ{currentStep + 1}、{DEFAULT_WORKSHOP_STEPS[currentStep].label}を表示しました
      </p>

      <main
        ref={mainRef}
        tabIndex={-1}
        aria-label={`ステップ${currentStep + 1}、${DEFAULT_WORKSHOP_STEPS[currentStep].label}`}
        className="mx-auto w-full max-w-7xl px-3 py-5 outline-none sm:px-5 sm:py-7 lg:px-8"
      >
        {renderedStep}
        <CreatorCredit />
      </main>

      <BottomNavigation
        currentStepIndex={currentStep}
        totalSteps={DEFAULT_WORKSHOP_STEPS.length}
        currentStepLabel={DEFAULT_WORKSHOP_STEPS[currentStep].label}
        onBack={handleBack}
        onNext={handleNext}
        backDisabled={currentStep === 0}
        nextDisabled={
          currentStep === LAST_STEP_INDEX
            ? !restoreCompleted
            : currentStep === 4 && parityDemoBits !== null
        }
        nextDisabledReason={
          currentStep === 4 && parityDemoBits !== null
            ? "エラーを元に戻すと進めます"
            : currentStep === LAST_STEP_INDEX && !restoreCompleted
              ? "復元すると完了できます"
            : undefined
        }
        nextLabel={currentStep === LAST_STEP_INDEX ? "完了" : "次へ"}
      />

      <StandaloneScanner
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onUseArtwork={(scannedArtwork) => {
          replaceArtwork(scannedArtwork.grid, scannedArtwork.colorMode);
          announceStepChange();
        }}
      />

      <AlertDialog open={completionOpen} onOpenChange={setCompletionOpen}>
        <AlertDialogContent>
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </div>
          <AlertDialogHeader className="text-center sm:text-center">
            <AlertDialogTitle>体験を完了しました</AlertDialogTitle>
            <AlertDialogDescription>
              ドット絵を、圧縮・誤り検出・QRライク配置・復元まで一通り確認しました。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>閉じる</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => {
                setCurrentStep(0);
                announceStepChange();
              }}
            >
              絵を編集する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

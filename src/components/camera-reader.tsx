"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, LoaderCircle, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DataValidationError,
  scanQrLikeImage,
  toUserMessage,
  type QrLikeData,
  type QrLikeMarkerDetection,
  type QrLikeMarkerName,
} from "@/lib";

const MARKERS: Array<{ name: QrLikeMarkerName; label: string; color: string }> = [
  { name: "red", label: "赤", color: "#ef4444" },
  { name: "blue", label: "青", color: "#2563eb" },
  { name: "green", label: "緑", color: "#22c55e" },
  { name: "orange", label: "橙", color: "#f97316" },
];
const EMPTY_DETECTION: QrLikeMarkerDetection = {
  red: false,
  blue: false,
  green: false,
  orange: false,
};
const COMPLETE_DETECTION: QrLikeMarkerDetection = {
  red: true,
  blue: true,
  green: true,
  orange: true,
};

function detectionFromError(error: unknown): QrLikeMarkerDetection {
  if (!(error instanceof DataValidationError)) return EMPTY_DETECTION;
  const detected = error.details?.detectedMarkers;
  if (!Array.isArray(detected)) return EMPTY_DETECTION;
  return Object.fromEntries(
    MARKERS.map(({ name }) => [name, detected.includes(name)]),
  ) as QrLikeMarkerDetection;
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DataValidationError) {
    const stage = error.details?.stage;
    const missing = error.details?.missingMarkers;
    if (stage === "markers" && Array.isArray(missing)) {
      const labels = MARKERS.filter(({ name }) => missing.includes(name)).map(({ label }) => label);
      return `${labels.join("・")}のマーカーを探しています。コード全体を画面内に入れてください。`;
    }
    if (stage === "geometry") {
      return "4色は見えています。コードの四隅が隠れないように位置を調整してください。";
    }
    if (stage === "decode") {
      return "位置は合っています。少し近づけてピントを合わせると自動で再試行します。";
    }
    if (stage === "capture") {
      return "カメラ画像を取得できません。カメラを起動し直してください。";
    }
  }
  return `まだ読み取れません。${toUserMessage(error)}`;
}

export function CameraReader({ onDecoded }: { onDecoded: (data: QrLikeData) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const attemptingRef = useRef(false);
  const succeededRef = useRef(false);
  const cancelledRef = useRef(false);
  const onDecodedRef = useRef(onDecoded);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("4色のマーカーを画面内に収めます。向きは自由です。");
  const [success, setSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedMarkers, setDetectedMarkers] = useState<QrLikeMarkerDetection>(EMPTY_DETECTION);

  useEffect(() => {
    onDecodedRef.current = onDecoded;
  }, [onDecoded]);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    stopTracks();
    setActive(false);
    setScanning(false);
    setCapturedImage(null);
    setDetectedMarkers(EMPTY_DETECTION);
    setMessage("読み取りを停止しました。");
  }, [stopTracks]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("カメラはHTTPSまたはlocalhostで利用できます。");
      return;
    }
    try {
      cancelledRef.current = false;
      succeededRef.current = false;
      setSuccess(false);
      setScanning(false);
      setAttemptCount(0);
      setCapturedImage(null);
      setDetectedMarkers(EMPTY_DETECTION);
      setMessage("カメラを準備しています…");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (cancelledRef.current || !mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { focusMode?: string[] };
          if (capabilities?.focusMode?.includes("continuous")) {
            await track.applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            });
          }
        } catch {
          // Continuous focus is an optional camera enhancement.
        }
      }

      const video = videoRef.current;
      if (!video) throw new Error("Video element is unavailable.");
      video.srcObject = stream;
      await video.play();
      setActive(true);
      setMessage("自動で読み取っています。4色すべてが見える距離に合わせてください。");
    } catch (error) {
      stopTracks();
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setMessage("カメラが許可されていません。ブラウザの設定から許可してください。");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        setMessage("利用できるカメラが見つかりません。");
      } else {
        setMessage(toUserMessage(error));
      }
    }
  }, [stopTracks]);

  const captureFrame = useCallback((): { canvas: HTMLCanvasElement; image: ImageData } | null => {
    const video = videoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.videoWidth) return null;

    const scale = Math.min(1, 1280 / video.videoWidth);
    const width = Math.max(1, Math.round(video.videoWidth * scale));
    const height = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return { canvas, image: context.getImageData(0, 0, width, height) };
  }, []);

  const attemptRead = useCallback(async (automatic: boolean) => {
    if (attemptingRef.current || succeededRef.current || cancelledRef.current) return;
    const frame = captureFrame();
    if (!frame) return;

    attemptingRef.current = true;
    if (!automatic) {
      setScanning(true);
      setMessage("画像を解析しています…");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    }

    try {
      const decoded = scanQrLikeImage(frame.image);
      if (!mountedRef.current || cancelledRef.current) return;

      succeededRef.current = true;
      setDetectedMarkers(COMPLETE_DETECTION);
      setCapturedImage(frame.canvas.toDataURL("image/jpeg", 0.88));
      setScanning(false);
      setSuccess(true);
      setMessage("読み取りました。復元結果を表示します。");
      stopTracks();
      setActive(false);

      await new Promise((resolve) => window.setTimeout(resolve, 1100));
      if (mountedRef.current && !cancelledRef.current) onDecodedRef.current(decoded);
    } catch (error) {
      if (!mountedRef.current || cancelledRef.current) return;
      setScanning(false);
      setAttemptCount((count) => count + 1);
      setDetectedMarkers(detectionFromError(error));
      setMessage(cameraErrorMessage(error));
    } finally {
      attemptingRef.current = false;
    }
  }, [captureFrame, stopTracks]);

  useEffect(() => {
    if (!active || success) return;
    const initial = window.setTimeout(() => void attemptRead(true), 300);
    const interval = window.setInterval(() => void attemptRead(true), 850);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [active, attemptRead, success]);

  const detectedCount = MARKERS.filter(({ name }) => detectedMarkers[name]).length;

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
        <video ref={videoRef} playsInline muted className="size-full object-cover" />
        {capturedImage ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${capturedImage})` }}
          />
        ) : null}
        {!active && !capturedImage ? (
          <div className="absolute inset-0 grid place-items-center text-white/60"><CameraOff className="size-10" /></div>
        ) : null}

        {active ? (
          <div className="pointer-events-none absolute inset-[6%] rounded-xl border border-white/70 shadow-[0_0_0_999px_rgba(2,6,23,.1)]" aria-hidden="true">
            <span className="absolute -left-0.5 -top-0.5 size-6 border-l-4 border-t-4 border-white" />
            <span className="absolute -right-0.5 -top-0.5 size-6 border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-0.5 -right-0.5 size-6 border-b-4 border-r-4 border-white" />
            <span className="absolute -bottom-0.5 -left-0.5 size-6 border-b-4 border-l-4 border-white" />
          </div>
        ) : null}

        {active ? (
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs font-black text-white">
            <span className="size-2 animate-pulse rounded-full bg-cyan-300" />
            4色 {detectedCount}/4
            <span className="flex gap-1" aria-hidden="true">
              {MARKERS.map(({ name, color }) => (
                <i
                  key={name}
                  className={`size-2.5 rounded-full border border-white/70 transition-opacity ${detectedMarkers[name] ? "opacity-100" : "opacity-25"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
          </div>
        ) : null}

        {scanning ? (
          <div className="absolute inset-0 overflow-hidden bg-slate-950/20" aria-hidden="true">
            <span className="camera-scan-line absolute inset-x-0 h-1 bg-cyan-300 shadow-[0_0_18px_4px_rgba(103,232,249,.9)]" />
            <span className="absolute inset-x-0 bottom-4 text-center text-sm font-black tracking-wider text-white drop-shadow">解析中</span>
          </div>
        ) : null}

        {success ? (
          <div className="absolute inset-0 grid place-items-center bg-emerald-950/55 text-white" role="status" aria-label="読み取り成功">
            <div className="camera-success-pop text-center">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-400 text-emerald-950 shadow-[0_0_0_12px_rgba(52,211,153,.18)]">
                <CheckCircle2 className="size-11" strokeWidth={3} />
              </span>
              <strong className="mt-4 block text-xl tracking-wide">読み取り成功</strong>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!active ? (
          <Button onClick={() => void start()} disabled={success}><Camera />カメラを起動</Button>
        ) : (
          <>
            <Button onClick={() => void attemptRead(false)} disabled={scanning}>
              {scanning ? <LoaderCircle className="animate-spin" /> : <ScanLine />}
              {scanning ? "解析中" : "今すぐ読み取る"}
            </Button>
            <Button variant="secondary" onClick={stop} disabled={scanning}>停止</Button>
          </>
        )}
        {active && attemptCount > 0 ? (
          <span className="text-xs font-bold text-muted-foreground">自動再試行 {attemptCount}回</span>
        ) : null}
      </div>

      <p role="status" className={`flex items-start gap-2 text-sm ${success ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground"}`}>
        {success ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : null}{message}
      </p>
    </div>
  );
}

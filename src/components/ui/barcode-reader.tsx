import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { logger } from "@/lib/logger";

type BarcodeReaderProps = {
  onDecode?: (decodedText: string) => void;
  onCapture?: (isbn: string, fileName: string, blob: Blob) => void;
  fps?: number;
  qrbox?: number | { width: number; height: number };
  additionalButtons?: React.ReactNode;
  rightContent?: React.ReactNode;
};

export default function BarcodeReader({
  onDecode,
  onCapture,
  fps = 10,
  qrbox = 250,
  additionalButtons,
  rightContent,
}: BarcodeReaderProps) {
  const containerIdRef = useRef(
    `html5qr-${Math.random().toString(36).slice(2)}`
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [detectedIsbn, setDetectedIsbn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // capture UI state
  const [captureOpen, setCaptureOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // helpers: ISBN normalization & validation
  const isValidISBN10 = (isbn10: string) => {
    if (!/^\d{9}[\dX]$/.test(isbn10)) return false;
    const chars = isbn10.split("");
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const c = chars[i];
      const val = c === "X" ? 10 : parseInt(c, 10);
      sum += (10 - i) * val;
    }
    return sum % 11 === 0;
  };

  const isValidISBN13 = (isbn13: string) => {
    if (!/^\d{13}$/.test(isbn13)) return false;
    const chars = isbn13.split("").map((c) => parseInt(c, 10));
    let sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += chars[i] * (i % 2 === 0 ? 1 : 3);
    }
    return sum % 10 === 0;
  };

  const extractISBN = (text: string): string | null => {
    if (!text) return null;
    // find candidate substrings with digits / X / hyphens / spaces
    const candidates = text.match(/[\dXx\- ]{10,17}/g) ?? [];
    for (const cand of candidates) {
      const norm = cand.replace(/[\s\-]/g, "").toUpperCase();
      if (norm.length === 13 && isValidISBN13(norm)) return norm;
      if (norm.length === 10 && isValidISBN10(norm)) return norm;
      // some EAN-13 results include leading zeros or formatting;
      // if cand contains 13 digits but fails, keep trying other candidates
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!mounted) return;
        if (devices.length) setCameraId(devices[0].id);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(String(e));
      });

    return () => {
      mounted = false;
      stopScanner();
      stopCaptureStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle video stream attachment when capture modal opens
  useEffect(() => {
    if (!captureOpen || !streamRef.current) return;

    // Wait for video element to be available in DOM
    const attachStream = () => {
      if (videoRef.current && streamRef.current) {
        const video = videoRef.current;
        video.srcObject = streamRef.current;
        video.play().catch((err) => {
          logger.error("Video play error:", err);
          setError("Failed to start video");
        });
      } else {
        // Retry if video element not ready yet
        setTimeout(attachStream, 50);
      }
    };

    attachStream();
  }, [captureOpen]);

  const startScanner = async () => {
    setError(null);
    if (!cameraId) {
      setError("No camera selected");
      return;
    }

    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(containerIdRef.current);
    }

    try {
      await scannerRef.current.start(
        cameraId,
        {
          fps,
          qrbox,
        },
        (decodedText) => {
          // attempt to extract ISBN
          const isbn = extractISBN(decodedText);
          if (isbn) {
            setDetectedIsbn(isbn);
            setLastResult(decodedText);
            onDecode?.(isbn);
            // open capture UI automatically for ISBN
            startCapture().catch((e) => {
              logger.error("capture start failed", e);
            });
          } else {
            setDetectedIsbn(null);
            setLastResult(decodedText);
            onDecode?.(decodedText);
          }
        },
        (errorMessage) => {
          // optional per-frame error callback
          logger.log("scan error", errorMessage);
        }
      );
      setScanning(true);
    } catch (e) {
      setError(String(e));
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch {
      /* ignore */
    }
    scannerRef.current = null;
    setScanning(false);
  };

  // Capture helpers
  const stopCaptureStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      } catch {
        /* ignore */
      }
    }
  };

  const startCapture = async () => {
    try {
      // stop scanner to free camera resources
      await stopScanner();
    } catch {
      /* ignore */
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId } }
          : { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      setCaptureOpen(true);
    } catch (e) {
      setError(String(e));
      // try to resume scanner if capture failed
      setCaptureOpen(false);
      startScanner().catch(() => {});
    }
  };

  const captureImage = async () => {
    const video = videoRef.current;
    const isbn = detectedIsbn;
    if (!video || !isbn) return;
    
    const videoWidth = video.videoWidth || 1280;
    const videoHeight = video.videoHeight || 720;
    
    // Calculate square dimensions (use the smaller dimension)
    const sourceSize = Math.min(videoWidth, videoHeight);
    
    // Calculate crop position to center the square
    const sourceX = (videoWidth - sourceSize) / 2;
    const sourceY = (videoHeight - sourceSize) / 2;
    
    // Create canvas with fixed 128x128 output size
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Draw the cropped square portion of the video, scaled to 128x128
    ctx.drawImage(
      video,
      sourceX, sourceY, sourceSize, sourceSize,  // source rectangle (crop from video)
      0, 0, 128, 128                             // destination rectangle (128x128 output)
    );

    // convert to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const fileName = `${isbn}_${Date.now()}.jpg`;
        onCapture?.(isbn, fileName, blob);
      },
      "image/jpeg",
      0.9
    );

    // cleanup
    stopCaptureStream();
    setCaptureOpen(false);
  };

  const cancelCapture = () => {
    stopCaptureStream();
    setCaptureOpen(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          {!scanning ? (
            <button
              className="px-3 py-2 bg-green-500 text-white rounded"
              onClick={startScanner}
            >
              Barcode Reader
            </button>
          ) : (
            <button
              className="px-3 py-2 bg-red-500 text-white rounded"
              onClick={stopScanner}
            >
              Stop
            </button>
          )}
          {additionalButtons}
        </div>
        {rightContent && (
          <div className="flex items-center">
            {rightContent}
          </div>
        )}
      </div>

      <div id={containerIdRef.current} className="w-full" />

      {error && (
        <div className="text-sm text-red-600">Error: {error}</div>
      )}

      {/* Capture modal */}
      {captureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg overflow-hidden max-w-md w-full">
            <div className="p-2 bg-gray-800 text-white text-sm flex justify-between items-center">
              <div>Capture photo for ISBN: {detectedIsbn}</div>
              <div className="text-xs text-gray-200">
                Filename: {detectedIsbn}_{Date.now()}.jpg
              </div>
            </div>

            <div className="bg-black flex items-center justify-center aspect-square overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                autoPlay
                style={{ transform: 'scale(1.0)' }}
              />
            </div>

            <div className="flex gap-2 p-3">
              <button
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded"
                onClick={captureImage}
              >
                Capture
              </button>
              <button
                className="flex-1 px-3 py-2 bg-gray-300 text-black rounded"
                onClick={cancelCapture}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

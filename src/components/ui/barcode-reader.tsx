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
  const [_lastResult, setLastResult] = useState<string | null>(null);
  const [detectedIsbn, setDetectedIsbn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // capture UI state
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Helper function to find back-facing camera
  const findBackCamera = (devices: Array<{ id: string; label?: string }>): string | null => {
    if (!devices.length) return null;

    // First, try to find a back-facing camera by label keywords
    const backKeywords = ['back', 'rear', 'environment', 'rear-facing', 'back-facing'];
    const backCamera = devices.find(device => {
      const label = (device.label || '').toLowerCase();
      return backKeywords.some(keyword => label.includes(keyword));
    });

    if (backCamera) {
      return backCamera.id;
    }

    // If no back camera found by label, try to use MediaDevices API to check facingMode
    // For now, fall back to the last device (often the back camera on mobile)
    // or use the second device if available (common pattern on mobile)
    if (devices.length > 1) {
      // On many mobile devices, the back camera is the second one
      return devices[devices.length - 1].id;
    }

    // If only one device, use it (will be front camera, but better than nothing)
    return devices[0].id;
  };

  useEffect(() => {
    let mounted = true;
    
    // First, try to get cameras from native MediaDevices API for better detection
    const getBestCamera = async () => {
      let cameraSelected = false;
      
      try {
        // Request permission and get detailed device info
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop immediately, we just needed permission
        
        const mediaDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = mediaDevices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length && mounted) {
          // Find back-facing camera by label
          const backKeywords = ['back', 'rear', 'environment', 'rear-facing', 'back-facing'];
          const backCamera = videoDevices.find(device => {
            const label = (device.label || '').toLowerCase();
            return backKeywords.some(keyword => label.includes(keyword));
          });
          
          if (backCamera) {
            setCameraId(backCamera.deviceId);
            cameraSelected = true;
            return;
          }
          
          // If no back camera found by label, use the last device (often back camera on mobile)
          if (videoDevices.length > 1) {
            setCameraId(videoDevices[videoDevices.length - 1].deviceId);
            cameraSelected = true;
            return;
          }
          
          // Fall back to first device
          setCameraId(videoDevices[0].deviceId);
          cameraSelected = true;
        }
      } catch (e) {
        // If MediaDevices API fails, fall back to Html5Qrcode
        logger.log("MediaDevices API failed, using Html5Qrcode", e);
      }
      
      // Fallback to Html5Qrcode.getCameras() only if MediaDevices didn't work
      if (!cameraSelected) {
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (!mounted) return;
            if (devices.length) {
              const selectedCameraId = findBackCamera(devices);
              if (selectedCameraId) {
                setCameraId(selectedCameraId);
              }
            }
            console.log("devices", devices);
          })
          .catch((e) => {
            if (!mounted) return;
            setError(String(e));
          });
      }
    };
    
    getBestCamera();

    return () => {
      mounted = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

  // Capture helpers - use native mobile camera
  const startCapture = async () => {
    try {
      // stop scanner to free camera resources
      await stopScanner();
    } catch {
      /* ignore */
    }

    // Trigger native camera app with back camera preference (capture="environment")
    // This will use the back camera on mobile devices, falling back to front if unavailable
    if (fileInputRef.current) {
      // Set capture attribute to "environment" for back camera
      fileInputRef.current.setAttribute('capture', 'environment');
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const isbn = detectedIsbn;
    
    if (!file || !isbn) {
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      // Create image from file
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        // Calculate square dimensions (use the smaller dimension)
        const sourceSize = Math.min(img.width, img.height);
        
        // Calculate crop position to center the square
        const sourceX = (img.width - sourceSize) / 2;
        const sourceY = (img.height - sourceSize) / 2;
        
        // Create canvas with fixed 128x128 output size
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        
        // Draw the cropped square portion of the image, scaled to 128x128
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceSize, sourceSize,  // source rectangle (crop from image)
          0, 0, 128, 128                             // destination rectangle (128x128 output)
        );

        // convert to blob
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) return;
            const fileName = `${isbn}_${Date.now()}.jpg`;
            onCapture?.(isbn, fileName, blob);
          },
          "image/jpeg",
          0.9
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError("Failed to load image");
      };
      
      img.src = objectUrl;
    } catch (e) {
      setError(String(e));
    } finally {
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

      {/* Hidden file input for native camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </div>
  );
}

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
  qrbox = 350,
  additionalButtons,
  rightContent,
}: BarcodeReaderProps) {
  const containerIdRef = useRef(
    `html5qr-${Math.random().toString(36).slice(2)}`
  );
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraId, setCameraId] = useState<string | null>(null);
  const [cameraCount, setCameraCount] = useState<number>(0);
  const [scanning, setScanning] = useState(false);
  const [_lastResult, setLastResult] = useState<string | null>(null);
  const [detectedIsbn, setDetectedIsbn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // capture UI state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureInProgressRef = useRef(false);

  // Helper function to detect if device is mobile/tablet (2+ cameras) vs desktop (1 camera)
  const isMobileDevice = () => {
    // Mobile devices (phones/tablets) typically have 2 cameras (front + back)
    // Desktop devices typically have 1 camera (webcam)
    return cameraCount >= 2;
  };

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
        
        // Store camera count for mobile/desktop detection
        if (mounted) {
          setCameraCount(videoDevices.length);
        }
        
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
            // Store camera count for mobile/desktop detection
            setCameraCount(devices.length);
            if (devices.length) {
              const selectedCameraId = findBackCamera(devices);
              if (selectedCameraId) {
                setCameraId(selectedCameraId);
              }
            }
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

  // Add CSS to ensure scanner video fills container - fullscreen on mobile/tablet
  useEffect(() => {
    if (scanning) {
      const isMobile = cameraCount >= 2;
      const style = document.createElement('style');
      style.textContent = `
        #${containerIdRef.current} {
          ${isMobile ? `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999 !important;
            overflow: hidden !important;
          ` : `
            width: 100% !important;
            min-height: 400px !important;
            height: 100% !important;
            display: block !important;
            position: relative !important;
            overflow: hidden !important;
          `}
        }
        #${containerIdRef.current} video,
        #${containerIdRef.current} canvas {
          ${isMobile ? `
            width: 100vw !important;
            height: 100vh !important;
            object-fit: cover !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            transform: scale(1.2) !important;
            transform-origin: center center !important;
          ` : `
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            min-height: 400px !important;
            max-height: 80vh !important;
            object-fit: contain !important;
            display: block !important;
            margin: 0 auto !important;
            transform: scale(1.2) !important;
            transform-origin: center center !important;
          `}
        }
        /* Ensure scanning box overlay is not affected by video transforms */
        #${containerIdRef.current} > div > div[style*="position"] {
          transform: none !important;
          z-index: 10002 !important;
        }
        #${containerIdRef.current} > div {
          width: 100% !important;
          height: 100% !important;
          position: relative !important;
        }
        /* Ensure Html5Qrcode scanning box is fully visible */
        /* Target all possible scanning box elements */
        #${containerIdRef.current} div[id*="qr"],
        #${containerIdRef.current} div[class*="qr"],
        #${containerIdRef.current} div[id*="shaded"],
        #${containerIdRef.current} div[class*="shaded"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        /* Ensure the scanning box border is visible and styled */
        #${containerIdRef.current} div[style*="border"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 10001 !important;
        }
        /* Make sure the scanning area box is centered and visible */
        #${containerIdRef.current} > div > div[style*="position"] {
          display: block !important;
          visibility: visible !important;
        }
      `;
      document.head.appendChild(style);
      return () => {
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      };
    }
  }, [scanning, cameraCount]);

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
      // Calculate responsive qrbox size based on viewport width
      // Small screens (< 640px): 250x250
      // Medium screens (640px - 1024px): 350x350
      // Large screens (> 1024px): 450x450
      const viewportWidth = window.innerWidth;
      let calculatedQrbox: number | { width: number; height: number };
      
      if (viewportWidth < 640) {
        // Small screens (sm)
        calculatedQrbox = { width: 250, height: 250 };
      } else if (viewportWidth < 1024) {
        // Medium screens (md)
        calculatedQrbox = { width: 450, height: 350 };
      } else {
        // Large screens (lg and above)
        calculatedQrbox = { width: 550, height: 450 };
      }
      
      // Use calculated size, but allow override from prop if it's an object
      const finalQrbox = typeof qrbox === 'object' ? qrbox : calculatedQrbox;
      
      await scannerRef.current.start(
        cameraId,
        {
          fps,
          qrbox: finalQrbox,
          aspectRatio: 1.0, // Square aspect ratio for better mobile experience
        },
        (decodedText) => {
          // attempt to extract ISBN
          const isbn = extractISBN(decodedText);
          if (isbn) {
            setDetectedIsbn(isbn);
            setLastResult(decodedText);
            onDecode?.(isbn);
            // Don't auto-open capture - wait for user confirmation
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

  // Capture helpers - use native mobile camera or desktop video stream
  const startCapture = async () => {
    // Prevent multiple concurrent capture attempts
    if (captureInProgressRef.current) {
      return;
    }
    
    captureInProgressRef.current = true;
    const isMobile = isMobileDevice();
    
    // On mobile/tablet (2+ cameras), use native camera app
    if (isMobile) {
      try {
        // stop scanner to free camera resources
        await stopScanner();
        // Add delay to ensure camera resources are fully released before opening native camera app
        // This is necessary on mobile devices where the camera stream needs time to be released
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch {
        /* ignore */
      }

      // Trigger native camera app with back camera preference (capture="environment")
      // This will use the back camera on mobile devices, falling back to front if unavailable
      if (fileInputRef.current) {
        // Set capture attribute to "environment" for back camera
        fileInputRef.current.setAttribute('capture', 'environment');
        // Use setTimeout to ensure the click happens in the next event loop cycle
        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
            // Reset flag after a delay to allow for camera app to open
            setTimeout(() => {
              captureInProgressRef.current = false;
            }, 1000);
          } else {
            captureInProgressRef.current = false;
          }
        }, 0);
      } else {
        captureInProgressRef.current = false;
      }
    } else {
      // On desktop, use inline video stream
      try {
        // stop scanner to free camera resources
        await stopScanner();
      } catch {
        /* ignore */
      }

      // Start video stream for desktop capture
      try {
        if (!cameraId) {
          setError("No camera selected");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: cameraId } }
        });
        
        streamRef.current = stream;
        setCaptureOpen(true);
        captureInProgressRef.current = false; // Reset flag when capture opens
        
        // Wait for video element to be available
        setTimeout(() => {
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        }, 100);
      } catch (e) {
        setError(`Failed to start camera: ${e}`);
        logger.error("Failed to start capture stream", e);
        captureInProgressRef.current = false; // Reset flag on error
      }
    }
  };

  const closeCapture = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCaptureOpen(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !detectedIsbn) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);

    // Calculate square dimensions (use the smaller dimension)
    const sourceSize = Math.min(canvas.width, canvas.height);
    
    // Calculate crop position to center the square
    const sourceX = (canvas.width - sourceSize) / 2;
    const sourceY = (canvas.height - sourceSize) / 2;
    
    // Resize to 720p (720x720 for square, maintaining aspect ratio)
    const targetSize = 720;
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = targetSize;
    croppedCanvas.height = targetSize;
    const croppedCtx = croppedCanvas.getContext("2d");
    
    if (!croppedCtx) return;
    
    // Draw the cropped square portion, scaled to 720x720
    croppedCtx.drawImage(
      canvas,
      sourceX, sourceY, sourceSize, sourceSize,  // source rectangle (crop from canvas)
      0, 0, targetSize, targetSize               // destination rectangle (720x720)
    );

    // Convert to blob with high quality
    croppedCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const fileName = `${detectedIsbn}_${Date.now()}.jpg`;
        onCapture?.(detectedIsbn, fileName, blob);
        closeCapture();
      },
      "image/jpeg",
      0.95  // Higher quality (0.95 instead of 0.9)
    );
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const isbn = detectedIsbn;
    
    if (!file || !isbn) {
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      captureInProgressRef.current = false; // Reset flag if no file or ISBN
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
        
        // Resize to 720p (720x720 for square, maintaining aspect ratio)
        const targetSize = 720;
        const canvas = document.createElement("canvas");
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        
        // Draw the cropped square portion of the image, scaled to 720x720
        ctx.drawImage(
          img,
          sourceX, sourceY, sourceSize, sourceSize,  // source rectangle (crop from image)
          0, 0, targetSize, targetSize               // destination rectangle (720x720)
        );

        // convert to blob with high quality
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              captureInProgressRef.current = false; // Reset flag if blob creation fails
              return;
            }
            const fileName = `${isbn}_${Date.now()}.jpg`;
            onCapture?.(isbn, fileName, blob);
            captureInProgressRef.current = false; // Reset flag after successful capture
          },
          "image/jpeg",
          0.95  // Higher quality (0.95 instead of 0.9)
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setError("Failed to load image");
        captureInProgressRef.current = false; // Reset flag on image load error
      };
      
      img.src = objectUrl;
    } catch (e) {
      setError(String(e));
      captureInProgressRef.current = false; // Reset flag on error
    } finally {
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isMobile = cameraCount >= 2;

  return (
    <div className="space-y-3">
      {!scanning && (
        <div className="flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center w-full md:w-auto">
            <button
              className="px-3 py-2 bg-green-500 text-white rounded flex-1 md:flex-none"
              onClick={startScanner}
            >
              Barcode Reader
            </button>
            {additionalButtons && (
              <div className="flex-1 md:flex-none">
                {additionalButtons}
              </div>
            )}
          </div>
          {rightContent && (
            <div className="flex items-center hidden md:flex">
              {rightContent}
            </div>
          )}
        </div>
      )}

      {/* Scanner container - always present, visibility controlled by scanning state */}
      <div 
        className={scanning && isMobile ? "fixed inset-0 z-[9999] bg-black" : scanning ? "relative bg-black rounded-lg overflow-hidden w-full z-10" : "hidden"}
      >
        {/* Controls overlay - only show when scanning */}
        {scanning && (
          <div className={isMobile ? "absolute top-4 left-4 right-4 z-10 flex justify-between items-center" : "absolute top-4 left-4 z-10"}>
            <button
              className={isMobile ? "px-4 py-2 bg-red-500 text-white rounded-lg shadow-lg" : "px-3 py-2 bg-red-500 text-white rounded"}
              onClick={stopScanner}
            >
              Stop
            </button>
            {rightContent && isMobile && (
              <div className="flex items-center text-white">
                {rightContent}
              </div>
            )}
          </div>
        )}
        
        {/* ISBN Display - show detected ISBN above the scanning box */}
        {scanning && detectedIsbn && (
          <div className={isMobile ? "fixed top-1/2 left-1/2 transform -translate-x-1/2 z-[10000] -mt-[250px]" : "absolute top-1/2 left-1/2 transform -translate-x-1/2 z-[10000] -mt-[250px]"}>
            <div className="bg-black bg-opacity-75 rounded-lg px-6 py-3 shadow-2xl absolute top-10 left-1/2 transform -translate-x-1/2">
              <p className="text-xs text-white mb-1 text-center">Detected ISBN:</p>
              <h3 className="text-xl font-bold text-white text-center">{detectedIsbn}</h3>
            </div>
          </div>
        )}
        
        {/* Capture Buttons - at the bottom of the screen */}
        {scanning && detectedIsbn && (
          <div className={isMobile ? "fixed bottom-4 left-4 right-4 z-[10000]" : "absolute bottom-4 left-4 right-4 z-[10000]"}>
            <div className="flex gap-3 justify-center">
              <button
                className="flex-1 max-w-xs px-6 py-4 bg-green-500 text-white rounded-lg font-semibold text-lg hover:bg-green-600 transition-colors shadow-lg"
                onClick={() => {
                  startCapture().catch((e) => {
                    logger.error("capture start failed", e);
                  });
                }}
              >
                Confirm & Capture
              </button>
              <button
                className="px-6 py-4 bg-gray-600 text-white rounded-lg font-semibold text-lg hover:bg-gray-700 transition-colors shadow-lg"
                onClick={() => {
                  setDetectedIsbn(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {/* Scanner container - always present for Html5Qrcode */}
        <div 
          id={containerIdRef.current} 
          className={scanning && !isMobile ? "w-full min-h-[400px]" : ""}
        />
      </div>

      {error && (
        <div className="text-sm text-red-600">Error: {error}</div>
      )}

      {/* Desktop capture window (modal) */}
      {captureOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center md:block">
          <div className="bg-white rounded-lg p-4 md:p-6 max-w-2xl w-full mx-4 md:mx-auto md:mt-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Capture Photo</h3>
              <button
                onClick={closeCapture}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-w-md rounded-lg bg-black"
                style={{ maxHeight: '70vh' }}
              />
              <div className="flex gap-4">
                <button
                  onClick={capturePhoto}
                  className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Capture
                </button>
                <button
                  onClick={closeCapture}
                  className="px-6 py-3 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file input for native camera capture - mobile only */}
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

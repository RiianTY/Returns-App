import { useState, useEffect } from "react";
import { Button } from "./button";
import { logger } from "@/lib/logger";

type InvoiceImageViewerProps = {
  invoiceNumber: string;
  images: string[];
  onBack?: () => void;
  headerActions?: React.ReactNode;
  accountNumber?: string;
};

export default function InvoiceImageViewer({
  invoiceNumber,
  images,
  onBack,
  headerActions,
  accountNumber: _accountNumber,
}: InvoiceImageViewerProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  // Extract filename from URL
  const getFilename = (index: number): string => {
    try {
      const url = images[index];
      const urlPath = new URL(url).pathname;
      const filename = urlPath.split('/').pop() || `image-${index + 1}`;
      return filename;
    } catch {
      return `image-${index + 1}`;
    }
  };

  const openImageViewer = (index: number) => {
    setSelectedImageIndex(index);
  };

  const closeImageViewer = () => {
    setSelectedImageIndex(null);
  };

  const goToPrevious = () => {
    if (selectedImageIndex !== null && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const goToNext = () => {
    if (selectedImageIndex !== null && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  };

  const downloadCurrentImage = async () => {
    if (selectedImageIndex === null) return;

    const imageUrl = images[selectedImageIndex];
    const filename = getFilename(selectedImageIndex);
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Error downloading image:", error);
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedImageIndex !== null) {
      // Save the current overflow style
      const originalOverflow = document.body.style.overflow;
      // Disable scrolling
      document.body.style.overflow = "hidden";
      
      // Cleanup: restore original overflow when modal closes or component unmounts
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [selectedImageIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (selectedImageIndex === null) return;

    if (e.key === "ArrowLeft") {
      goToPrevious();
    } else if (e.key === "ArrowRight") {
      goToNext();
    } else if (e.key === "Escape") {
      closeImageViewer();
    }
  };

  if (images.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-medium">Images for {invoiceNumber}</h3>
          <Button onClick={onBack}>Back</Button>
        </div>
        <p className="text-sm text-gray-500">No images found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="flex flex-col flex-end justify-between items-start">
        {/* show account number and invoice number above the images-viewer header (may not be needed) */}
        {/* <h3 className="font-medium pb-2">Images for {accountNumber ? `Acc: ${accountNumber} -` : ""} Inv: {invoiceNumber}</h3> */}
        <div className="flex gap-2 items-center">
          <Button onClick={onBack}>Back</Button>
          {headerActions}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {images.map((src, i) => (
          <div key={i} className="flex flex-col">
            <img
              src={src}
              alt={`img-${i}`}
              className="w-full max-w-[300px] h-auto max-h-[300px] 
              object-contain rounded cursor-pointer hover:opacity-80 
              transition-opacity mx-auto"
              onClick={() => openImageViewer(i)}
            />
            <p className="text-xs text-muted-foreground mt-1 text-center truncate" title={getFilename(i)}>
              {getFilename(i)}
            </p>
          </div>
        ))}
      </div>

      {/* Image Viewer Modal */}
      {selectedImageIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeImageViewer}
        >
          <div
            className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={closeImageViewer}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2 transition-colors"
              aria-label="Close viewer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Previous button */}
            {selectedImageIndex > 0 && (
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-3 transition-colors"
                aria-label="Previous image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Image */}
            <img
              src={images[selectedImageIndex]}
              alt={`Invoice ${invoiceNumber} - Image ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />

            {/* Next button */}
            {selectedImageIndex < images.length - 1 && (
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-3 transition-colors"
                aria-label="Next image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            {/* Image counter, filename, and download button */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 bg-black/50 rounded-lg px-4 py-2">
              <span className="text-white text-sm">
                {selectedImageIndex + 1} / {images.length}
              </span>
              <span className="text-white text-xs opacity-80 truncate max-w-md" title={getFilename(selectedImageIndex)}>
                {getFilename(selectedImageIndex)}
              </span>
              <button
                onClick={downloadCurrentImage}
                className="text-white hover:text-gray-300 transition-colors flex items-center gap-2"
                aria-label="Download image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="text-sm">Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

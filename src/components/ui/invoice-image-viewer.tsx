import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
} from "@/components/ui/item";

type InvoiceImageViewerProps = {
  invoiceNumber: string;
  images: string[];
  onBack?: () => void;
  headerActions?: React.ReactNode;
  accountNumber?: string;
};

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function InvoiceImageViewer({
  invoiceNumber,
  images,
  onBack: _onBack,
  headerActions,
  accountNumber: _accountNumber,
}: InvoiceImageViewerProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageSizes, setImageSizes] = useState<{ [key: number]: number }>({});
  const [imageUrls, setImageUrls] = useState<{ [key: number]: string }>({});

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

  // Extract ISBN from filename (format: isbn_timestamp.jpg)
  const getISBN = (index: number): string => {
    try {
      const filename = getFilename(index);
      // Filename format is typically: isbn_timestamp.jpg
      const parts = filename.split('_');
      if (parts.length >= 1) {
        return parts[0];
      }
      return 'N/A';
    } catch {
      return 'N/A';
    }
  };

  // Fetch images once and get their sizes, then create object URLs for display
  useEffect(() => {
    const fetchImages = async () => {
      const sizes: { [key: number]: number } = {};
      const urls: { [key: number]: string } = {};
      
      await Promise.all(
        images.map(async (url, index) => {
          try {
            // Fetch the image once
            const response = await fetch(url, { mode: 'cors' });
            if (response.ok) {
              const blob = await response.blob();
              sizes[index] = blob.size;
              
              // Create object URL from the blob for display (avoids re-fetching)
              const objectUrl = URL.createObjectURL(blob);
              urls[index] = objectUrl;
            }
          } catch (error) {
            // If fetch fails, fall back to original URL
            logger.error(`Error fetching image ${index + 1}:`, error);
            urls[index] = url;
          }
        })
      );
      
      setImageSizes(sizes);
      setImageUrls(urls);
    };

    if (images.length > 0) {
      fetchImages();
    }
    
    // Cleanup: revoke object URLs when component unmounts or images change
    return () => {
      setImageUrls(prevUrls => {
        Object.values(prevUrls).forEach(url => {
          if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
          }
        });
        return {};
      });
    };
  }, [images]);

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
          {headerActions}
        </div>
      </div>

      <ItemGroup className="flex flex-row flex-wrap gap-2">
        {images.map((src, i) => (
          <Item 
            key={i} 
            variant="outline" 
            className="flex flex-row bg-white rounded-md relative w-[calc(50%-0.25rem)] md:w-auto min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => openImageViewer(i)}
          >
            <ItemHeader className="flex justify-center">
              <img
                src={imageUrls[i] || src}
                alt={`img-${i}`}
                className="w-28 h-28 object-cover rounded-sm text-wrap text-center"
                onError={(e) => {
                  console.error("Failed to load image:", src);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </ItemHeader>
            <ItemContent className="text-center flex-1 flex flex-col items-center text-wrap justify-center w-24">
              <ItemDescription className="text-muted-foreground text-xs text-center">
                ISBN: {getISBN(i)}
              </ItemDescription>
              <ItemDescription className="text-muted-foreground text-xs text-center">
                Size: {imageSizes[i] ? formatFileSize(imageSizes[i]) : 'Loading...'}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>

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
              src={imageUrls[selectedImageIndex] || images[selectedImageIndex]}
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

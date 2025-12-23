import { useCallback, useState, useEffect, useRef } from "react";
import BarcodeReader from "@/components/ui/barcode-reader";
import Gallery, { type GalleryItem } from "@/components/ui/gallery";
import { uploadGalleryItems, type UploadResult } from "@/components/ui/upload";
import notAuthImage from "@/assets/not-auth.png";

export type ImagePanelProps = {
  onUploadResultsChange?: (results: UploadResult[]) => void;
  invoiceNumber?: string; // Optional invoice number for folder organization
  onUploadAllUnuploadedReady?: (uploadFn: () => Promise<UploadResult[]>) => void; // Expose upload function
  onClearGalleryReady?: (clearFn: () => void) => void; // Expose clear gallery function
  onUnmarkUploadedReady?: (unmarkFn: (itemIds: string[]) => void) => void; // Expose unmark uploaded function
};

export default function ImagePanel({ 
  onUploadResultsChange, 
  invoiceNumber,
  onUploadAllUnuploadedReady,
  onClearGalleryReady,
  onUnmarkUploadedReady
}: ImagePanelProps) {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const galleryRef = useRef<GalleryItem[]>([]);
  const uploadResultsRef = useRef<UploadResult[]>([]);

  // Keep refs in sync with state
  useEffect(() => {
    galleryRef.current = gallery;
  }, [gallery]);

  useEffect(() => {
    uploadResultsRef.current = uploadResults;
  }, [uploadResults]);

  const handleCapture = useCallback(
    (isbn: string, fileName: string, blob: Blob) => {
      // Verify blob is valid before creating preview
      if (!blob || blob.size === 0) {
        console.error("Invalid blob received in handleCapture");
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
      // Create object URL for immediate preview - this works locally without upload
      const preview = URL.createObjectURL(blob);
      
      // Verify the preview URL was created successfully
      if (!preview) {
        console.error("Failed to create object URL for blob");
        return;
      }

      const item: GalleryItem = {
        id,
        isbn,
        fileName,
        blob,
        preview,
        uploaded: false,
        uploading: false,
      };
      
      // Add to gallery - this will trigger a re-render and display the image immediately
      setGallery((s) => {
        const newGallery = [item, ...s];
        // Update ref immediately for consistency
        galleryRef.current = newGallery;
        return newGallery;
      });
    },
    []
  );

  const handleAddNotAuth = useCallback(() => {
    // Add the asset image directly to gallery - use asset URL as preview
    // The blob will be created only when uploading
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fileName = `not-auth.png`; // Base filename, will be changed on upload
    
    // Create a placeholder blob for now (will be replaced on upload)
    // We'll store the asset URL and convert to blob only when uploading
    const item: GalleryItem & { assetUrl?: string } = {
      id,
      isbn: "N/A",
      fileName,
      blob: new Blob(), // Placeholder - will be created on upload
      preview: notAuthImage, // Use asset URL directly for preview
      uploaded: false,
      uploading: false,
      assetUrl: notAuthImage, // Store asset URL for later blob conversion
    };
    
    setGallery((s) => [item, ...s]);
  }, []);

  const handleRemove = useCallback((id: string) => {
    setGallery((s) => {
      const removed = s.find((i) => i.id === id);
      // Only revoke object URLs (not asset URLs)
      if (removed && removed.preview.startsWith('blob:')) {
        URL.revokeObjectURL(removed.preview);
      }
      return s.filter((i) => i.id !== id);
    });
    // Also remove from upload results if present
    setUploadResults((r) => r.filter((res) => res.itemId !== id));
  }, []);

  const handleMarkUploaded = useCallback((id: string) => {
    setGallery((s) =>
      s.map((it) =>
        it.id === id ? { ...it, uploaded: true, uploading: false } : it
      )
    );
  }, []);

  const handleUnmarkUploaded = useCallback((itemIds: string[]) => {
    setGallery((s) =>
      s.map((it) =>
        itemIds.includes(it.id) ? { ...it, uploaded: false, uploading: false } : it
      )
    );
  }, []);

  const handleSetUploading = useCallback((id: string, uploading: boolean) => {
    setGallery((s) =>
      s.map((it) => (it.id === id ? { ...it, uploading } : it))
    );
  }, []);

  const uploadAllUnuploaded = useCallback(async (): Promise<UploadResult[]> => {
    // Get all items that haven't been uploaded yet (use ref for latest state)
    const currentGallery = galleryRef.current;
    const currentUploadResults = uploadResultsRef.current;
    const unuploadedItems = currentGallery.filter((item) => !item.uploaded);
    
    if (unuploadedItems.length === 0) {
      // Return existing upload results if all items are already uploaded
      return currentUploadResults;
    }

    // Mark items as uploading
    unuploadedItems.forEach((item) => handleSetUploading(item.id, true));

    try {
      // Convert asset URLs to blobs for items that need it
      const itemsWithBlobs = await Promise.all(
        unuploadedItems.map(async (item) => {
          // If item has an assetUrl (not-auth image), convert it to blob
          const itemWithAsset = item as GalleryItem & { assetUrl?: string };
          if (itemWithAsset.assetUrl && (!item.blob || item.blob.size === 0)) {
            try {
              const response = await fetch(itemWithAsset.assetUrl);
              const blob = await response.blob();
              
              // Update filename with timestamp when uploading
              const timestamp = Date.now();
              const fileName = `not-auth-${timestamp}.png`;
              
              return {
                ...item,
                blob,
                fileName,
              } as GalleryItem;
            } catch (error) {
              console.error("Error converting asset to blob:", error);
              return item;
            }
          }
          return item;
        })
      );

      // Add invoice number to items if provided
      const itemsWithInvoice = invoiceNumber
        ? itemsWithBlobs.map((item) => ({ ...item, invoiceNumber } as GalleryItem & { invoiceNumber?: string }))
        : itemsWithBlobs;
      
      const results = await uploadGalleryItems(itemsWithInvoice as GalleryItem[]);
      
      // Mark items as uploaded
      results.forEach((result) => {
        if (result.itemId && !result.error) {
          handleMarkUploaded(result.itemId);
        }
      });

      // Combine with existing results
      const allResults = [...currentUploadResults, ...results];
      setUploadResults(allResults);
      onUploadResultsChange?.(allResults);
      return allResults;
    } catch (error) {
      // Mark items as not uploading on error
      unuploadedItems.forEach((item) => handleSetUploading(item.id, false));
      throw error;
    }
  }, [invoiceNumber, onUploadResultsChange, handleSetUploading, handleMarkUploaded]);

  // Clear gallery function
  const clearGallery = useCallback(() => {
    // Revoke all object URLs before clearing
    gallery.forEach((item) => {
      if (item.preview.startsWith('blob:')) {
        URL.revokeObjectURL(item.preview);
      }
    });
    setGallery([]);
    setUploadResults([]);
    onUploadResultsChange?.([]);
  }, [gallery, onUploadResultsChange]);

  // Expose upload function to parent
  useEffect(() => {
    if (onUploadAllUnuploadedReady) {
      onUploadAllUnuploadedReady(uploadAllUnuploaded);
    }
  }, [uploadAllUnuploaded, onUploadAllUnuploadedReady]);

  // Expose clear gallery function to parent
  useEffect(() => {
    if (onClearGalleryReady) {
      onClearGalleryReady(clearGallery);
    }
  }, [clearGallery, onClearGalleryReady]);

  // Expose unmark uploaded function to parent
  useEffect(() => {
    if (onUnmarkUploadedReady) {
      onUnmarkUploadedReady(handleUnmarkUploaded);
    }
  }, [handleUnmarkUploaded, onUnmarkUploadedReady]);


  return (
    <div className="bg-white rounded-2xl shadow-inner p-4 sm:p-6">
      <BarcodeReader
        onCapture={handleCapture}
        additionalButtons={
          <button
            className="px-3 py-2 bg-orange-500 text-white rounded"
            onClick={handleAddNotAuth}
          >
            Not Auth
          </button>
        }
        rightContent={
          <div className="text-md text-gray-600 whitespace-nowrap">
            Queued: {gallery.length}
          </div>
        }
      />

      <div className="mt-4">
        <Gallery
          items={gallery}
          onRemove={handleRemove}
        />
      </div>
    </div>
  );
}

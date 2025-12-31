import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import FormData from "@/components/ui/form-data";
import ImagePanel from "@/components/ui/image-panel";
import type { UploadResult } from "@/components/ui/upload";

export default function Damages() {
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const uploadAllUnuploadedRef = useRef<(() => Promise<UploadResult[]>) | null>(null);
  const clearGalleryRef = useRef<(() => void) | null>(null);
  const unmarkUploadedRef = useRef<((itemIds: string[]) => void) | null>(null);

  return (
    <div className="w-full h-full bg-white m-0 p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <Button asChild className="w-fit">
        <Link to="/">Back</Link>
      </Button>
      {/* Top Row */}
      <FormData 
        key="damages-form"
        uploadResults={uploadResults} 
        isDamages={true}
        isOverstock={false}
        onInvoiceNumberChange={setInvoiceNumber}
        onUploadAllUnuploaded={() => uploadAllUnuploadedRef.current?.() ?? Promise.resolve([])}
        onClearImages={() => clearGalleryRef.current?.()}
        onUnmarkUploaded={(itemIds) => unmarkUploadedRef.current?.(itemIds)}
      />

      {/* Bottom Row */}
      <ImagePanel 
        onUploadResultsChange={setUploadResults}
        invoiceNumber={invoiceNumber}
        isDamages={true}
        onUploadAllUnuploadedReady={(uploadFn) => {
          uploadAllUnuploadedRef.current = uploadFn;
        }}
        onClearGalleryReady={(clearFn) => {
          clearGalleryRef.current = clearFn;
        }}
        onUnmarkUploadedReady={(unmarkFn) => {
          unmarkUploadedRef.current = unmarkFn;
        }}
      />
    </div>
  );
}


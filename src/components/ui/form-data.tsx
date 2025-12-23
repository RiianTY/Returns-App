import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "./textarea";
import {
  insertReturnData,
  insertOverstockData,
  insertDamagesData,
  type FormData as FormDataType,
  type UploadResult,
} from "@/components/ui/upload";
import { validateAccountNumber, validateInvoiceNumber, validateRNumber, sanitizeTextInput } from "@/lib/validation";
import { logger, sanitizeErrorMessage } from "@/lib/logger";
import { toast } from "sonner";

export type FormDataProps = {
  onSubmit?: (formData: FormDataType, urls: string[]) => Promise<void>; // Pass upload results
  uploadResults?: UploadResult[]; // Upload results from ImagePanel
  isOverstock?: boolean; // Flag to determine if this is for overstock
  isDamages?: boolean; // Flag to determine if this is for damages (no R number field)
  onInvoiceNumberChange?: (invoiceNumber: string) => void; // Callback for invoice number changes
  onUploadAllUnuploaded?: () => Promise<UploadResult[]>; // Function to upload all unuploaded images
  onClearImages?: () => void; // Callback to clear images after successful submission
  onUnmarkUploaded?: (itemIds: string[]) => void; // Callback to unmark images as uploaded on error
};

export default function FormData({
  onSubmit,
  uploadResults = [],
  isOverstock = false,
  isDamages = false,
  onInvoiceNumberChange,
  onUploadAllUnuploaded,
  onClearImages,
  onUnmarkUploaded,
}: FormDataProps) {
  const [formData, setFormData] = useState<FormDataType>({
    creditNumber: "",
    rNumber: "",
    accNumber: "",
    reason: "",
  });
  const [loading, setLoading] = useState(false);

  // Reset form when switching between damages/overstock/returns
  useEffect(() => {
    setFormData({
      creditNumber: "",
      rNumber: "",
      accNumber: "",
      reason: "",
    });
  }, [isDamages, isOverstock]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Notify parent of invoice number changes for overstock or damages
    if ((isOverstock || isDamages) && name === "creditNumber" && onInvoiceNumberChange) {
      onInvoiceNumberChange(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs - R number only required if not damages
    if (!isDamages) {
      const rNumberValidation = validateRNumber(formData.rNumber);
      if (!rNumberValidation.valid) {
        toast.error(rNumberValidation.error || "Invalid R number");
        return;
      }
    }

    const accNumberValidation = validateAccountNumber(formData.accNumber);
    if (!accNumberValidation.valid) {
      toast.error(accNumberValidation.error || "Invalid account number");
      return;
    }

    // For overstock or damages, require creditNumber (invoice number)
    if (isOverstock || isDamages) {
      if (!formData.creditNumber) {
        toast.error("Please enter an invoice number (Credit Number)");
        return;
      }
      const invoiceValidation = validateInvoiceNumber(formData.creditNumber);
      if (!invoiceValidation.valid) {
        toast.error(invoiceValidation.error || "Invalid invoice number");
        return;
      }
    }

    // Validate reason if provided
    if (formData.reason) {
      const reasonValidation = sanitizeTextInput(formData.reason);
      if (!reasonValidation.valid) {
        toast.error(reasonValidation.error || "Invalid reason text");
        return;
      }
    }

    setLoading(true);
    let finalUploadResults = uploadResults;
    try {

      // For overstock or damages, upload all unuploaded images first if function is provided
      if ((isOverstock || isDamages) && onUploadAllUnuploaded) {
        try {
          const newResults = await onUploadAllUnuploaded();
          finalUploadResults = newResults;
        } catch (uploadError) {
          logger.error("Upload error:", uploadError);
          toast.error("Error uploading images. Please try again.");
          setLoading(false);
          return;
        }
      }

      // Check if there are any successful uploads
      const successfulUploads = finalUploadResults.filter(
        (r) => !r.error && r.publicUrl
      );
      if ((isOverstock || isDamages) && successfulUploads.length === 0) {
        toast.error("Please capture at least one image before submitting");
        setLoading(false);
        return;
      }

      if (isDamages) {
        // For damages: use creditNumber as invoiceNumber, no returns number
        await insertDamagesData(
          formData.creditNumber, // invoice number
          formData.accNumber, // account number
          finalUploadResults,
          formData.reason // reason -> warehouse_notes
        );
        toast.success("Damages data submitted successfully!");
        // Reset form after successful submission
        setFormData({
          creditNumber: "",
          rNumber: "",
          accNumber: "",
          reason: "",
        });
        // Clear images after successful submission
        onClearImages?.();
      } else if (isOverstock) {
        // For overstock: use creditNumber as invoiceNumber
        await insertOverstockData(
          formData.creditNumber, // invoice number
          formData.accNumber, // account number
          formData.rNumber, // returns number
          finalUploadResults,
          formData.reason // reason -> warehouse_notes
        );
        toast.success("Overstock data submitted successfully!");
        // Reset form after successful submission
        setFormData({
          creditNumber: "",
          rNumber: "",
          accNumber: "",
          reason: "",
        });
        // Clear images after successful submission
        onClearImages?.();
      } else {
        // For returns: use existing logic
        await insertReturnData(formData, finalUploadResults);
        toast.success("Return data submitted successfully!");
        // Reset form after successful submission
        setFormData({
          creditNumber: "",
          rNumber: "",
          accNumber: "",
          reason: "",
        });
        // Clear images after successful submission
        onClearImages?.();
      }

      if (onSubmit) {
        const urls = finalUploadResults
          .filter((r) => !r.error && r.publicUrl)
          .map((r) => r.publicUrl!);
        await onSubmit(formData, urls);
      }
    } catch (error) {
      logger.error("Submission error:", error);
      const errorMessage = sanitizeErrorMessage(error);
      toast.error("Error submitting data:", {
        description: errorMessage,
      });
      
      // Unmark images as uploaded since the submission failed
      if (onUnmarkUploaded && finalUploadResults) {
        const uploadedItemIds = finalUploadResults
          .filter((r: UploadResult) => !r.error && r.itemId)
          .map((r: UploadResult) => r.itemId!);
        if (uploadedItemIds.length > 0) {
          onUnmarkUploaded(uploadedItemIds);
        }
      }
    }
    setLoading(false);
  };

  // Determine if R number field should be shown (only hide for damages)

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-neutral-50 shadow-md p-4 sm:p-6 rounded-lg flex flex-col gap-4"
      key={`form-${isDamages ? 'damages' : isOverstock ? 'overstock' : 'returns'}`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
        <Input
          name="accNumber"
          placeholder="Acc Number (eg. RRR001)"
          required
          value={formData.accNumber}
          onChange={handleChange}
        />
        {isDamages === false ? (
          <Input
            name="rNumber"
            placeholder="R Number (eg. 56012322)"
            required={isDamages === false}
            value={formData.rNumber}
            onChange={handleChange}
          />
        ) : null}
        <Input
          name="creditNumber"
          placeholder={
            "Invoice Number (eg. 21000000)"
          }
          value={formData.creditNumber}
          onChange={handleChange}
          required={isOverstock || isDamages}
        />
        </div>
        <div className="flex flex-col gap-2">
        <Textarea
          name="reason"
          placeholder="Reason for return"
          rows={3}
          value={formData.reason}
          onChange={handleChange}
        />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Uploading & Submitting..." : "Submit"}
      </Button>
    </form>
  );
}

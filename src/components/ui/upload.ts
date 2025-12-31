import { supabase } from "@/lib/supabaseClient";
import type { GalleryItem } from "@/components/ui/gallery";
import { validateFileSize, validateFileType, validateImageContent } from "@/lib/validation";
import { logger } from "@/lib/logger";

const RAW_BUCKET = String(import.meta.env.VITE_SUPABASE_BUCKET ?? "").trim();
if (!RAW_BUCKET) {
  throw new Error(
    "Missing VITE_SUPABASE_BUCKET env var. Set it to the storage bucket name (e.g. '123456789')."
  );
}

/** Normalize bucket value — accept plain name or a copied URL and return only the bucket name */
function normalizeBucket(raw: string) {
  let b = raw.trim();
  try {
    if (b.includes("://")) {
      const u = new URL(b);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length) b = parts[parts.length - 1];
    } else if (b.includes("/")) {
      b = b.split("/").filter(Boolean).pop() ?? b;
    }
  } catch {
    /* fallback to raw */
  }
  return b;
}

const DEFAULT_BUCKET = normalizeBucket(RAW_BUCKET);

function sanitizeFolder(name = "") {
  return String(name)
    .trim()
    .replace(/[^0-9A-Za-z_\-]/g, "_");
}

function sanitizeBase(name = "") {
  return String(name)
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[^0-9A-Za-z_\-]/g, "_")
    .replace(/_+/g, "_");
}

function pickExt(mime = "") {
  if (!mime) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Upload a single gallery item to a Supabase storage bucket.
 * - bucket: item.bucketName || VITE_SUPABASE_BUCKET
 * - folder: invoice number (item.invoiceNumber) or item.isbn or "unknown"
 * - filename: <isbn>_<randomDigits>_<timestamp>.<ext>
 */
export async function uploadGalleryItem(item: GalleryItem) {
  // Validate file size
  const sizeValidation = validateFileSize(item.blob.size);
  if (!sizeValidation.valid) {
    throw new Error(sizeValidation.error || "File validation failed");
  }

  // Validate file type
  const typeValidation = validateFileType(item.blob.type);
  if (!typeValidation.valid) {
    throw new Error(typeValidation.error || "File type validation failed");
  }

  // Validate image content (check magic numbers)
  try {
    const contentValidation = await validateImageContent(item.blob);
    if (!contentValidation.valid) {
      throw new Error(contentValidation.error || "Image content validation failed");
    }
  } catch (error) {
    logger.error("Image content validation error:", error);
    throw new Error("Failed to validate image file");
  }

  const rawBucket = String((item as any).bucketName ?? DEFAULT_BUCKET).trim();
  const bucket = normalizeBucket(rawBucket);
  if (!bucket) throw new Error("No bucket specified for upload.");

  // Create nested folder structure: month_year/day/time_invoiceNumber
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() returns 0-11
  const year = now.getFullYear();
  
  // Get current time in 12-hour format (e.g., "10.30pm")
  const hours24 = now.getHours();
  const hours12 = hours24 === 0 ? 12 : hours24 > 12 ? hours24 - 12 : hours24;
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'pm' : 'am';
  const timePrefix = `${hours12}.${minutes}${ampm}`;
  
  // Top level: month_year (e.g., "01_2024")
  const monthYearFolder = `${month}_${year}`;
  
  // Second level: day (e.g., "15")
  const dayFolder = day;
  
  // Third level: time_invoiceNumber (e.g., "10.30pm_12345")
  // @ts-ignore allow invoiceNumber if present on item
  const rawFolder = (item as any).invoiceNumber ?? item.isbn ?? "unknown";
  const invoiceFolder = sanitizeFolder(String(rawFolder));
  // Use underscore to separate time and invoice number (time has dots and am/pm)
  const timeInvoiceFolder = `${timePrefix}_${invoiceFolder}`;
  
  // Combined folder path: month_year/day/time_invoiceNumber
  const folder = `${monthYearFolder}/${dayFolder}/${timeInvoiceFolder}`;

  // build filename: isbn + random numbers + timestamp
  const isbnBase = sanitizeBase(item.isbn ?? item.fileName ?? "image");
  const ext = pickExt(item.blob.type);
  const timestamp = Date.now();
  const fileName = `${isbnBase}_${timestamp}.${ext}`;

  // ensure destPath has no leading slash
  const destPath = `${folder}/${fileName}`.replace(/^\/+/, "");

  const file = new File([item.blob], fileName, {
    type: item.blob.type || `image/${ext}`,
  });

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(destPath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    logger.error("Supabase storage upload error:", uploadError);
    throw new Error("Failed to upload file. Please try again.");
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(destPath);
  const publicUrl = urlData?.publicUrl ?? null;

  return { bucket, destPath, publicUrl, fileName };
}

/** Upload multiple items sequentially */
export async function uploadGalleryItems(items: GalleryItem[]) {
  const results: Array<{
    itemId?: string;
    bucket?: string;
    destPath?: string;
    publicUrl?: string;
    fileName?: string;
    error?: unknown;
  }> = [];
  for (const it of items) {
    try {
      const res = await uploadGalleryItem(it);
      results.push({ itemId: it.id, ...res });
    } catch (err) {
      logger.error("Upload error for item:", it.id, err);
      results.push({ itemId: it.id, error: err });
    }
  }
  logger.log("uploadGalleryItems results:", results.length, "items processed");
  return results;
}

export type FormData = {
  creditNumber: string;
  rNumber: string;
  accNumber: string;
  reason: string;
};

export type UploadResult = Awaited<ReturnType<typeof uploadGalleryItems>>[number];

/** Insert form data and successful upload publicUrls into 'returns' table */
export async function insertReturnData(
  formData: FormData,
  uploadResults: UploadResult[]
) {
  // Import validation functions
  const { validateAccountNumber, validateRNumber, sanitizeTextInput } = await import("@/lib/validation");

  // Validate inputs
  const rNumberValidation = validateRNumber(formData.rNumber);
  if (!rNumberValidation.valid) {
    throw new Error(rNumberValidation.error || "Invalid R number");
  }

  const accNumberValidation = validateAccountNumber(formData.accNumber);
  if (!accNumberValidation.valid) {
    throw new Error(accNumberValidation.error || "Invalid account number");
  }

  // Sanitize reason if provided
  let sanitizedReason = formData.reason;
  if (formData.reason) {
    const reasonValidation = sanitizeTextInput(formData.reason);
    if (!reasonValidation.valid) {
      throw new Error(reasonValidation.error || "Invalid reason text");
    }
    sanitizedReason = reasonValidation.sanitized || formData.reason;
  }

  const successful = uploadResults
    .filter((r) => !r.error && r.publicUrl)
    .map((r) => ({
      credit_number: formData.creditNumber,
      r_number: rNumberValidation.sanitized || formData.rNumber,
      acc_number: accNumberValidation.sanitized || formData.accNumber,
      reason: sanitizedReason,
      image_url: r.publicUrl,
      file_name: r.fileName,
    }));

  if (successful.length === 0) {
    throw new Error("No successful uploads to insert");
  }

  const { data, error } = await supabase.from("returns").insert(successful);
  
  if (error) {
    logger.error("Supabase insert error:", error);
    
    if (error.code === "42501") {
      throw new Error("You do not have permission to perform this action.");
    }
    
    // Handle duplicate key constraint violation (PostgreSQL error code 23505)
    if (error.code === "23505") {
      throw new Error("This record already exists. Please check your input and try again.");
    }
    
    throw new Error("Failed to save data. Please try again.");
  }

  return data;
}

/** Insert overstock data with public URLs, invoice number, account number, and returns number into 'returns-app' table */
export async function insertOverstockData(
  invoiceNumber: string,
  accountNumber: string,
  returnsNumber: string,
  uploadResults: UploadResult[],
  reason?: string
) {
  // Import validation functions
  const { validateInvoiceNumber, validateAccountNumber, validateRNumber, validateNumericString } = await import("@/lib/validation");

  // Validate and sanitize inputs
  const invoiceValidation = validateInvoiceNumber(invoiceNumber);
  if (!invoiceValidation.valid) {
    throw new Error(invoiceValidation.error || "Invalid invoice number");
  }

  const accountValidation = validateAccountNumber(accountNumber);
  if (!accountValidation.valid) {
    throw new Error(accountValidation.error || "Invalid account number");
  }

  const rNumberValidation = validateRNumber(returnsNumber);
  if (!rNumberValidation.valid) {
    throw new Error(rNumberValidation.error || "Invalid R number");
  }

  // Get all successful upload URLs
  const imageUrls = uploadResults
    .filter((r) => !r.error && r.publicUrl)
    .map((r) => r.publicUrl!);

  if (imageUrls.length === 0) {
    throw new Error("No successful uploads to insert");
  }

  // Convert strings to numbers for InvoiceNumber and rNumber
  const invoiceNumValidation = validateNumericString(invoiceValidation.sanitized || invoiceNumber);
  const rNumValidation = validateNumericString(rNumberValidation.sanitized || returnsNumber);

  if (!invoiceNumValidation.valid || !rNumValidation.valid) {
    throw new Error("Invoice number and R number must be valid numbers");
  }

  const invoiceNum = invoiceNumValidation.number!;
  const rNum = rNumValidation.number!;

  // Sanitize reason if provided
  let sanitizedReason = "";
  if (reason) {
    const { sanitizeTextInput } = await import("@/lib/validation");
    const reasonValidation = sanitizeTextInput(reason);
    if (reasonValidation.valid) {
      sanitizedReason = reasonValidation.sanitized || reason;
    }
  }

  // Check if a record with this invoice number already exists
  const { data: existingData, error: checkError } = await supabase
    .from("returns-app")
    .select("images, warehouse_notes")
    .eq("InvoiceNumber", invoiceNum)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116 is "not found" - that's fine, we'll insert new
    // Any other error is a problem
    logger.error("Error checking for existing record:", checkError);
    throw new Error("Failed to check for existing record. Please try again.");
  }

  if (existingData) {
    // Record exists - append new images to existing ones
    logger.log("Record exists, appending images to existing record");
    
    // Parse existing images (handle both array and JSON string)
    let existingImages: string[] = [];
    if (existingData.images) {
      if (typeof existingData.images === 'string') {
        try {
          existingImages = JSON.parse(existingData.images);
        } catch {
          existingImages = [existingData.images];
        }
      } else if (Array.isArray(existingData.images)) {
        existingImages = existingData.images;
      }
    }
    
    // Merge images, avoiding duplicates
    const allImages = [...existingImages];
    imageUrls.forEach(url => {
      if (!allImages.includes(url)) {
        allImages.push(url);
      }
    });
    
    // Merge warehouse notes (append new reason if provided)
    let updatedWarehouseNotes = existingData.warehouse_notes || "";
    if (sanitizedReason) {
      if (updatedWarehouseNotes) {
        updatedWarehouseNotes = `${updatedWarehouseNotes}\n${sanitizedReason}`;
      } else {
        updatedWarehouseNotes = sanitizedReason;
      }
    }
    
    // Update the existing record
    const { data, error } = await supabase
      .from("returns-app")
      .update({
        images: allImages,
        warehouse_notes: updatedWarehouseNotes,
      })
      .eq("InvoiceNumber", invoiceNum)
      .select();
    
    if (error) {
      logger.error("Supabase update error:", error);
      if (error.code === "42501") {
        throw new Error("You do not have permission to perform this action. Please contact your administrator.");
      }
      throw new Error("Failed to update existing record. Please try again.");
    }
    
    logger.log(`Successfully appended ${imageUrls.length} image(s) to existing record. Total images: ${allImages.length}`);
    return data;
  }

  // No existing record - insert new one
  const rowData = {
    InvoiceNumber: invoiceNum,
    rNumber: rNum,
    accountNumber: accountValidation.sanitized || accountNumber,
    images: imageUrls,
    created_at: new Date().toISOString(), // Full ISO string with date and time
    sales_notes: "",
    warehouse_notes: sanitizedReason, // Use reason as warehouse_notes
    status: "Logged",
    action: null,
    team: null,
  };

  const { data, error } = await supabase
    .from("returns-app")
    .insert(rowData)
    .select();

  if (error) {
    logger.error("Supabase insert error:", error);
    
    // Provide user-friendly error messages
    if (error.code === "42501") {
      throw new Error("You do not have permission to perform this action. Please contact your administrator.");
    }
    
    throw new Error("Failed to save data. Please try again.");
  }

  return data;
}

/** Insert damages data with public URLs, invoice number, and account number into 'returns-app' table (no returns number) */
export async function insertDamagesData(
  invoiceNumber: string,
  accountNumber: string,
  uploadResults: UploadResult[],
  reason?: string
) {
  // Import validation functions
  const { validateInvoiceNumber, validateAccountNumber, validateNumericString } = await import("@/lib/validation");

  // Validate and sanitize inputs
  const invoiceValidation = validateInvoiceNumber(invoiceNumber);
  if (!invoiceValidation.valid) {
    throw new Error(invoiceValidation.error || "Invalid invoice number");
  }

  const accountValidation = validateAccountNumber(accountNumber);
  if (!accountValidation.valid) {
    throw new Error(accountValidation.error || "Invalid account number");
  }

  // Get all successful upload URLs
  const imageUrls = uploadResults
    .filter((r) => !r.error && r.publicUrl)
    .map((r) => r.publicUrl!);

  if (imageUrls.length === 0) {
    throw new Error("No successful uploads to insert");
  }

  // Convert string to number for InvoiceNumber
  const invoiceNumValidation = validateNumericString(invoiceValidation.sanitized || invoiceNumber);

  if (!invoiceNumValidation.valid) {
    throw new Error("Invoice number must be a valid number");
  }

  const invoiceNum = invoiceNumValidation.number!;

  // Sanitize reason if provided
  let sanitizedReason = "";
  if (reason) {
    const { sanitizeTextInput } = await import("@/lib/validation");
    const reasonValidation = sanitizeTextInput(reason);
    if (reasonValidation.valid) {
      sanitizedReason = reasonValidation.sanitized || reason;
    }
  }

  // Check if a record with this invoice number already exists
  const { data: existingData, error: checkError } = await supabase
    .from("returns-app")
    .select("images, warehouse_notes")
    .eq("InvoiceNumber", invoiceNum)
    .single();

  if (checkError && checkError.code !== "PGRST116") {
    // PGRST116 is "not found" - that's fine, we'll insert new
    // Any other error is a problem
    logger.error("Error checking for existing record:", checkError);
    throw new Error("Failed to check for existing record. Please try again.");
  }

  if (existingData) {
    // Record exists - append new images to existing ones
    logger.log("Record exists, appending images to existing record");
    
    // Parse existing images (handle both array and JSON string)
    let existingImages: string[] = [];
    if (existingData.images) {
      if (typeof existingData.images === 'string') {
        try {
          existingImages = JSON.parse(existingData.images);
        } catch {
          existingImages = [existingData.images];
        }
      } else if (Array.isArray(existingData.images)) {
        existingImages = existingData.images;
      }
    }
    
    // Merge images, avoiding duplicates
    const allImages = [...existingImages];
    imageUrls.forEach(url => {
      if (!allImages.includes(url)) {
        allImages.push(url);
      }
    });
    
    // Merge warehouse notes (append new reason if provided)
    let updatedWarehouseNotes = existingData.warehouse_notes || "";
    if (sanitizedReason) {
      if (updatedWarehouseNotes) {
        updatedWarehouseNotes = `${updatedWarehouseNotes}\n${sanitizedReason}`;
      } else {
        updatedWarehouseNotes = sanitizedReason;
      }
    }
    
    // Update the existing record
    const { data, error } = await supabase
      .from("returns-app")
      .update({
        images: allImages,
        warehouse_notes: updatedWarehouseNotes,
      })
      .eq("InvoiceNumber", invoiceNum)
      .select();
    
    if (error) {
      logger.error("Supabase update error:", error);
      if (error.code === "42501") {
        throw new Error("You do not have permission to perform this action. Please contact your administrator.");
      }
      throw new Error("Failed to update existing record. Please try again.");
    }
    
    logger.log(`Successfully appended ${imageUrls.length} image(s) to existing record. Total images: ${allImages.length}`);
    return data;
  }

  // No existing record - insert new one
  const rowData = {
    InvoiceNumber: invoiceNum,
    rNumber: null, // No returns number for damages
    accountNumber: accountValidation.sanitized || accountNumber,
    images: imageUrls,
    created_at: new Date().toISOString(), // Full ISO string with date and time
    sales_notes: "",
    warehouse_notes: sanitizedReason, // Use reason as warehouse_notes
    status: "Logged",
    action: null,
    team: null,
  };

  const { data, error } = await supabase
    .from("returns-app")
    .insert(rowData)
    .select();

  if (error) {
    logger.error("Supabase insert error:", error);
    
    // Provide user-friendly error messages
    if (error.code === "42501") {
      throw new Error("You do not have permission to perform this action. Please contact your administrator.");
    }
    
    throw new Error("Failed to save data. Please try again.");
  }

  return data;
}

/** Update sales/warehouse notes in the returns-app table */
export async function updateSalesData(
  invoiceNumber: string | number,
  updates: {
    sales_notes?: string;
    warehouse_notes?: string;
    team?: string | null;
    status?: string | null;
    action?: string | null;
  }
) {
  // Import validation
  const { validateNumericString, sanitizeTextInput } = await import("@/lib/validation");

  // Convert invoice number to number if it's a string
  const invoiceNum = typeof invoiceNumber === "string" 
    ? (() => {
        const validation = validateNumericString(invoiceNumber);
        if (!validation.valid) {
          throw new Error("Invoice number must be a valid number");
        }
        return validation.number!;
      })()
    : invoiceNumber;

  logger.log("updateSalesData called for invoice:", invoiceNum);

  // Build update payload only with explicitly provided fields
  const payload: {
    sales_notes?: string;
    warehouse_notes?: string;
    team?: string | null;
    status?: string | null;
    action?: string | null;
  } = {};

  if (updates.sales_notes !== undefined) {
    const sanitized = sanitizeTextInput(updates.sales_notes);
    if (!sanitized.valid) {
      throw new Error(sanitized.error || "Invalid sales notes");
    }
    payload.sales_notes = sanitized.sanitized;
  }
  if (updates.warehouse_notes !== undefined) {
    const sanitized = sanitizeTextInput(updates.warehouse_notes);
    if (!sanitized.valid) {
      throw new Error(sanitized.error || "Invalid warehouse notes");
    }
    payload.warehouse_notes = sanitized.sanitized;
  }
  if (updates.team !== undefined) {
    const sanitized = sanitizeTextInput(updates.team || "", 100);
    if (!sanitized.valid) {
      throw new Error(sanitized.error || "Invalid team value");
    }
    payload.team = sanitized.sanitized || null;
  }
  if (updates.status !== undefined) {
    const sanitized = sanitizeTextInput(updates.status || "", 50);
    if (!sanitized.valid) {
      throw new Error(sanitized.error || "Invalid status value");
    }
    payload.status = sanitized.sanitized || null;
  }
  if (updates.action !== undefined) {
    const sanitized = sanitizeTextInput(updates.action || "", 50);
    if (!sanitized.valid) {
      throw new Error(sanitized.error || "Invalid action value");
    }
    payload.action = sanitized.sanitized || null;
  }

  // Use Supabase client to update - this handles RLS properly
  const { data, error } = await supabase
    .from("returns-app")
    .update(payload)
    .eq("InvoiceNumber", invoiceNum)
    .select();

  if (error) {
    logger.error("Supabase update error:", error);
    
    if (error.code === "42501") {
      throw new Error("You do not have permission to perform this action.");
    }
    
    throw new Error("Failed to update data. Please try again.");
  }

  logger.log("Update successful! Updated rows:", data?.length || 0);
  
  if (!data || data.length === 0) {
    throw new Error("No matching record found or you do not have permission to update it.");
  }

  return { success: true, data, updatedRows: data.length };
}

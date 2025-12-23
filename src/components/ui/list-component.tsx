import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "./button";
import InvoiceImageViewer from "./invoice-image-viewer";
import JSZip from "jszip";
import { logger } from "@/lib/logger";

type ListProps = {
  query?: string;
  filter?: string;
  monthFilter?: string;
  yearFilter?: string;
  assignedFilter?: string;
  assessedFilter?: string;
  showOnlyCompleted?: boolean; // If true, only show items with status "Completed"
  onSelect?: (item: any) => void;
  onBack?: () => void;
  showInlineImageViewer?: boolean; // If false, don't show image viewer inline (for responsive layouts)
  selectedInvoiceNumber?: string | null; // Invoice number of currently selected item for active styling
};

export default function ListComponent({
  query = "",
  filter = "All",
  monthFilter = "All",
  yearFilter = "All",
  assignedFilter = "All",
  assessedFilter = "All",
  showOnlyCompleted = false,
  onSelect,
  onBack,
  showInlineImageViewer = true, // Default to true for backward compatibility
  selectedInvoiceNumber = null,
}: ListProps) {
  const [dataList, setDataList] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRows() {
      logger.log("Fetching rows from database...");
      const { data, error } = await supabase.from("returns-app").select();
      if (error) {
        logger.error("Error fetching rows:", error);
      } else {
        logger.log("Fetched rows:", data?.length || 0);
      }
      setDataList(data || []);
    }
    fetchRows();
  }, []);

  const handleSelect = (invNum: string) => {
    const item = dataList.find(
      (el) => String(el.InvoiceNumber) === String(invNum)
    );
    if (item) {
      setSelectedInvoice(invNum);
      logger.log("Images for invoice:", invNum);
      onSelect?.(item);
    }
  };

  const downloadAllImages = async (invoiceNumber: string, images: string[], accountNumber: string) => {
    if (images.length === 0) return;

    try {
      const zip = new JSZip();
      
      // Fetch all images and add them to the zip
      const imagePromises = images.map(async (imageUrl, index) => {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const fileName = `${accountNumber}-${invoiceNumber}-${index + 1}.jpg`;
          zip.file(fileName, blob);
        } catch (error) {
          logger.error(`Error fetching image ${index + 1}:`, error);
        }
      });

      // Wait for all images to be fetched and added to zip
      await Promise.all(imagePromises);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Download the zip file
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${accountNumber}-${invoiceNumber}-images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      logger.error("Error creating zip file:", error);
    }
  };

  const q = query.trim().toLowerCase();

  // Apply completed filter FIRST if showOnlyCompleted is true
  let filtered = dataList;
  if (showOnlyCompleted) {
    // Only show items with status "Completed" - this is the ONLY check needed
    filtered = filtered.filter((el) => {
      const status = String(el.status || "").trim();
      return status.toLowerCase() === "completed";
    });
  }

  // Apply text search filter
  filtered = q
    ? filtered.filter(
        (el) =>
          String(el.InvoiceNumber).toLowerCase().includes(q) ||
          String(el.accountNumber).toLowerCase().includes(q) ||
          String(el.rNumber).toLowerCase().includes(q)
      )
    : filtered;

  // Apply team filter (from Select in Search) if not "All"
  const teamFilter = filter?.trim();
  if (teamFilter && teamFilter !== "All") {
    filtered = filtered.filter(
      (el) => String(el.team || "").trim() === teamFilter
    );
  }

  // Apply assigned/unassigned filter
  const assignedFilterTrimmed = assignedFilter?.trim();
  if (assignedFilterTrimmed && assignedFilterTrimmed !== "All") {
    if (assignedFilterTrimmed === "Assigned") {
      // Show only items with a team assigned
      filtered = filtered.filter((el) => el.team && String(el.team).trim() !== "");
    } else if (assignedFilterTrimmed === "Unassigned") {
      // Show only items without a team assigned
      filtered = filtered.filter((el) => !el.team || String(el.team).trim() === "");
    }
  }

  // Apply assessed/unassessed filter
  const assessedFilterTrimmed = assessedFilter?.trim();
  if (assessedFilterTrimmed && assessedFilterTrimmed !== "All") {
    if (assessedFilterTrimmed === "Assessed") {
      // Show only items with status "Assessed"
      filtered = filtered.filter((el) => String(el.status || "").trim() === "Assessed");
    } else if (assessedFilterTrimmed === "Unassessed") {
      // Show only items that are not "Assessed" (Logged, Completed, or null)
      filtered = filtered.filter((el) => String(el.status || "").trim() !== "Assessed");
    }
  }

  // Apply month/year filter based on `created_at` field
  const monthAbbrevs = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthFilterTrimmed = monthFilter?.trim();
  const yearFilterTrimmed = yearFilter?.trim();

  if (
    (monthFilterTrimmed && monthFilterTrimmed !== "All") ||
    (yearFilterTrimmed && yearFilterTrimmed !== "All")
  ) {
    filtered = filtered.filter((el) => {
      if (!el.created_at) return false;
      const d = new Date(el.created_at);
      if (Number.isNaN(d.getTime())) return false;

      const itemMonth = monthAbbrevs[d.getMonth()];
      const itemYear = String(d.getFullYear());
      const itemYearShort = itemYear.slice(-2); // Get last 2 digits for shorthand comparison

      const monthOk =
        !monthFilterTrimmed || monthFilterTrimmed === "All"
          ? true
          : itemMonth === monthFilterTrimmed;

      const yearOk =
        !yearFilterTrimmed || yearFilterTrimmed === "All"
          ? true
          : itemYearShort === yearFilterTrimmed || itemYear === yearFilterTrimmed; // Support both shorthand and full year

      return monthOk && yearOk;
    });
  }

  // Filter out items with status "Completed" for sales menu (if not showOnlyCompleted)
  if (!showOnlyCompleted) {
    filtered = filtered.filter((el) => {
      const status = String(el.status || "").trim();
      return status.toLowerCase() !== "completed";
    });
  }

  // Sort by date and time (newest first)
  filtered = [...filtered].sort((a, b) => {
    // Handle missing created_at fields
    if (!a.created_at && !b.created_at) return 0;
    if (!a.created_at) return 1; // Put items without date at the end
    if (!b.created_at) return -1; // Put items without date at the end
    
    const dateA = new Date(a.created_at);
    const dateB = new Date(b.created_at);
    
    // Check if dates are valid
    if (Number.isNaN(dateA.getTime()) && Number.isNaN(dateB.getTime())) return 0;
    if (Number.isNaN(dateA.getTime())) return 1;
    if (Number.isNaN(dateB.getTime())) return -1;
    
    // Sort descending (newest first)
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="h-full">
      {/* show current query */}

      {selectedInvoice && showInlineImageViewer ? (
        (() => {
          const selectedItem = dataList.find(
            (el) => String(el.InvoiceNumber) === String(selectedInvoice)
          );
          const images = selectedItem?.images || [];
          
          // Only show the image viewer if the item has images
          if (images.length > 0) {
            return (
              <InvoiceImageViewer
                invoiceNumber={selectedInvoice}
                images={images}
                accountNumber={selectedItem?.accountNumber}
                onBack={() => {
                  setSelectedInvoice(null);
                  onBack?.();
                }}
                headerActions={
                  <Button
                    onClick={() => downloadAllImages(selectedInvoice, images, selectedItem?.accountNumber || "")}
                    variant="outline"
                  >
                    Download All
                  </Button>
                }
              />
            );
          } else {
            // Show a message if no images
            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Images for {selectedInvoice}</h3>
                  <Button
                    onClick={() => {
                      setSelectedInvoice(null);
                      onBack?.();
                    }}
                  >
                    Back
                  </Button>
                </div>
                <p className="text-sm text-gray-500">No images found</p>
              </div>
            );
          }
        })()
      ) : (
        <div>
          {filtered.map((element) => {
            // Get status circle color (traffic light colors)
            const getStatusCircleColor = (status: string | null | undefined): string => {
              if (!status) return "bg-gray-500";
              const statusLower = status.toLowerCase();
              if (statusLower === "logged") return "bg-red-600";
              if (statusLower === "assessed") return "bg-orange-600";
              if (statusLower === "completed") return "bg-green-600";
              return "bg-gray-500";
            };

            // Get allocated/team circle color (red if no team, green if team exists)
            const getTeamCircleColor = (team: string | null | undefined): string => {
              if (!team || team.trim() === "") return "bg-red-600";
              return "bg-green-600";
            };

            const isActive = selectedInvoiceNumber === String(element.InvoiceNumber);
            
            return (
              <Button
                key={element.InvoiceNumber}
                onClick={() => handleSelect(String(element.InvoiceNumber))}
                className={`w-full h-auto mb-1 border-b text-left flex flex-row gap-2 items-start justify-start ${
                  isActive ? "bg-primary/80 border-2 border-red-500" : ""
                }`}
              >
                <div className="flex flex-col flex-wrap gap-2 text-left items-start justify-center h-16">
                    <p className="text-left">Acc: {element.accountNumber ? element.accountNumber.toUpperCase() : "N/A"}</p>
                    <p className="text-left">RA: {element.rNumber ? `${element.rNumber}` : "Damages"}</p>                  
                    <p className="text-left">Inv: {element.InvoiceNumber || "N/A"}</p>
                    <br></br>
                </div>
              
                <div className="flex flex-col ml-auto gap-2 items-start justify-center h-16 text-left">
                  <div className="flex items-center gap-2 justify-start">
                    <span className="text-sm text-left">Assigned:</span>
                    <div className={`w-4 h-4 rounded-full ${getTeamCircleColor(element.team)}`} title={element.team || "Unassigned"} />
                    
                  </div>
                  <div className="flex items-center gap-2 justify-start">
                    <span className="text-sm text-left">Status:</span>
                    <div className={`w-4 h-4 rounded-full ${getStatusCircleColor(element.status)}`} title={element.status || "N/A"} />
                    
                  </div>
                </div>
              </Button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-500">No results</p>
          )}
        </div>
      )}
    </div>
  );
}

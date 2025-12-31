import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import InvoiceImageViewer from "@/components/ui/invoice-image-viewer";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";

type ItemDetailsPanelProps = {
  returnsNumber: string;
  invoiceNumber: string;
  accountNumber: string;
  warehouse_notes: string;
  sales_notes: string;
  allocated: string;
  action: string;
  status: string;
  loading: boolean;
  images: string[];
  accountNumberForImages: string;
  onReturnsNumberChange: (value: string) => void;
  onInvoiceNumberChange: (value: string) => void;
  onAccountNumberChange: (value: string) => void;
  onWarehouseNotesChange: (value: string) => void;
  onSalesNotesChange: (value: string) => void;
  onTeamChange: (value: string) => void;
  onActionChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onUpdate: () => void;
  onBack: () => void;
  requireTeamAndActionForCompleted?: boolean; // If true, validate team and action before allowing Completed status
};

export default function ItemDetailsPanel({
  returnsNumber,
  invoiceNumber,
  accountNumber,
  warehouse_notes,
  sales_notes,
  allocated,
  action,
  status,
  loading,
  images,
  accountNumberForImages,
  onReturnsNumberChange,
  onInvoiceNumberChange,
  onAccountNumberChange,
  onWarehouseNotesChange,
  onSalesNotesChange,
  onTeamChange,
  onActionChange,
  onStatusChange,
  onUpdate,
  onBack,
  requireTeamAndActionForCompleted = false,
}: ItemDetailsPanelProps) {
  // Track if user has scrolled to enable dropdown buttons
  const [hasScrolled, setHasScrolled] = useState(false);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const desktopContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = (element: HTMLElement | Window) => {
      const scrollTop = element === window 
        ? window.pageYOffset || document.documentElement.scrollTop
        : (element as HTMLElement).scrollTop;
      
      if (scrollTop > 10) {
        setHasScrolled(true);
      } else {
        setHasScrolled(false);
      }
    };

    // Check initial scroll position
    handleScroll(window);
    if (mobileContainerRef.current) {
      handleScroll(mobileContainerRef.current);
    }
    if (desktopContainerRef.current) {
      handleScroll(desktopContainerRef.current);
    }

    // Listen for window scroll events
    const handleWindowScroll = () => handleScroll(window);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    
    // Listen for container scroll events
    const mobileContainer = mobileContainerRef.current;
    const desktopContainer = desktopContainerRef.current;
    
    const handleMobileScroll = () => {
      if (mobileContainer) handleScroll(mobileContainer);
    };
    
    const handleDesktopScroll = () => {
      if (desktopContainer) handleScroll(desktopContainer);
    };

    if (mobileContainer) {
      mobileContainer.addEventListener('scroll', handleMobileScroll, { passive: true });
    }
    
    if (desktopContainer) {
      desktopContainer.addEventListener('scroll', handleDesktopScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      if (mobileContainer) {
        mobileContainer.removeEventListener('scroll', handleMobileScroll);
      }
      if (desktopContainer) {
        desktopContainer.removeEventListener('scroll', handleDesktopScroll);
      }
    };
  }, []);

  const downloadAllImages = async (invoiceNumber: string, images: string[], accountNumber: string) => {
    if (images.length === 0) return;

    try {
      const JSZip = (await import("jszip")).default;
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

  const handleStatusChange = (value: string) => {
    // Validate that Completed status requires team and action if required
    if (requireTeamAndActionForCompleted && value === "Completed") {
      if (!allocated || allocated.trim() === "") {
        toast.error("Please assign a team before marking as Completed");
        return;
      }
      if (!action || action.trim() === "") {
        toast.error("Please select an action before marking as Completed");
        return;
      }
    }
    onStatusChange(value);
  };

  return (
    <>
      {/* Desktop: Right Side - Details and Images (md+ only when item selected) */}
      <div ref={desktopContainerRef} className="md:flex-1 md:flex md:flex-col hidden md:flex h-full overflow-y-auto">
        {/* Details Form - Top Right */}
        <div className="shadow-md p-4 sm:p-6 flex flex-col gap-4 md:border-b">
          <Button className="sm:w-auto w-full md:w-auto" onClick={onBack}>
            Back
          </Button>
          <div className="flex flex-col gap-4">
            <div className="flex sm:flex-row sm:flex-wrap gap-2
            ">
            <Label htmlFor="account">Account number:</Label>
            <Input
              placeholder="Account Number"
              value={accountNumber}
              onChange={(e) => onAccountNumberChange(e.target.value)}
              disabled={!accountNumber}
              id="account"
            />
            <Label htmlFor="invoice">Invoice Number:</Label>
            <Input
              placeholder="Invoice Number"
              value={invoiceNumber}
              onChange={(e) => onInvoiceNumberChange(e.target.value)}
              disabled={!invoiceNumber}
              id="invoice"
            />
            <Label htmlFor="returns-number">Returns Number:</Label>
            <Input
              placeholder="Returns Number"
              value={returnsNumber}
              onChange={(e) => onReturnsNumberChange(e.target.value)}
              disabled={!returnsNumber}
              id="returns-number"
            />
            </div>
            <Label htmlFor="warehouse-notes">Warehouse Notes:</Label>
            <Textarea
              className="col-span-2"
              placeholder="Warehouse Notes"
              value={warehouse_notes}
              onChange={(e) => onWarehouseNotesChange(e.target.value)}
              rows={3}
              disabled={!invoiceNumber}
              id="warehouse-notes"
            />
            <Label htmlFor="sales-notes">Sales Notes:</Label>
            <Textarea
              className="col-span-2"
              placeholder="Sales Notes"
              value={sales_notes}
              onChange={(e) => onSalesNotesChange(e.target.value)}
              rows={3}
              disabled={!invoiceNumber}
              id="sales-notes"
            />
            {/* Team allocation */}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!invoiceNumber || !hasScrolled}>
                  {allocated ? `Team: ${allocated}` : "Allocate Team"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Teams</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={allocated}
                  onValueChange={onTeamChange}
                >
                  <DropdownMenuRadioItem value="Uk Sales">
                    Uk Sales
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Export">
                    Export
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Supermarket">
                    Supermarket
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Amazon">
                    Amazon
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Exceptions">
                    Exceptions
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Action */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!invoiceNumber || !hasScrolled}>
                  {action ? `Action: ${action}` : "Set Action"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Action</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={action}
                  onValueChange={onActionChange}
                >
                  <DropdownMenuRadioItem value="Pulp">
                    Pulp
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Back to Stock">
                    Back to Stock
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Credit">
                    Credit
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Return to Customer">
                    Return to Customer
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Item Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!invoiceNumber || !hasScrolled}>
                  {status ? `Status: ${status}` : "Set Status"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={status}
                  onValueChange={handleStatusChange}
                >
                  <DropdownMenuRadioItem value="Logged">
                    Logged
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="Assessed">
                    Assessed
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem 
                    value="Completed"
                    disabled={requireTeamAndActionForCompleted && (!allocated || allocated.trim() === "" || !action || action.trim() === "")}
                  >
                    Completed
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              className="col-span-2 sm:col-span-3 w-full"
              onClick={onUpdate}
              disabled={loading || !invoiceNumber}
            >
              {loading ? "Submitting Changes" : "Submit Changes"}
            </Button>
          </div>
        </div>

        {/* Images - Bottom Right */}
        {images.length > 0 && (
          <div className="p-4">
            <InvoiceImageViewer
              invoiceNumber={invoiceNumber}
              images={images}
              accountNumber={accountNumberForImages}
              onBack={onBack}
              headerActions={
                <Button
                  onClick={() => downloadAllImages(invoiceNumber, images, accountNumberForImages)}
                  variant="outline"
                >
                  Download All
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* Mobile: Show details form below list when item selected */}
      <div ref={mobileContainerRef} className="md:hidden shadow-md p-4 sm:p-6 flex flex-col gap-4">
        <Button className="sm:w-auto" onClick={onBack}>
          Back
        </Button>
        <div className="flex flex-col gap-4">
          <Label htmlFor="account-mobile">Account number:</Label>
          <Input
            placeholder="Account Number"
            value={accountNumber}
            onChange={(e) => onAccountNumberChange(e.target.value)}
            disabled={!accountNumber}
            id="account-mobile"
          />
          <Label htmlFor="invoice-mobile">Invoice Number:</Label>
          <Input
            placeholder="Invoice Number"
            value={invoiceNumber}
            onChange={(e) => onInvoiceNumberChange(e.target.value)}
            disabled={!invoiceNumber}
            id="invoice-mobile"
          />
          <Label htmlFor="returns-number-mobile">Returns Number:</Label>
          <Input
            placeholder="Returns Number"
            value={returnsNumber}
            onChange={(e) => onReturnsNumberChange(e.target.value)}
            disabled={!returnsNumber}
            id="returns-number-mobile"
          />
          <Label htmlFor="warehouse-notes-mobile">Warehouse Notes:</Label>
          <Textarea
            className="col-span-2"
            placeholder="Warehouse Notes"
            value={warehouse_notes}
            onChange={(e) => onWarehouseNotesChange(e.target.value)}
            rows={3}
            disabled={!invoiceNumber}
            id="warehouse-notes-mobile"
          />
          <Label htmlFor="sales-notes-mobile">Sales Notes:</Label>
          <Textarea
            className="col-span-2"
            placeholder="Sales Notes"
            value={sales_notes}
            onChange={(e) => onSalesNotesChange(e.target.value)}
            rows={3}
            disabled={!invoiceNumber}
            id="sales-notes-mobile"
          />
          {/* Team allocation */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!invoiceNumber || !hasScrolled}>
                {allocated ? `Team: ${allocated}` : "Allocate Team"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Teams</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={allocated}
                onValueChange={onTeamChange}
              >
                <DropdownMenuRadioItem value="Uk Sales">
                  Uk Sales
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Export">
                  Export
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Supermarket">
                  Supermarket
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Amazon">
                  Amazon
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Exceptions">
                  Exceptions
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Action */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!invoiceNumber || !hasScrolled}>
                {action ? `Action: ${action}` : "Set Action"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Action</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={action}
                onValueChange={onActionChange}
              >
                <DropdownMenuRadioItem value="Pulp">
                  Pulp
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Back to Stock">
                  Back to Stock
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Credit">
                  Credit
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Return to Customer">
                  Return to Customer
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Item Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!invoiceNumber || !hasScrolled}>
                {status ? `Status: ${status}` : "Set Status"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={status}
                onValueChange={handleStatusChange}
              >
                <DropdownMenuRadioItem value="Logged">
                  Logged
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Assessed">
                  Assessed
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem 
                  value="Completed"
                  disabled={requireTeamAndActionForCompleted && (!allocated || allocated.trim() === "" || !action || action.trim() === "")}
                >
                  Completed
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            className="col-span-2 sm:col-span-3 w-full"
            onClick={onUpdate}
            disabled={loading || !invoiceNumber}
          >
            {loading ? "Submitting Changes" : "Submit Changes"}
          </Button>
        </div>
        {/* Mobile Images */}
        {images.length > 0 && (
          <div className="mt-4">
            <InvoiceImageViewer
              invoiceNumber={invoiceNumber}
              images={images}
              accountNumber={accountNumberForImages}
              onBack={onBack}
              headerActions={
                <Button
                  onClick={() => downloadAllImages(invoiceNumber, images, accountNumberForImages)}
                  variant="outline"
                >
                  Download All
                </Button>
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

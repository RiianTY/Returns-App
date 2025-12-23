import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { logger, sanitizeErrorMessage } from "@/lib/logger";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import ListComponent from "@/components/ui/list-component";
import Search from "@/components/ui/search";
import ItemDetailsPanel from "@/components/ui/item-details-panel";
import { updateSalesData } from "@/components/ui/upload";

const MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function FinalMenu() {
  const [search, setSearch] = useState<string>("");
  const [teamFilter, setTeamFilter] = useState<string>("All");
  const [assignedFilter, setAssignedFilter] = useState<string>("All");
  const [assessedFilter, setAssessedFilter] = useState<string>("All");
  const now = new Date();
  const defaultMonth = MONTH_ABBREVS[now.getMonth()];
  const defaultYear = String(now.getFullYear()).slice(-2); // Use shorthand year (25, 26, etc.)
  const [monthFilter, setMonthFilter] = useState<string>(defaultMonth);
  const [yearFilter, setYearFilter] = useState<string>(defaultYear);
  const [returnsNumber, setReturnsNumber] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [warehouse_notes, setWarehouseNotes] = useState("");
  const [sales_notes, setSalesNotes] = useState("");
  const [allocated, setAllocated] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("Completed");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItemImages, setSelectedItemImages] = useState<string[]>([]);
  const [selectedItemAccountNumber, setSelectedItemAccountNumber] = useState<string>("");

  // Function to refresh the list
  const refreshList = () => {
    logger.log("Refreshing list");
    setRefreshKey((prev) => prev + 1);
  };

  const handleSelect = (item: any) => {
    if (item) {
      logger.log("Item selected");
      setReturnsNumber(item.rNumber || "");
      // Ensure invoice number is stored as string for consistency
      setInvoiceNumber(String(item.InvoiceNumber || ""));
      setAccountNumber(item.accountNumber || "");
      setWarehouseNotes(item.warehouse_notes || "");
      setSalesNotes(item.sales_notes || "");
      setAllocated(item.team || "");
      setAction(item.action || "");
      setStatus(item.status || "Completed");
      // Store images and account number for display
      setSelectedItemImages(item.images || []);
      setSelectedItemAccountNumber(item.accountNumber || "");
    }
  };

  const handleBack = () => {
    setReturnsNumber("");
    setInvoiceNumber("");
    setAccountNumber("");
    setWarehouseNotes("");
    setSalesNotes("");
    setAllocated("");
    setAction("");
    setStatus("Completed");
    setSelectedItemImages([]);
    setSelectedItemAccountNumber("");
  };

  const handleTeamChange = (value: string) => {
    setAllocated(value);
  };

  const handleActionChange = (value: string) => {
    setAction(value);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
  };

  const handleUpdate = async () => {
    // Check if we have an invoice number
    if (!invoiceNumber) {
      toast.warning("Please select an item first");
      return;
    }

    logger.log("handleUpdate called");

    // Always update database with current input field values (overwrite existing)
    setLoading(true);
    try {
      // Step 1: Update the database with new values
      await updateSalesData(invoiceNumber, {
        warehouse_notes: warehouse_notes,
        sales_notes: sales_notes,
        team: allocated || null,
        action: action || null,
        status: status || null,
      });

      logger.log("Database updated successfully");

      // Step 2: Retrieve the updated data from the database
      const invoiceNum = parseInt(invoiceNumber, 10);
      const { data: updatedData, error: fetchError } = await supabase
        .from("returns-app")
        .select()
        .eq("InvoiceNumber", invoiceNum)
        .single();

      if (fetchError) {
        logger.error("Error fetching updated data:", fetchError);
        throw new Error("Failed to retrieve updated data. Please try again.");
      }

      logger.log("Retrieved updated data from database");

      // Step 3: Update form fields with fresh data from database
      if (updatedData) {
        setWarehouseNotes(updatedData.warehouse_notes || "");
        setSalesNotes(updatedData.sales_notes || "");
        setAllocated(updatedData.team || "");
        setAction(updatedData.action || "");
        setStatus(updatedData.status || "Completed");
      }

      // Step 4: Refresh the list to show updated data
      refreshList();

      toast.success("Updated successfully!");
      
      // Step 5: Reset state to default so search shows back up
      handleBack();
    } catch (error) {
      logger.error("Update error in handleUpdate:", error);
      const errorMessage = sanitizeErrorMessage(error);
      toast.error(`Error updating notes: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="w-full min-h-screen md:h-screen flex flex-col md:flex-row md:overflow-hidden">
      {/* Left Side - Search and List (always visible on md+, hidden on mobile when item selected) */}
      <div className={`flex flex-col flex-1 bg-white md:border-r md:max-w-md ${invoiceNumber ? "hidden md:flex" : ""}`}>
        <div className="flex-shrink-0 p-4">
          <div className="flex lg:gap-2 gap-[4%] w-full">
            <Button asChild className="lg:w-fit w-[48%]">
              <Link to="/">Home</Link>
            </Button>
            <Button
              className="lg:w-fit w-[48%]"
              variant="outline"
              onClick={refreshList}
            >
              Refresh
            </Button>
          </div>
          
          <hr className="pb-8 mt-4"></hr>
          {/* Search bar always visible on md+ screens */}
          <Search
            search={search}
            setSearch={setSearch}
            filter={teamFilter}
            setFilter={setTeamFilter}
            monthFilter={monthFilter}
            setMonthFilter={setMonthFilter}
            yearFilter={yearFilter}
            setYearFilter={setYearFilter}
            assignedFilter={assignedFilter}
            setAssignedFilter={setAssignedFilter}
            assessedFilter={assessedFilter}
            setAssessedFilter={setAssessedFilter}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 pt-0">
          <ListComponent
            key={refreshKey}
            query={search}
            filter={teamFilter}
            monthFilter={monthFilter}
            yearFilter={yearFilter}
            assignedFilter={assignedFilter}
            assessedFilter={assessedFilter}
            showOnlyCompleted={true}
            onSelect={handleSelect}
            onBack={handleBack}
            showInlineImageViewer={false}
            selectedInvoiceNumber={invoiceNumber}
          />
        </div>
      </div>

      {/* Right Side - Details and Images Panel */}
      {invoiceNumber && (
        <ItemDetailsPanel
          returnsNumber={returnsNumber}
          invoiceNumber={invoiceNumber}
          accountNumber={accountNumber}
          warehouse_notes={warehouse_notes}
          sales_notes={sales_notes}
          allocated={allocated}
          action={action}
          status={status}
          loading={loading}
          images={selectedItemImages}
          accountNumberForImages={selectedItemAccountNumber}
          onReturnsNumberChange={setReturnsNumber}
          onInvoiceNumberChange={setInvoiceNumber}
          onAccountNumberChange={setAccountNumber}
          onWarehouseNotesChange={setWarehouseNotes}
          onSalesNotesChange={setSalesNotes}
          onTeamChange={handleTeamChange}
          onActionChange={handleActionChange}
          onStatusChange={handleStatusChange}
          onUpdate={handleUpdate}
          onBack={handleBack}
          requireTeamAndActionForCompleted={false}
        />
      )}
    </div>
  );
}

export default FinalMenu;

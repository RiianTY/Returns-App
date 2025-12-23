import React from "react";
import { Input } from "./input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SearchProps = {
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  filter: string;
  setFilter: React.Dispatch<React.SetStateAction<string>>;
  monthFilter: string;
  setMonthFilter: React.Dispatch<React.SetStateAction<string>>;
  yearFilter: string;
  setYearFilter: React.Dispatch<React.SetStateAction<string>>;
  assignedFilter?: string;
  setAssignedFilter?: React.Dispatch<React.SetStateAction<string>>;
  assessedFilter?: string;
  setAssessedFilter?: React.Dispatch<React.SetStateAction<string>>;
};

function Search({
  search,
  setSearch,
  filter,
  setFilter,
  monthFilter,
  setMonthFilter,
  yearFilter,
  setYearFilter,
  assignedFilter = "All",
  setAssignedFilter,
  assessedFilter = "All",
  setAssessedFilter,
}: SearchProps) {
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const currentYear = new Date().getFullYear();
  // Generate shorthand years (25, 26, 27, etc.)
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - i;
    return String(year).slice(-2); // Get last 2 digits
  });

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Search bar with month and year filters inside - full width */}
      <div className="w-full flex items-center bg-transparent border rounded-md">
        <Input 
          placeholder="Search" 
          value={search} 
          onChange={handleSearch}
          className="border-0 focus-visible:ring-0 focus-visible:border-0 flex-1"
        />
        <div className="flex items-center gap-2 pl-2">
          {/* Month filter */}
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="h-7 w-20 border-0 shadow-none bg-transparent">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Jan">Jan</SelectItem>
              <SelectItem value="Feb">Feb</SelectItem>
              <SelectItem value="Mar">Mar</SelectItem>
              <SelectItem value="Apr">Apr</SelectItem>
              <SelectItem value="May">May</SelectItem>
              <SelectItem value="Jun">Jun</SelectItem>
              <SelectItem value="Jul">Jul</SelectItem>
              <SelectItem value="Aug">Aug</SelectItem>
              <SelectItem value="Sep">Sep</SelectItem>
              <SelectItem value="Oct">Oct</SelectItem>
              <SelectItem value="Nov">Nov</SelectItem>
              <SelectItem value="Dec">Dec</SelectItem>
            </SelectContent>
          </Select>

          {/* Year filter with shorthand years */}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-7 w-16 border-0 shadow-none">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team and Assignment filters */}
      <div className="flex flex-row gap-1 items-center justify-center flex-wrap">
        {/* Team filter */}
        <div> 
        
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">Team: All</SelectItem>
            <SelectItem value="Uk Sales">Team: Uk Sales</SelectItem>
            <SelectItem value="Export">Team: Export</SelectItem>
            <SelectItem value="Supermarket">Team: Supermarket</SelectItem>
            <SelectItem value="Amazon">Team: Amazon</SelectItem>
            <SelectItem value="Exceptions">Team: Exceptions</SelectItem>
          </SelectContent>
        </Select>
        </div>
        

        {/* Assigned filter */}
        {setAssignedFilter && (
          <div>
          
          <Select value={assignedFilter} onValueChange={setAssignedFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Assignment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Assign: All</SelectItem>
              <SelectItem value="Assigned">Assign: Assigned</SelectItem>
              <SelectItem value="Unassigned">Assign: Unassigned</SelectItem>
            </SelectContent>
          </Select>
        </div>)}

        {/* Assessed filter */}
        {setAssessedFilter && (
          <div>
          <Select value={assessedFilter} onValueChange={setAssessedFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Assessment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">Assessed: All</SelectItem>
              <SelectItem value="Assessed">Assessed: Assessed</SelectItem>
              <SelectItem value="Unassessed">Assessed: Unassessed</SelectItem>
            </SelectContent>
          </Select>
        </div>)}
      </div>
    </div>
  );
}

export default Search;

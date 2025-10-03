"use client";

import React, { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import FilterToggleButton from "@/components/ui/filter-toggle-button";
import { usePermissions } from "@/hooks/use-permissions";
import { usePathname } from "next/navigation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showAddButton?: boolean;
  addButtonText?: string;
  onAddClick?: () => void;
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
  
  // Filter functionality
  showFilterButton?: boolean;
  hasActiveFilters?: boolean;
  isFilterExpanded?: boolean;
  onFilterToggle?: () => void;
  activeFiltersCount?: number;
  filterText?: string;
  clearFiltersText?: string;
  
  // Refresh functionality
  showRefreshButton?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  showAddButton = true,
  addButtonText = "Add New",
  onAddClick,
  actions,
  className,
  children,
  
  // Filter props
  showFilterButton = false,
  hasActiveFilters = false,
  isFilterExpanded = false,
  onFilterToggle,
  activeFiltersCount = 0,
  filterText = "Filter",
  clearFiltersText = "Clear Filters",
  
  // Refresh props
  showRefreshButton = false,
  onRefresh,
  isRefreshing = false,
}) => {
    const pathname = usePathname()
    const allowedResources = pathname?.split("/")[1] || "/"
    const { canCreate } = usePermissions();
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex-col flex justify-between items-start md:items-center mb-5 gap-3 md:gap-0 md:flex-row">
        {/* Title Section */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-sm hidden md:block text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {/* Actions Section */}
        <div className="flex items-center gap-3">
          {/* Filter Toggle Button */}
          {showFilterButton && onFilterToggle && (
            <FilterToggleButton
              hasActiveFilters={hasActiveFilters}
              isExpanded={isFilterExpanded}
              onToggle={onFilterToggle}
              activeFiltersCount={activeFiltersCount}
              filterText={filterText}
              clearText={clearFiltersText}
            />
          )}
          
          {/* Refresh Button */}
          {showRefreshButton && onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="border-border hover:bg-accent"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
          
          {/* Custom Actions */}
          {actions}
          
          {/* Add Button */}
          {(showAddButton && canCreate(allowedResources)) && (
            <Button
              onClick={onAddClick}
              className="whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              {addButtonText}
            </Button>
          )}
        </div>
      </div>


      {/* Additional Content */}
      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
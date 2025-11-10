"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchableSelect } from "./generic-form";

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  placeholder?: string;
  options?: { value: string; label: string }[];
  cols?: number;
  smCols?: number;
  mdCols?: number;
  lgCols?: number;
  xlCols?: number;
  searchable?: boolean;
}

export interface FilterConfig {
  fields: FilterField[];
  defaultValues?: Record<string, any>;
}

interface GenericFilterProps {
  config: FilterConfig;
  values: Record<string, any>; // These are the applied filters
  onFilterChange: (filters: Record<string, any>) => void; // Called when Search button is clicked
  onReset?: () => void;
  className?: string;
  collapsible?: boolean;
  title?: string;
  loading?: boolean;
  clearText?: string;
}

const GenericFilter: React.FC<GenericFilterProps> = ({
  config,
  values: appliedFilters, // Rename for clarity
  onFilterChange,
  onReset,
  className,
  collapsible = true,
  title = "Filters",
  loading = false,
  clearText = "Clear Filters",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Local state for form values (not applied until Search is clicked)
  const [formValues, setFormValues] = useState<Record<string, any>>(
    appliedFilters || config.defaultValues || {}
  );

  const handleFieldChange = (key: string, value: any) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    // Apply the filters by calling onFilterChange with current form values
    onFilterChange(formValues);
    // Close panel if collapsible
    if (collapsible) setIsExpanded(false);
  };

  const handleReset = () => {
    const resetValues = config.defaultValues || {};
    setFormValues(resetValues);
    onFilterChange(resetValues);
    if (collapsible) setIsExpanded(false);
  };

  // Check if there are active applied filters (for badges)
  const hasActiveFilters = Object.values(appliedFilters).some(value =>
    value !== '' && value !== null && value !== undefined && value !== 'all'
  );

  // Check if form has been modified from applied filters
  const hasChanges = JSON.stringify(formValues) !== JSON.stringify(appliedFilters);

  // Active filter count for badges
  // const activeCount = Object.values(appliedFilters).filter(v => v && v !== 'all').length;
  const activeCount = Object.values(appliedFilters).filter(v => v && v !== 'all').length;

  const baseToggleClasses = (extra?: string) => cn(
    "flex items-center gap-2 transition-all duration-200",
    "border-border hover:bg-accent hover:text-accent-foreground",
    hasActiveFilters && "border-primary text-primary hover:border-primary/80",
    extra
  );

  const renderField = (field: FilterField) => {
    const cols = field.cols || 12;
    const smCols = field.smCols;
    const mdCols = field.mdCols;
    const lgCols = field.lgCols;
    const xlCols = field.xlCols;

    const colClasses = [
      `col-span-${Math.min(12, Math.max(1, cols))}`,
      smCols && `sm:col-span-${Math.min(12, Math.max(1, smCols))}`,
      mdCols && `md:col-span-${Math.min(12, Math.max(1, mdCols))}`,
      lgCols && `lg:col-span-${Math.min(12, Math.max(1, lgCols))}`,
      xlCols && `xl:col-span-${Math.min(12, Math.max(1, xlCols))}`,
    ].filter(Boolean).join(' ');

    switch (field.type) {
      case 'text':
        return (
          <div key={field.key} className={cn("space-y-2", colClasses)}>
            <Label htmlFor={field.key} className="text-sm font-medium text-foreground">
              {field.label}
            </Label>
            <div className="relative">
              <Input
                id={field.key}
                type="text"
                placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                value={formValues[field.key] || ''}
                onChange={(e) => handleFieldChange(field.key, e.target.value)}
                className="bg-background border-border focus:ring-primary pr-8"
              />
              {field.key === 'search' && (
                <Search className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.key} className={cn("space-y-2", colClasses)}>
            <Label htmlFor={field.key} className="text-sm font-medium text-foreground">
              {field.label}
            </Label>
            {field.searchable ? (
              <SearchableSelect
                value={formValues[field.key] || ''}
                onValueChange={(value) => handleFieldChange(field.key, value)}
                options={field.options || []}
                placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`}
                disabled={loading}
                loading={false}
              />
            ) : (
              <Select
                value={formValues[field.key] || ''}
                onValueChange={(value) => handleFieldChange(field.key, value)}
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.key} className={cn("space-y-2", colClasses)}>
            <Label htmlFor={field.key} className="text-sm font-medium text-foreground">
              {field.label}
            </Label>
            <Input
              id={field.key}
              type="date"
              value={formValues[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="bg-background border-border focus:ring-primary"
            />
          </div>
        );

      case 'number':
        return (
          <div key={field.key} className={cn("space-y-2", colClasses)}>
            <Label htmlFor={field.key} className="text-sm font-medium text-foreground">
              {field.label}
            </Label>
            <Input
              id={field.key}
              type="number"
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              value={formValues[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="bg-background border-border focus:ring-primary"
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (collapsible) {
    return (
      <div className={cn("relative", className)}>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="grid grid-cols-12 gap-4">
              {config.fields.map(renderField)}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSearch}
                aria-label="Search Filters"
                className={cn(
                  "bg-primary text-primary-foreground hover:bg-primary/90",
                  !hasChanges && "opacity-50"
                )}
                disabled={loading}
              >
                <Search className="h-4 w-4 mr-2" />
                Search Filters
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                aria-label="Clear Filters"
                disabled={!hasActiveFilters}
                className={baseToggleClasses()}
              >
                <X className="h-4 w-4 mr-2" />
                {clearText}
                {activeCount > 0 && (
                  <span className="ml-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                    {activeCount}
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default GenericFilter;
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Filter, X, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number';
  placeholder?: string;
  options?: { value: string; label: string }[];
  cols?: number; // Grid columns out of 12 for mobile (default)
  smCols?: number; // Small screens (640px+)
  mdCols?: number; // Medium screens (768px+)
  lgCols?: number; // Large screens (1024px+)
  xlCols?: number; // Extra large screens (1280px+)
}

export interface FilterConfig {
  fields: FilterField[];
  defaultValues?: Record<string, any>;
}

interface GenericFilterProps {
  config: FilterConfig;
  values: Record<string, any>;
  onFilterChange: (filters: Record<string, any>) => void;
  onReset?: () => void;
  className?: string;
  collapsible?: boolean;
  title?: string;
  loading?: boolean; // Add loading state for search
  onSearchChange?: (searchTerm: string) => void; // For debounced search
}

const GenericFilter: React.FC<GenericFilterProps> = ({
  config,
  values,
  onFilterChange,
  onReset,
  className,
  collapsible = true,
  title = "Filters",
  loading = false,
  onSearchChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFieldChange = (key: string, value: any) => {
    const newFilters = { ...values, [key]: value };
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const resetValues = config.defaultValues || {};
    onFilterChange(resetValues);
    if (onReset) {
      onReset();
    }
  };

  const hasActiveFilters = Object.values(values).some(value => 
    value !== '' && value !== null && value !== undefined && value !== 'all'
  );

  const renderField = (field: FilterField) => {
    const cols = field.cols || 12; // Default to full width on mobile
    const smCols = field.smCols;
    const mdCols = field.mdCols;
    const lgCols = field.lgCols;
    const xlCols = field.xlCols;

    // Build responsive classes
    const colClasses = [
      `col-span-${Math.min(12, Math.max(1, cols))}`, // Base mobile class
      smCols && `sm:col-span-${Math.min(12, Math.max(1, smCols))}`,
      mdCols && `md:col-span-${Math.min(12, Math.max(1, mdCols))}`,
      lgCols && `lg:col-span-${Math.min(12, Math.max(1, lgCols))}`,
      xlCols && `xl:col-span-${Math.min(12, Math.max(1, xlCols))}`,
    ].filter(Boolean).join(' ');

    switch (field.type) {
      case 'text':
        // Check if this is a search field and we have search-specific handling
        const isSearchField = field.key === 'search' && onSearchChange;
        
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
                value={values[field.key] || ''}
                onChange={(e) => {
                  if (isSearchField) {
                    onSearchChange!(e.target.value);
                  } else {
                    handleFieldChange(field.key, e.target.value);
                  }
                }}
                className="bg-background border-border focus:ring-primary pr-8"
              />
              {isSearchField && loading && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
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
            <Select
              value={values[field.key] || ''}
              onValueChange={(value) => handleFieldChange(field.key, value)}
            >
              <SelectTrigger className="bg-background border-border focus:ring-primary">
                <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {field.options?.filter(option => option.value !== '' && option.value != null).map((option) => (
                  <SelectItem 
                    key={option.value} 
                    value={option.value.toString()}
                    className="focus:bg-accent focus:text-accent-foreground"
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              value={values[field.key] || ''}
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
              value={values[field.key] || ''}
              onChange={(e) => handleFieldChange(field.key, e.target.value)}
              className="bg-background border-border focus:ring-primary"
            />
          </div>
        );

      default:
        return null;
    }
  };

  if (!collapsible) {
    return (
      <Card className={cn("bg-card border-border", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          <div className="grid grid-cols-12 gap-4">
            {config.fields.map(renderField)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "flex items-center gap-2 transition-all duration-200",
            "border-border hover:bg-accent hover:text-accent-foreground",
            hasActiveFilters && "border-primary text-primary hover:border-primary/80"
          )}
        >
          <Filter className={cn(
            "h-4 w-4 transition-transform duration-200",
            isExpanded && "rotate-180"
          )} />
          {title}
          {hasActiveFilters && (
            <span className="ml-1 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
              {Object.values(values).filter(v => v && v !== 'all').length}
            </span>
          )}
        </Button>
      </div>

      {/* Collapsible Filter Content */}
      {isExpanded && (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-12 gap-4">
              {config.fields.map(renderField)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GenericFilter;
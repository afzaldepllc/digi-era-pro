"use client";

import React, { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  modalSize?: "sm" | "md" | "lg" | "xl" | "full";
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

const modalSizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-7xl"
};

const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  actions,
  modalSize = "md",
  className,
  showCloseButton = true,
}) => {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className="relative z-10 w-full max-h-[95vh] overflow-hidden mx-4"
        onClick={onClose}
      >
        <div
          className={cn(
        "relative w-full mx-auto bg-background border border-border rounded-lg shadow-lg transform transition-all duration-300 scale-100 opacity-100",
        "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
        modalSizes[modalSize],
        className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
        <h3
          id="modal-title"
          className="text-lg font-semibold text-foreground"
        >
          {title}
        </h3>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-sm transition-colors duration-200 text-muted-foreground hover:text-foreground"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        )}
          </div>

          {/* Content */}
          <div className="max-h-[65vh] overflow-y-auto scrollbar-hide">
        <div className="p-6">
          {children}
        </div>
          </div>

          {/* Actions */}
          {actions && (
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30">
          {actions}
        </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomModal;
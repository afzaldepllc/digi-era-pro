import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { AlertCircle } from "lucide-react";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "You won't be able to revert this!",
  cancelText = "Cancel",
  confirmText = "Yes, delete it!",
  variant = "destructive",
}: ConfirmationDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-[400px] rounded-lg p-0 overflow-hidden">
        <div className="bg-slate-800 dark:bg-slate-900 p-6">
          <AlertDialogHeader className="space-y-3">
            <div className="mx-auto rounded-full bg-slate-700/20 w-16 h-16 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-orange-400" />
            </div>
            <AlertDialogTitle className="text-xl text-center text-white">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center text-slate-300">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="flex space-x-2 p-4 bg-slate-50 dark:bg-slate-800/50">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 text-sm font-semibold"
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1 text-sm font-semibold"
          >
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
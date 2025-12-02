import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './dialog';
import { AlertTriangle, Loader2, X } from 'lucide-react';

export interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemType: 'project' | 'dataset';
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  itemName,
  itemType,
  onConfirm,
  loading = false,
}: DeleteConfirmationDialogProps) {
  const [confirmationText, setConfirmationText] = useState('');
  const isConfirmEnabled = confirmationText === itemName;

  // Reset confirmation text when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmationText('');
    }
  }, [open]);

  const handleConfirm = async () => {
    if (isConfirmEnabled && !loading) {
      await onConfirm();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmEnabled && !loading) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 p-1 rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with icon */}
        <div className="pt-6 pb-2 px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-text">
                Delete {itemType === 'project' ? 'Project' : 'Dataset'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted mt-0.5">
                This action cannot be undone
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 mb-4">
            <p className="text-sm text-text leading-relaxed">
              You are about to permanently delete{' '}
              <span className="font-semibold text-red-500">"{itemName}"</span>
              {itemType === 'project' ? (
                <span> and all its associated datasets, change requests, and data.</span>
              ) : (
                <span> including all its data, change requests, and version history.</span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text">
              Type <span className="font-mono text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">{itemName}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Enter ${itemType} name`}
              className="w-full px-4 py-3 rounded-xl bg-surface-2 border border-divider text-text placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
              autoFocus
              disabled={loading}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-divider">
          <button
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-text bg-surface-2 hover:bg-surface-3 border border-divider transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || loading}
            className={[
              'px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
              'flex items-center gap-2',
              isConfirmEnabled && !loading
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25'
                : 'bg-red-500/30 text-red-300 cursor-not-allowed',
            ].join(' ')}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                Delete {itemType === 'project' ? 'Project' : 'Dataset'}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DeleteConfirmationDialog;

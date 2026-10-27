import React, { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  size?: string;
}

/**
 * Modal Component
 * Re-implemented using shadcn Dialog primitive
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  size: _size,
  children,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        {title && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {icon}
              <span>{title}</span>
            </DialogTitle>
          </DialogHeader>
        )}
        <div className="modal-body">{children}</div>
      </DialogContent>
    </Dialog>
  );
};

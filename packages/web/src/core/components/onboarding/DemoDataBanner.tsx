import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button.js';

export interface DemoDataBannerProps {
  onRemoveDemoData: () => void;
  onDismiss?: () => void;
  isRemoving?: boolean;
}

export const DemoDataBanner: React.FC<DemoDataBannerProps> = ({
  onRemoveDemoData,
  onDismiss,
  isRemoving = false,
}) => {
  return (
    <div className="bg-amber-500/10 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-500" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-foreground">
            You're viewing sample data
          </h3>
          <div className="mt-2 text-sm text-muted-foreground">
            <p>
              This is demo data to help you explore the platform. When you're ready to add your
              own clients, caregivers, and visits, you can remove this sample data.
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={onRemoveDemoData}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove Sample Data'}
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
        {onDismiss && (
          <div className="ml-auto pl-3">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onDismiss}
              aria-label="Dismiss banner"
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert.js';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';

export interface ErrorMessageProps {
  title?: string;
  message: string;
  retry?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Error',
  message,
  retry,
  action,
  className,
}) => {
  return (
    <Alert variant="destructive" className={cn(className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <div>{message}</div>
        {retry && (
          <div className="mt-4">
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={retry}
              className="h-auto p-0 text-destructive underline"
            >
              Try again
            </Button>
          </div>
        )}
        {action && <div className="mt-4">{action}</div>}
      </AlertDescription>
    </Alert>
  );
};

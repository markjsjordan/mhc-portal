import React, { useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import type { PatternListItem } from '../../services/visit-api.js';

interface PauseResumeButtonProps {
  pattern: PatternListItem;
  onPause: (id: string, reason?: string) => Promise<unknown>;
  onResume: (id: string) => Promise<unknown>;
  disabled?: boolean;
}

export const PauseResumeButton: React.FC<PauseResumeButtonProps> = ({
  pattern,
  onPause,
  onResume,
  disabled = false,
}) => {
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (pattern.status === 'CANCELLED') {
    return null;
  }

  const handlePauseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onPause(pattern.id, pauseReason.trim() || undefined);
      setShowPauseModal(false);
      setPauseReason('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResumeClick = async () => {
    setIsSubmitting(true);
    try {
      await onResume(pattern.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pattern.status === 'PAUSED') {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleResumeClick}
        disabled={disabled || isSubmitting}
        className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/40 gap-1.5"
      >
        <Play className="h-3.5 w-3.5" fill="currentColor" />
        <span>Resume</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowPauseModal(true)}
        disabled={disabled || isSubmitting}
        className="text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950/40 gap-1.5"
      >
        <Pause className="h-3.5 w-3.5" fill="currentColor" />
        <span>Pause</span>
      </Button>

      {showPauseModal && (
        <Dialog open={showPauseModal} onOpenChange={(open) => !open && setShowPauseModal(false)}>
          <DialogContent className="sm:max-w-[420px]">
            <form onSubmit={handlePauseSubmit}>
              <DialogHeader>
                <DialogTitle>Pause Recurring Pattern</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Pause recurring visits for {pattern.clientName}. Existing scheduled visits remain on the calendar.
                </DialogDescription>
              </DialogHeader>

              <div className="py-4 space-y-2">
                <Label htmlFor="pause-reason">Reason (optional)</Label>
                <Textarea
                  id="pause-reason"
                  placeholder="Optional reason for pause (e.g. temporary client hold)..."
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPauseModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" disabled={isSubmitting}>
                  {isSubmitting ? 'Pausing...' : 'Confirm Pause'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

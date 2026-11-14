import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useCreateGoal } from '../hooks/use-create-goal.js';

interface CreateGoalModalProps {
  carePlanId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GOAL_CATEGORIES = [
  { value: 'MOBILITY', label: 'Mobility' },
  { value: 'SELF_CARE', label: 'Self Care' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'NUTRITION', label: 'Nutrition' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'COGNITIVE', label: 'Cognitive' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'OTHER', label: 'Other' },
];

const GOAL_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const CreateGoalModal: React.FC<CreateGoalModalProps> = ({
  carePlanId,
  open,
  onOpenChange,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('MOBILITY');
  const [priority, setPriority] = useState('MEDIUM');
  const [targetDate, setTargetDate] = useState('');
  const [titleError, setTitleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('MOBILITY');
    setPriority('MEDIUM');
    setTargetDate('');
    setTitleError(null);
    setSubmitError(null);
  };

  const createGoal = useCreateGoal(carePlanId, {
    onSuccess: () => {
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      setSubmitError(error.message || 'Failed to create goal. Please try again.');
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !createGoal.isPending) {
      resetForm();
    }
    if (!createGoal.isPending) {
      onOpenChange(nextOpen);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (createGoal.isPending) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setTitleError('Goal title is required.');
      return;
    }

    setTitleError(null);
    setSubmitError(null);

    createGoal.mutate({
      title: trimmedTitle,
      description: description.trim() || undefined,
      category,
      priority,
      targetDate: targetDate || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Goal</DialogTitle>
          <DialogDescription>
            Create a new goal for this care plan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError && (
            <div
              role="alert"
              className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700"
            >
              {submitError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="goal-title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(null);
              }}
              placeholder="e.g., Improve independent mobility"
              disabled={createGoal.isPending}
              aria-invalid={Boolean(titleError)}
            />
            {titleError && (
              <p className="text-xs text-red-600" role="alert">
                {titleError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-description">Description</Label>
            <Textarea
              id="goal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details or measurable target..."
              rows={3}
              disabled={createGoal.isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-category">Category</Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={createGoal.isPending}
              >
                <SelectTrigger id="goal-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={setPriority}
                disabled={createGoal.isPending}
              >
                <SelectTrigger id="goal-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="goal-target-date">Target Date</Label>
            <Input
              id="goal-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={createGoal.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createGoal.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createGoal.isPending}>
              {createGoal.isPending ? 'Saving...' : 'Save Goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

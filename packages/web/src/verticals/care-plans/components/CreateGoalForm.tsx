import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Target } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { carePlanGoalSchema, type CarePlanGoalFormData } from '../validation/schemas.js';
import { useCreateGoal } from '../hooks/index.js';
import type { CarePlanGoalDto } from '../services/care-plan-api-service.js';

const categoryOptions = [
  { value: 'MOBILITY', label: 'Mobility' },
  { value: 'ADL', label: 'Activities of Daily Living' },
  { value: 'IADL', label: 'Instrumental ADL' },
  { value: 'NUTRITION', label: 'Nutrition' },
  { value: 'MEDICATION_MANAGEMENT', label: 'Medication Management' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'SOCIAL_ENGAGEMENT', label: 'Social Engagement' },
  { value: 'COGNITIVE', label: 'Cognitive' },
  { value: 'EMOTIONAL_WELLBEING', label: 'Emotional Wellbeing' },
  { value: 'PAIN_MANAGEMENT', label: 'Pain Management' },
  { value: 'WOUND_CARE', label: 'Wound Care' },
  { value: 'CHRONIC_DISEASE_MANAGEMENT', label: 'Chronic Disease Management' },
  { value: 'OTHER', label: 'Other' },
];

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export interface CreateGoalFormProps {
  carePlanId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (goal: CarePlanGoalDto) => void;
}

export const CreateGoalForm: React.FC<CreateGoalFormProps> = ({
  carePlanId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CarePlanGoalFormData>({
    resolver: zodResolver(carePlanGoalSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'MEDIUM',
    },
  });

  const createGoal = useCreateGoal(carePlanId, {
    onSuccess: (goal) => {
      reset();
      onSuccess?.(goal);
      onClose();
    },
  });

  const category = watch('category');
  const priority = watch('priority');

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    createGoal.reset();
    onClose();
  };

  const onFormSubmit = (data: CarePlanGoalFormData) => {
    createGoal.mutate(data);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Add Goal</h2>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(onFormSubmit)(e); }}>
          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">
                Goal Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="goal-title"
                {...register('title')}
                placeholder="e.g. Improve mobility"
                disabled={createGoal.isPending}
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'goal-title-error' : undefined}
              />
              {errors.title && (
                <p id="goal-title-error" className="text-sm text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                {...register('description')}
                placeholder="Describe the goal in detail"
                rows={3}
                disabled={createGoal.isPending}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'goal-description-error' : undefined}
              />
              {errors.description && (
                <p id="goal-description-error" className="text-sm text-destructive">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="goal-category">Category</Label>
                <Select
                  value={category ?? ''}
                  onValueChange={(val) => setValue('category', val as CarePlanGoalFormData['category'])}
                >
                  <SelectTrigger id="goal-category" aria-invalid={!!errors.category}>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal-priority">Priority</Label>
                <Select
                  value={priority ?? 'MEDIUM'}
                  onValueChange={(val) => setValue('priority', val as CarePlanGoalFormData['priority'])}
                >
                  <SelectTrigger id="goal-priority" aria-invalid={!!errors.priority}>
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.priority && (
                  <p className="text-sm text-destructive">{errors.priority.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="goal-target-date">Target Date</Label>
                <Input
                  id="goal-target-date"
                  type="date"
                  {...register('targetDate')}
                  disabled={createGoal.isPending}
                  aria-invalid={!!errors.targetDate}
                  aria-describedby={errors.targetDate ? 'goal-target-date-error' : undefined}
                />
                {errors.targetDate && (
                  <p id="goal-target-date-error" className="text-sm text-destructive">
                    {errors.targetDate.message}
                  </p>
                )}
              </div>
            </div>

            {createGoal.isError && (
              <p className="text-sm text-destructive" role="alert">
                {(createGoal.error as Error)?.message || 'Failed to create goal'}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/20">
            <Button type="button" variant="outline" onClick={handleClose} disabled={createGoal.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createGoal.isPending}>
              {createGoal.isPending ? (
                <LoadingSpinner size="sm" className="mr-2" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              Add Goal
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

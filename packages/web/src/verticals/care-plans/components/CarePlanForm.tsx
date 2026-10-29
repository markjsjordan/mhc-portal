import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
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
import { formatDate } from '@/core/utils';
import { useAuth } from '@/core/hooks/auth';
import { useApiClient } from '@/core/hooks';
import { useQuery } from '@tanstack/react-query';
import { useClients, useBranches } from '@/verticals/client-demographics/hooks/index.js';
import type { CreateCarePlanInput } from '../types';
import { buildCreateCarePlanPayload } from '../utils/build-create-care-plan-payload.js';
import { Plus, Trash2 } from 'lucide-react';

const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required'),
  description: z.string().optional(),
  category: z.string().optional(),
  targetDate: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
});

const carePlanSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  branchId: z.string().optional(),
  name: z.string().min(1, 'Care plan name is required'),
  planType: z.enum(['PERSONAL_CARE', 'COMPANION', 'SKILLED_NURSING', 'THERAPY', 'HOSPICE', 'RESPITE', 'LIVE_IN', 'CUSTOM']),
  effectiveDate: z.string().min(1, 'Effective date is required'),
  expirationDate: z.string().optional(),
  coordinatorId: z.string().optional(),
  notes: z.string().optional(),
  goals: z.array(goalSchema).optional().default([]),
});

type CarePlanFormData = z.infer<typeof carePlanSchema>;

export interface CarePlanFormProps {
  initialData?: Partial<CreateCarePlanInput>;
  onSubmit: (data: CreateCarePlanInput) => void;
  isLoading?: boolean;
}

const planTypeOptions = [
  { value: 'PERSONAL_CARE', label: 'Personal Care' },
  { value: 'COMPANION', label: 'Companion' },
  { value: 'SKILLED_NURSING', label: 'Skilled Nursing' },
  { value: 'THERAPY', label: 'Therapy' },
  { value: 'HOSPICE', label: 'Hospice' },
  { value: 'RESPITE', label: 'Respite' },
  { value: 'LIVE_IN', label: 'Live In' },
  { value: 'CUSTOM', label: 'Custom' },
];

const goalCategoryOptions = [
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

const goalStatusOptions = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'ON_TRACK', label: 'On Track' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'ACHIEVED', label: 'Achieved' },
  { value: 'PARTIALLY_ACHIEVED', label: 'Partially Achieved' },
  { value: 'DISCONTINUED', label: 'Discontinued' },
];

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export const CarePlanForm: React.FC<CarePlanFormProps> = ({ 
  initialData, 
  onSubmit, 
  isLoading = false 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();
  const apiClient = useApiClient();

  // Queries for dropdown options
  const { data: clientsResult } = useClients({ page: 1, pageSize: 100 });
  const clients = clientsResult?.items ?? [];

  const { data: branches = [] } = useBranches();

  const organizationId = (initialData?.organizationId ?? user?.organizationId) ?? '00000000-0000-0000-0000-000000000001';

  // Fetch organization team members for coordinator selection
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['organization-users', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const res = await apiClient.get<Array<{ id: string; firstName: string; lastName: string; email: string; roles: string[] }> | { data?: Array<{ id: string; firstName: string; lastName: string; email: string; roles: string[] }> }>(`/api/organizations/${organizationId}/users`);
      return Array.isArray(res) ? res : (res.data ?? []);
    },
    enabled: !!organizationId,
  });

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<CarePlanFormData>({
    resolver: zodResolver(carePlanSchema) as unknown as Resolver<CarePlanFormData>,
    defaultValues: {
      clientId: initialData?.clientId ?? '',
      organizationId: initialData?.organizationId ?? user?.organizationId ?? '00000000-0000-0000-0000-000000000001',
      branchId: initialData?.branchId ?? user?.branchIds?.[0] ?? '',
      name: initialData?.name ?? '',
      planType: initialData?.planType ?? 'PERSONAL_CARE',
      effectiveDate: initialData?.effectiveDate ?? formatDate(new Date()),
      expirationDate: initialData?.expirationDate ?? '',
      coordinatorId: initialData?.coordinatorId ?? '',
      notes: initialData?.notes ?? '',
      goals: initialData?.goals ?? [],
    },
  });

  const selectedClientId = useWatch({ control, name: 'clientId' });
  const selectedOrgId = useWatch({ control, name: 'organizationId' });
  const selectedBranchId = useWatch({ control, name: 'branchId' });
  const selectedCoordinatorId = useWatch({ control, name: 'coordinatorId' });
  const selectedPlanType = useWatch({ control, name: 'planType' });
  const watchedGoals = useWatch({ control, name: 'goals' });

  // Update org and branch when user context is available
  useEffect(() => {
    if (user?.organizationId && !initialData?.organizationId) {
      setValue('organizationId', user.organizationId);
    }
    if (user?.branchIds?.[0] && !initialData?.branchId) {
      setValue('branchId', user.branchIds[0]);
    }
  }, [user, initialData, setValue]);

  const { fields: goalFields, append: appendGoal, remove: removeGoal } = useFieldArray({
    control,
    name: 'goals',
  });

  const steps = [
    { title: 'Basic Information', description: 'Care plan details' },
    { title: 'Goals', description: 'Define care goals' },
    { title: 'Interventions', description: 'Plan interventions' },
    { title: 'Review', description: 'Review and submit' },
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onFormSubmit = (data: CarePlanFormData) => {
    onSubmit(buildCreateCarePlanPayload(data));
  };

  const renderBasicInfo = () => {
    // Organization select options
    const orgOptions = [
      { value: organizationId, label: 'Current Organization (Marquette Home Care)' },
    ];

    // Coordinator select options
    const coordinatorOptions = teamMembers
      .filter((m) => m.roles.some((r) => ['COORDINATOR', 'ADMIN', 'ORG_ADMIN', 'BRANCH_ADMIN', 'SUPER_ADMIN'].includes(r)))
      .map((m) => ({
        value: m.id,
        label: `${m.firstName} ${m.lastName} (${m.email})`,
      }));

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="care-plan-client-select">
              Client <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedClientId || ''}
              onValueChange={(val) => setValue('clientId', val, { shouldValidate: true })}
            >
              <SelectTrigger id="care-plan-client-select">
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {`${c.firstName} ${c.lastName}${c.clientNumber ? ` (${c.clientNumber})` : ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clientId?.message && (
              <p className="text-destructive text-sm">{errors.clientId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-plan-org-select">
              Organization <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedOrgId || organizationId}
              onValueChange={(val) => setValue('organizationId', val, { shouldValidate: true })}
            >
              <SelectTrigger id="care-plan-org-select">
                <SelectValue placeholder="Select organization..." />
              </SelectTrigger>
              <SelectContent>
                {orgOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.organizationId?.message && (
              <p className="text-destructive text-sm">{errors.organizationId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-plan-branch-select">
              Branch (Optional)
            </Label>
            <Select
              value={selectedBranchId ?? '__none__'}
              onValueChange={(val) => setValue('branchId', val === '__none__' ? '' : val, { shouldValidate: true })}
            >
              <SelectTrigger id="care-plan-branch-select">
                <SelectValue placeholder="Select branch (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select branch (optional)...</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {`${b.name}${b.code ? ` (${b.code})` : ''}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.branchId?.message && (
              <p className="text-destructive text-sm">{errors.branchId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-plan-coordinator-select">
              Coordinator (Optional)
            </Label>
            <Select
              value={selectedCoordinatorId ?? '__none__'}
              onValueChange={(val) => setValue('coordinatorId', val === '__none__' ? '' : val, { shouldValidate: true })}
            >
              <SelectTrigger id="care-plan-coordinator-select">
                <SelectValue placeholder="Select coordinator (optional)..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select coordinator (optional)...</SelectItem>
                {coordinatorOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.coordinatorId?.message && (
              <p className="text-destructive text-sm">{errors.coordinatorId.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="care-plan-name-input">
            Care Plan Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="care-plan-name-input"
            {...register('name')}
            placeholder="Enter care plan name"
          />
          {errors.name?.message && (
            <p className="text-destructive text-sm">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label htmlFor="care-plan-type-select">
              Plan Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedPlanType}
              onValueChange={(val) => setValue('planType', val as CarePlanFormData['planType'], { shouldValidate: true })}
            >
              <SelectTrigger id="care-plan-type-select">
                <SelectValue placeholder="Select plan type..." />
              </SelectTrigger>
              <SelectContent>
                {planTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.planType?.message && (
              <p className="text-destructive text-sm">{errors.planType.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-plan-effective-date">
              Effective Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="care-plan-effective-date"
              {...register('effectiveDate')}
              type="date"
            />
            {errors.effectiveDate?.message && (
              <p className="text-destructive text-sm">{errors.effectiveDate.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="care-plan-expiration-date">
            Expiration Date (Optional)
          </Label>
          <Input
            id="care-plan-expiration-date"
            {...register('expirationDate')}
            type="date"
          />
          {errors.expirationDate?.message && (
            <p className="text-destructive text-sm">{errors.expirationDate.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="care-plan-notes">
            Notes (Optional)
          </Label>
          <Textarea
            id="care-plan-notes"
            {...register('notes')}
            placeholder="Enter any additional notes"
            rows={4}
          />
          {errors.notes?.message && (
            <p className="text-destructive text-sm">{errors.notes.message}</p>
          )}
        </div>
      </div>
    );
  };

  const renderGoals = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Care Plan Goals</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            appendGoal({
              name: '',
              description: '',
              category: 'OTHER',
              targetDate: '',
              status: 'NOT_STARTED',
              priority: 'MEDIUM',
            })
          }
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {goalFields.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-md">
          <p className="text-muted-foreground">No goals added yet</p>
          <p className="text-sm text-muted-foreground/80 mt-2">Click "Add Goal" to define care goals for this care plan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goalFields.map((field, index) => (
            <Card key={field.id}>
              <CardHeader>
                <CardTitle className="text-base">{`Goal ${index + 1}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`goal-${index}-name`}>
                        Goal Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`goal-${index}-name`}
                        {...register(`goals.${index}.name`)}
                        placeholder="Enter goal name"
                      />
                      {errors.goals?.[index]?.name?.message && (
                        <p className="text-destructive text-sm">{errors.goals[index].name.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`goal-${index}-target-date`}>
                        Target Date (Optional)
                      </Label>
                      <Input
                        id={`goal-${index}-target-date`}
                        {...register(`goals.${index}.targetDate`)}
                        type="date"
                      />
                      {errors.goals?.[index]?.targetDate?.message && (
                        <p className="text-destructive text-sm">{errors.goals[index].targetDate.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`goal-${index}-description`}>
                      Description (Optional)
                    </Label>
                    <Textarea
                      id={`goal-${index}-description`}
                      {...register(`goals.${index}.description`)}
                      placeholder="Enter goal description"
                      rows={3}
                    />
                    {errors.goals?.[index]?.description?.message && (
                      <p className="text-destructive text-sm">{errors.goals[index].description.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`goal-${index}-category`}>Category</Label>
                      <Select
                        value={watchedGoals[index]?.category ?? 'OTHER'}
                        onValueChange={(val) => setValue(`goals.${index}.category`, val)}
                      >
                        <SelectTrigger id={`goal-${index}-category`}>
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                        <SelectContent>
                          {goalCategoryOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.goals?.[index]?.category?.message && (
                        <p className="text-destructive text-sm">{errors.goals[index].category.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`goal-${index}-priority`}>Priority</Label>
                      <Select
                        value={watchedGoals[index]?.priority ?? 'MEDIUM'}
                        onValueChange={(val) => setValue(`goals.${index}.priority`, val)}
                      >
                        <SelectTrigger id={`goal-${index}-priority`}>
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
                      {errors.goals?.[index]?.priority?.message && (
                        <p className="text-destructive text-sm">{errors.goals[index].priority.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`goal-${index}-status`}>Status</Label>
                      <Select
                        value={watchedGoals[index]?.status ?? 'NOT_STARTED'}
                        onValueChange={(val) => setValue(`goals.${index}.status`, val)}
                      >
                        <SelectTrigger id={`goal-${index}-status`}>
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent>
                          {goalStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.goals?.[index]?.status?.message && (
                        <p className="text-destructive text-sm">{errors.goals[index].status.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGoal(index)}
                      className="text-destructive hover:text-destructive flex items-center gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove Goal
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderInterventions = () => (
    <div className="space-y-6">
      <div className="text-center py-8 border-2 border-dashed border-border rounded-md">
        <p className="text-muted-foreground">Interventions will be implemented in a future update</p>
        <p className="text-sm text-muted-foreground/80 mt-2">This will include intervention planning, scheduling, and instructions</p>
      </div>
    </div>
  );

  const renderReview = () => {
    const watchedValues = getValues();
    
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium">Review Care Plan</h3>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Name</dt>
                <dd className="mt-1 text-sm">{watchedValues.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Plan Type</dt>
                <dd className="mt-1 text-sm">{watchedValues.planType.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Client ID</dt>
                <dd className="mt-1 text-sm">{watchedValues.clientId}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Organization ID</dt>
                <dd className="mt-1 text-sm">{watchedValues.organizationId}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Effective Date</dt>
                <dd className="mt-1 text-sm">{watchedValues.effectiveDate}</dd>
              </div>
              {watchedValues.expirationDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Expiration Date</dt>
                  <dd className="mt-1 text-sm">{watchedValues.expirationDate}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {watchedValues.goals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{`Goals (${watchedValues.goals.length})`}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {watchedValues.goals.map((goal, index) => (
                  <div key={index} className="border-l-4 border-primary pl-4 py-2">
                    <h4 className="font-medium">{goal.name}</h4>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      {goal.category && <span>{goal.category.replace(/_/g, ' ')}</span>}
                      {goal.priority && <span>Priority: {goal.priority}</span>}
                      {goal.targetDate && <span>Target: {goal.targetDate}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium">Task Templates</h4>
                <p className="text-sm text-muted-foreground">Create task templates for recurring care activities</p>
              </div>
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-medium">Assign Caregivers</h4>
                <p className="text-sm text-muted-foreground">Assign primary caregivers and backup staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="w-full overflow-x-hidden space-y-6">
      {/* Progress Indicator */}
      <div className="flex flex-wrap gap-2 md:gap-0 md:flex-nowrap md:items-center md:justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center flex-shrink-0">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index <= currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {index + 1}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                index <= currentStep ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground hidden md:block">{step.description}</p>
            </div>
            {index < steps.length - 1 && (
              <div className={`hidden md:block flex-1 h-px mx-4 ${
                index < currentStep ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <form onSubmit={(e) => { void handleSubmit(onFormSubmit)(e); }}>
        {currentStep === 0 && renderBasicInfo()}
        {currentStep === 1 && renderGoals()}
        {currentStep === 2 && renderInterventions()}
        {currentStep === 3 && renderReview()}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStep < steps.length - 1 ? (
              <Button type="button" onClick={nextStep}>
                Next
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading}>
                {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
                Create Care Plan
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

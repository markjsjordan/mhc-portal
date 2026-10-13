import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Button, 
  Card, 
  CardHeader, 
  CardContent, 
  Input, 
  Select, 
  FormField,
  LoadingSpinner
} from '@/core/components';
import { formatDate } from '@/core/utils';
import type { CreateCarePlanInput } from '../types';
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

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useForm<CarePlanFormData>({
    resolver: zodResolver(carePlanSchema as any),
    defaultValues: {
      clientId: initialData?.clientId ?? '',
      organizationId: initialData?.organizationId ?? '',
      branchId: initialData?.branchId ?? '',
      name: initialData?.name ?? '',
      planType: initialData?.planType ?? 'PERSONAL_CARE',
      effectiveDate: initialData?.effectiveDate ?? formatDate(new Date()),
      expirationDate: initialData?.expirationDate ?? '',
      coordinatorId: initialData?.coordinatorId ?? '',
      notes: initialData?.notes ?? '',
      goals: initialData?.goals ?? [],
    },
  });

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
    onSubmit({
      ...data,
      interventions: [],
    });
  };

  const renderBasicInfo = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Client ID"
          error={errors.clientId?.message}
          required
        >
          <Input
            {...register('clientId')}
            placeholder="Enter client ID"
          />
        </FormField>

        <FormField
          label="Organization ID"
          error={errors.organizationId?.message}
          required
        >
          <Input
            {...register('organizationId')}
            placeholder="Enter organization ID"
          />
        </FormField>

        <FormField
          label="Branch ID (Optional)"
          error={errors.branchId?.message}
        >
          <Input
            {...register('branchId')}
            placeholder="Enter branch ID"
          />
        </FormField>

        <FormField
          label="Coordinator ID (Optional)"
          error={errors.coordinatorId?.message}
        >
          <Input
            {...register('coordinatorId')}
            placeholder="Enter coordinator ID"
          />
        </FormField>
      </div>

      <FormField
        label="Care Plan Name"
        error={errors.name?.message}
        required
      >
        <Input
          {...register('name')}
          placeholder="Enter care plan name"
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          label="Plan Type"
          error={errors.planType?.message}
          required
        >
          <Select
            options={planTypeOptions}
            value={getValues('planType')}
            onChange={(e) => setValue('planType', e.target.value as CarePlanFormData['planType'])}
          />
        </FormField>

        <FormField
          label="Effective Date"
          error={errors.effectiveDate?.message}
          required
        >
          <Input
            {...register('effectiveDate')}
            type="date"
          />
        </FormField>
      </div>

      <FormField
        label="Expiration Date (Optional)"
        error={errors.expirationDate?.message}
      >
        <Input
          {...register('expirationDate')}
          type="date"
        />
      </FormField>

      <FormField
        label="Notes (Optional)"
        error={errors.notes?.message}
      >
        <textarea
          {...register('notes')}
          placeholder="Enter any additional notes"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </FormField>
    </div>
  );

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
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-md">
          <p className="text-gray-500">No goals added yet</p>
          <p className="text-sm text-gray-400 mt-2">Click "Add Goal" to define care goals for this care plan</p>
        </div>
      ) : (
        <div className="space-y-4">
          {goalFields.map((field, index) => (
            <Card key={field.id}>
              <CardHeader title={`Goal ${index + 1}`} />
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Goal Name"
                      error={errors.goals?.[index]?.name?.message}
                      required
                    >
                      <Input
                        {...register(`goals.${index}.name`)}
                        placeholder="Enter goal name"
                      />
                    </FormField>

                    <FormField
                      label="Target Date (Optional)"
                      error={errors.goals?.[index]?.targetDate?.message}
                    >
                      <Input
                        {...register(`goals.${index}.targetDate`)}
                        type="date"
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Description (Optional)"
                    error={errors.goals?.[index]?.description?.message}
                  >
                    <textarea
                      {...register(`goals.${index}.description`)}
                      placeholder="Enter goal description"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </FormField>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      label="Category"
                      error={errors.goals?.[index]?.category?.message}
                    >
                      <Select
                        options={goalCategoryOptions}
                        value={getValues(`goals.${index}.category`)}
                        onChange={(e) => setValue(`goals.${index}.category`, e.target.value)}
                      />
                    </FormField>

                    <FormField
                      label="Priority"
                      error={errors.goals?.[index]?.priority?.message}
                    >
                      <Select
                        options={priorityOptions}
                        value={getValues(`goals.${index}.priority`)}
                        onChange={(e) => setValue(`goals.${index}.priority`, e.target.value)}
                      />
                    </FormField>

                    <FormField
                      label="Status"
                      error={errors.goals?.[index]?.status?.message}
                    >
                      <Select
                        options={goalStatusOptions}
                        value={getValues(`goals.${index}.status`)}
                        onChange={(e) => setValue(`goals.${index}.status`, e.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGoal(index)}
                      className="text-red-600 hover:text-red-700 flex items-center gap-2"
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
      <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-md">
        <p className="text-gray-500">Interventions will be implemented in a future update</p>
        <p className="text-sm text-gray-400 mt-2">This will include intervention planning, scheduling, and instructions</p>
      </div>
    </div>
  );

  const renderReview = () => {
    const watchedValues = getValues();
    
    return (
      <div className="space-y-6">
        <h3 className="text-lg font-medium">Review Care Plan</h3>
        
        <Card>
          <CardHeader title="Basic Information" />
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="mt-1 text-sm text-gray-900">{watchedValues.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Plan Type</dt>
                <dd className="mt-1 text-sm text-gray-900">{watchedValues.planType?.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Client ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{watchedValues.clientId}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Organization ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{watchedValues.organizationId}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Effective Date</dt>
                <dd className="mt-1 text-sm text-gray-900">{watchedValues.effectiveDate}</dd>
              </div>
              {watchedValues.expirationDate && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Expiration Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{watchedValues.expirationDate}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {watchedValues.goals && watchedValues.goals.length > 0 && (
          <Card>
            <CardHeader title={`Goals (${watchedValues.goals.length})`} />
            <CardContent>
              <div className="space-y-3">
                {watchedValues.goals.map((goal, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <h4 className="font-medium">{goal.name}</h4>
                    {goal.description && (
                      <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 mt-2">
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
          <CardHeader title="Next Steps" />
          <CardContent>
            <div className="space-y-3">
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium">Task Templates</h4>
                <p className="text-sm text-gray-600">Create task templates for recurring care activities</p>
              </div>
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-medium">Assign Caregivers</h4>
                <p className="text-sm text-gray-600">Assign primary caregivers and backup staff</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                index <= currentStep
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
            >
              {index + 1}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                index <= currentStep ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.title}
              </p>
              <p className="text-xs text-gray-500">{step.description}</p>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-px mx-4 ${
                index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onFormSubmit)}>
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
import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { useCarePlan, useUpdateCarePlan } from '../hooks';
import { CarePlanForm } from '../components';
import type { UpdateCarePlanInput, CreateCarePlanInput } from '../types';

export const EditCarePlanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: carePlan, isLoading, error, refetch } = useCarePlan(id);
  const updateCarePlan = useUpdateCarePlan();

  const handleSubmit = async (data: CreateCarePlanInput | UpdateCarePlanInput) => {
    if (!id) return;

    try {
      // Convert CreateCarePlanInput to UpdateCarePlanInput if needed
      const updateData: UpdateCarePlanInput = {
        name: 'name' in data ? data.name : undefined,
        goals: 'goals' in data ? (data.goals as UpdateCarePlanInput['goals']) : undefined,
        interventions: 'interventions' in data ? (data.interventions as UpdateCarePlanInput['interventions']) : undefined,
        taskTemplates: 'taskTemplates' in data ? (data.taskTemplates as UpdateCarePlanInput['taskTemplates']) : undefined,
        notes: 'notes' in data ? data.notes : undefined,
      };
      await updateCarePlan.mutateAsync({ id, input: updateData });
      Promise.resolve(navigate(`/care-plans/${id}`)).catch(() => {});
    } catch {
      // Error is handled by the mutation
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !carePlan) {
    return (
      <ErrorMessage
        message={(error as Error).message || 'Failed to load care plan'}
        retry={() => { void refetch(); }}
      />
    );
  }

  if (updateCarePlan.isError) {
    return (
      <ErrorMessage
        message={(updateCarePlan.error as Error).message || 'Failed to update care plan'}
        retry={() => updateCarePlan.reset()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/care-plans/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Care Plan
          </Button>
        </Link>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Edit Care Plan</h1>
        <p className="text-gray-600 mt-1">
          Update goals, interventions, and task templates for {carePlan.name}
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6">
          <CarePlanForm
            initialData={carePlan}
            onSubmit={(formData) => { void handleSubmit(formData); }}
            isLoading={updateCarePlan.isPending}
          />
        </CardContent>
      </Card>

      {/* Loading Overlay */}
      {updateCarePlan.isPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-lg font-medium">Updating Care Plan...</span>
          </div>
        </div>
      )}
    </div>
  );
};

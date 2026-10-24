import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { useCarePlanTemplate, useCreateFromTemplate } from '../hooks';
import type { CarePlanTaskTemplate } from '@folkcare/care-plans-tasks/browser';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface CustomTask extends CarePlanTaskTemplate {
  enabled: boolean;
}

export const CustomizeTemplatePage: React.FC = () => {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const { data: template, isLoading, error } = useCarePlanTemplate(templateId);
  const createFromTemplate = useCreateFromTemplate();

  // Form state
  const [clientId, setClientId] = useState('');
  const [name, setName] = useState('');
  const [goals, setGoals] = useState('');
  const [notes, setNotes] = useState('');
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);

  // Initialize custom tasks when template loads
  React.useEffect(() => {
    if (template && customTasks.length === 0) {
      setName(template.name);
      setGoals(template.goals);
      setCustomTasks(
        template.tasks.map((task) => ({
          ...task,
          enabled: true,
        }))
      );
    }
  }, [template, customTasks.length]);

  const handleTaskToggle = (taskIndex: number) => {
    setCustomTasks((prev) =>
      prev.map((task, i) =>
        i === taskIndex ? { ...task, enabled: !task.enabled } : task
      )
    );
  };

  const handleCreateCarePlan = async () => {
    if (!templateId || !clientId) {
      return;
    }

    const enabledTasks = customTasks.filter((t) => t.enabled);

    try {
      await createFromTemplate.mutateAsync({
        templateId,
        clientId,
        name,
        goals,
        notes,
        tasks: enabledTasks,
      });

      // Navigate to care plans list on success
      navigate('/care-plans');
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

  if (error || !template) {
    return (
      <ErrorMessage
        message={(error as Error)?.message || 'Template not found'}
      />
    );
  }

  const enabledTasksCount = customTasks.filter((t) => t.enabled).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link to="/care-plans/from-template">
          <Button
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Customize Care Plan
        </h1>
        <p className="text-gray-600">
          Customize the template before creating your care plan.
        </p>
      </div>

      <div className="space-y-6">
        {/* Template Info */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Template: {template.name}</h3>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{template.description}</p>
          </CardContent>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="clientId">
                  Client ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  id="clientId"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter client ID"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="name">
                  Care Plan Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter care plan name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="goals">Goals</Label>
                <Textarea
                  id="goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Enter care goals"
                  rows={4}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="notes">Additional Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes or instructions"
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Select Tasks</h3>
            <p className="text-sm text-gray-600 mt-1">{enabledTasksCount} of {customTasks.length} tasks selected</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customTasks.map((task, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 flex items-start transition ${
                    task.enabled
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <Checkbox
                    id={`task-${index}`}
                    checked={task.enabled}
                    onCheckedChange={() => handleTaskToggle(index)}
                    className="mt-1 mr-3"
                  />
                  <Label htmlFor={`task-${index}`} className="flex-1 cursor-pointer">
                    <h4 className="font-medium text-gray-900">
                      {task.description}
                    </h4>
                    {task.instructions && (
                      <p className="text-sm text-gray-600 mt-1">
                        {task.instructions}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                      <span className="capitalize">{task.frequency}</span>
                      {task.scheduled_time && (
                        <span>⏰ {task.scheduled_time}</span>
                      )}
                      <span>
                        ⏱️ {task.estimated_duration_minutes} min
                      </span>
                      <span className="capitalize font-medium">
                        {task.priority} priority
                      </span>
                    </div>
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3 sticky bottom-0 bg-white py-4 border-t">
          <Link to="/care-plans/from-template">
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button
            onClick={handleCreateCarePlan}
            disabled={
              createFromTemplate.isPending || !clientId || enabledTasksCount === 0
            }
          >
            {createFromTemplate.isPending ? (
              <>
                <LoadingSpinner size="sm" />
                <span className="ml-2">Creating...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Create Care Plan ({enabledTasksCount} tasks)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

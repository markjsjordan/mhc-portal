import React, { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Badge } from '@/components/ui/badge.js';
import { useCarePlanTemplate, useCreateFromTemplate } from '../hooks';
import type { CarePlanTaskTemplate } from '@folkcare/care-plans-tasks/browser';

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
            <CardTitle>Template: {template.name}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </CardHeader>
        </Card>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-id">
                  Client ID <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="client-id"
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Enter client ID"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="care-plan-name">
                  Care Plan Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="care-plan-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter care plan name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="care-plan-goals">Goals</Label>
                <Textarea
                  id="care-plan-goals"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Enter care goals"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="care-plan-notes">Additional Notes</Label>
                <Textarea
                  id="care-plan-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes or instructions"
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Tasks</CardTitle>
            <CardDescription>{enabledTasksCount} of {customTasks.length} tasks selected</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customTasks.map((task, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 flex items-start transition ${
                    task.enabled
                      ? 'border-blue-300 bg-blue-50/50'
                      : 'border-border bg-muted/20'
                  }`}
                >
                  <Checkbox
                    id={`task-${index}`}
                    checked={task.enabled}
                    onCheckedChange={() => handleTaskToggle(index)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={`task-${index}`}
                      className="font-medium text-gray-900 cursor-pointer block"
                    >
                      {task.description}
                    </Label>
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
                      <Badge variant={String(task.priority).toLowerCase() === 'high' || String(task.priority).toLowerCase() === 'urgent' ? 'destructive' : 'secondary'} className="capitalize text-xs">
                        {task.priority} priority
                      </Badge>
                    </div>
                  </div>
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
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Create Care Plan ({enabledTasksCount} tasks)
          </Button>
        </div>
      </div>
    </div>
  );
};

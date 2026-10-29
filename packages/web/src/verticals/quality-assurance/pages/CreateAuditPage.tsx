/**
 * Create Audit Page
 *
 * Form to schedule a new quality assurance audit
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
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
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { useCreateAudit } from '../hooks';
import type { CreateAuditInput } from '../types';
import toast from 'react-hot-toast';

const auditSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  auditType: z.enum([
    'COMPLIANCE',
    'QUALITY',
    'SAFETY',
    'DOCUMENTATION',
    'FINANCIAL',
    'MEDICATION',
    'INFECTION_CONTROL',
    'TRAINING',
    'INTERNAL',
    'EXTERNAL',
  ]),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  scope: z.enum(['ORGANIZATION', 'BRANCH', 'DEPARTMENT', 'CAREGIVER', 'CLIENT', 'PROCESS']),
  scheduledStartDate: z.string().min(1, 'Scheduled start date is required'),
  scheduledEndDate: z.string().min(1, 'Scheduled end date is required'),
  leadAuditorId: z.string().min(1, 'Lead auditor is required'),
});

type AuditFormData = z.infer<typeof auditSchema>;

const auditTypeOptions = [
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'FINANCIAL', label: 'Financial' },
  { value: 'MEDICATION', label: 'Medication' },
  { value: 'INFECTION_CONTROL', label: 'Infection Control' },
  { value: 'TRAINING', label: 'Training' },
  { value: 'INTERNAL', label: 'Internal' },
  { value: 'EXTERNAL', label: 'External' },
];

const priorityOptions = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'CRITICAL', label: 'Critical' },
];

const scopeOptions = [
  { value: 'ORGANIZATION', label: 'Organization' },
  { value: 'BRANCH', label: 'Branch' },
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'CAREGIVER', label: 'Caregiver' },
  { value: 'CLIENT', label: 'Client' },
  { value: 'PROCESS', label: 'Process' },
];

export const CreateAuditPage: React.FC = () => {
  const navigate = useNavigate();
  const createAudit = useCreateAudit();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<AuditFormData>({
    resolver: zodResolver(auditSchema),
    defaultValues: {
      title: '',
      description: '',
      auditType: 'COMPLIANCE',
      priority: 'MEDIUM',
      scope: 'ORGANIZATION',
      scheduledStartDate: '',
      scheduledEndDate: '',
      leadAuditorId: '',
    },
  });

  const auditType = useWatch({ control, name: 'auditType' });
  const priority = useWatch({ control, name: 'priority' });
  const scope = useWatch({ control, name: 'scope' });

  const onFormSubmit = async (data: AuditFormData) => {
    const input: CreateAuditInput = { ...data };
    try {
      const newAudit = await createAudit.mutateAsync(input);
      Promise.resolve(navigate(`/quality-assurance/audits/${newAudit.id}`)).catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Navigation failed');
      });
    } catch {
      // Error is handled by the mutation
    }
  };

  if (createAudit.isError) {
    return (
      <ErrorMessage
        message={(createAudit.error as Error).message || 'Failed to create audit'}
        retry={() => createAudit.reset()}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/quality-assurance/audits">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Audits
          </Button>
        </Link>
      </div>

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Schedule New Audit</h1>
        <p className="text-gray-600 mt-1">
          Create a new quality assurance audit with scope, priority, and schedule
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { handleSubmit(onFormSubmit)(e).catch((err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed to submit audit'); }); }} className="space-y-6">
            <div>
              <Label htmlFor="audit-title" className="block text-sm font-medium mb-2">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input id="audit-title" {...register('title')} placeholder="Enter audit title" />
              {errors.title?.message && (
                <p className="text-destructive text-sm mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="audit-description" className="block text-sm font-medium mb-2">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="audit-description"
                {...register('description')}
                rows={4}
                placeholder="Describe the purpose and scope of this audit"
              />
              {errors.description?.message && (
                <p className="text-destructive text-sm mt-1">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="audit-type" className="block text-sm font-medium mb-2">
                  Audit Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={auditType}
                  onValueChange={(val) =>
                    setValue('auditType', val as AuditFormData['auditType'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="audit-type" className="w-full">
                    <SelectValue placeholder="Select audit type" />
                  </SelectTrigger>
                  <SelectContent>
                    {auditTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.auditType?.message && (
                  <p className="text-destructive text-sm mt-1">{errors.auditType.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="audit-priority" className="block text-sm font-medium mb-2">
                  Priority <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={priority}
                  onValueChange={(val) =>
                    setValue('priority', val as AuditFormData['priority'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="audit-priority" className="w-full">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.priority?.message && (
                  <p className="text-destructive text-sm mt-1">{errors.priority.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="audit-scope" className="block text-sm font-medium mb-2">
                  Scope <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={scope}
                  onValueChange={(val) =>
                    setValue('scope', val as AuditFormData['scope'], {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="audit-scope" className="w-full">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.scope?.message && (
                  <p className="text-destructive text-sm mt-1">{errors.scope.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="audit-start-date" className="block text-sm font-medium mb-2">
                  Scheduled Start Date <span className="text-destructive">*</span>
                </Label>
                <Input id="audit-start-date" type="date" {...register('scheduledStartDate')} />
                {errors.scheduledStartDate?.message && (
                  <p className="text-destructive text-sm mt-1">{errors.scheduledStartDate.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="audit-end-date" className="block text-sm font-medium mb-2">
                  Scheduled End Date <span className="text-destructive">*</span>
                </Label>
                <Input id="audit-end-date" type="date" {...register('scheduledEndDate')} />
                {errors.scheduledEndDate?.message && (
                  <p className="text-destructive text-sm mt-1">{errors.scheduledEndDate.message}</p>
                )}
              </div>
            </div>

            {/*
              Pending: No reusable user-picker component exists under @/core/components yet.
              Using a plain text input for the lead auditor's user ID until one is built.
            */}
            <div>
              <Label htmlFor="audit-lead-auditor" className="block text-sm font-medium mb-2">
                Lead Auditor ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="audit-lead-auditor"
                {...register('leadAuditorId')}
                placeholder="Enter lead auditor user ID"
              />
              {errors.leadAuditorId?.message && (
                <p className="text-destructive text-sm mt-1">{errors.leadAuditorId.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" disabled={createAudit.isPending}>
                {createAudit.isPending ? 'Creating...' : 'Create Audit'}
              </Button>
              <Link to="/quality-assurance/audits">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading Overlay */}
      {createAudit.isPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <LoadingSpinner size="lg" />
            <span className="text-lg font-medium">Creating Audit...</span>
          </div>
        </div>
      )}
    </div>
  );
};

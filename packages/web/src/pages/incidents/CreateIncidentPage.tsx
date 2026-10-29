/**
 * Create Incident Page
 *
 * Form for reporting new incidents with validation and submission.
 */

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useApiClient } from '@/core/hooks';
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
import {
  createIncidentApiService,
  type CreateIncidentInput,
} from '@/verticals/incident-reporting-frontend/services/incident-api.js';

export function CreateIncidentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const prefilledClientId = searchParams.get('clientId') ?? '';

  const apiClient = useApiClient();
  const incidentApi = useMemo(() => createIncidentApiService(apiClient), [apiClient]);

  const [formData, setFormData] = useState<CreateIncidentInput>({
    clientId: prefilledClientId,
    incidentType: 'FALL',
    severity: 'MEDIUM',
    occurredAt: new Date().toISOString().slice(0, 16),
    location: '',
    description: '',
    immediateAction: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateIncidentInput) => incidentApi.createIncident(data),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Incident reported successfully');
      Promise.resolve(navigate(`/incidents/${data.id}`)).catch(() => {});
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to report incident');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Report Incident</h1>
        <p className="text-gray-600 mt-1">Document a new incident for compliance tracking</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Client ID */}
        <div>
          <Label htmlFor="clientId" className="block text-sm font-medium mb-2">
            Client ID <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            id="clientId"
            name="clientId"
            required
            value={formData.clientId}
            onChange={handleChange}
            placeholder="Enter client ID"
          />
        </div>

        {/* Incident Type */}
        <div>
          <Label htmlFor="incidentType" className="block text-sm font-medium mb-2">
            Incident Type <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.incidentType}
            onValueChange={(val) =>
              setFormData((prev) => ({
                ...prev,
                incidentType: val as CreateIncidentInput['incidentType'],
              }))
            }
          >
            <SelectTrigger id="incidentType" className="w-full">
              <SelectValue placeholder="Select incident type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FALL">Fall</SelectItem>
              <SelectItem value="MEDICATION_ERROR">Medication Error</SelectItem>
              <SelectItem value="INJURY">Injury</SelectItem>
              <SelectItem value="ABUSE_ALLEGATION">Abuse Allegation</SelectItem>
              <SelectItem value="NEGLECT_ALLEGATION">Neglect Allegation</SelectItem>
              <SelectItem value="EXPLOITATION_ALLEGATION">Exploitation Allegation</SelectItem>
              <SelectItem value="EQUIPMENT_FAILURE">Equipment Failure</SelectItem>
              <SelectItem value="EMERGENCY_HOSPITALIZATION">Emergency Hospitalization</SelectItem>
              <SelectItem value="DEATH">Death</SelectItem>
              <SelectItem value="ELOPEMENT">Elopement</SelectItem>
              <SelectItem value="BEHAVIORAL_INCIDENT">Behavioral Incident</SelectItem>
              <SelectItem value="INFECTION">Infection</SelectItem>
              <SelectItem value="PRESSURE_INJURY">Pressure Injury</SelectItem>
              <SelectItem value="CLIENT_REFUSAL">Client Refusal</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Severity */}
        <div>
          <Label htmlFor="severity" className="block text-sm font-medium mb-2">
            Severity <span className="text-destructive">*</span>
          </Label>
          <Select
            value={formData.severity}
            onValueChange={(val) =>
              setFormData((prev) => ({
                ...prev,
                severity: val as CreateIncidentInput['severity'],
              }))
            }
          >
            <SelectTrigger id="severity" className="w-full">
              <SelectValue placeholder="Select severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="CRITICAL">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date/Time Occurred */}
        <div>
          <Label htmlFor="occurredAt" className="block text-sm font-medium mb-2">
            Date & Time Occurred <span className="text-destructive">*</span>
          </Label>
          <Input
            type="datetime-local"
            id="occurredAt"
            name="occurredAt"
            required
            value={formData.occurredAt}
            onChange={handleChange}
          />
        </div>

        {/* Location */}
        <div>
          <Label htmlFor="location" className="block text-sm font-medium mb-2">
            Location <span className="text-destructive">*</span>
          </Label>
          <Input
            type="text"
            id="location"
            name="location"
            required
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g., Client's home, bathroom"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="description" className="block text-sm font-medium mb-2">
            Description <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="description"
            name="description"
            required
            value={formData.description}
            onChange={handleChange}
            rows={4}
            placeholder="Describe what happened in detail..."
          />
          <p className="text-sm text-muted-foreground mt-1">
            Include who, what, when, where, and how. Be specific and factual.
          </p>
        </div>

        {/* Immediate Action */}
        <div>
          <Label htmlFor="immediateAction" className="block text-sm font-medium mb-2">
            Immediate Action Taken
          </Label>
          <Textarea
            id="immediateAction"
            name="immediateAction"
            value={formData.immediateAction}
            onChange={handleChange}
            rows={3}
            placeholder="What was done immediately after the incident?"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="submit"
            variant="destructive"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Reporting...' : 'Report Incident'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => { Promise.resolve(navigate('/incidents')).catch(() => {}); }}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}

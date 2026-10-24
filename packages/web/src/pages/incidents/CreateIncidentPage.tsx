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
import {
  createIncidentApiService,
  type CreateIncidentInput,
} from '@/verticals/incident-reporting-frontend/services/incident-api.js';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';

export function CreateIncidentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const prefilledClientId = searchParams.get('clientId') || '';

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
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      toast.success('Incident reported successfully');
      navigate(`/incidents/${data.id}`);
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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleIncidentTypeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, incidentType: value as CreateIncidentInput['incidentType'] }));
  };

  const handleSeverityChange = (value: string) => {
    setFormData((prev) => ({ ...prev, severity: value as CreateIncidentInput['severity'] }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Report Incident</h1>
        <p className="text-gray-600 mt-1">Document a new incident for compliance tracking</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client ID */}
            <div>
              <Label htmlFor="clientId">
                Client ID <span className="text-red-600">*</span>
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
              <Label htmlFor="incidentType">
                Incident Type <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.incidentType}
                onValueChange={handleIncidentTypeChange}
              >
                <SelectTrigger>
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
              <Label htmlFor="severity">
                Severity <span className="text-red-600">*</span>
              </Label>
              <Select
                value={formData.severity}
                onValueChange={handleSeverityChange}
              >
                <SelectTrigger>
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
              <Label htmlFor="occurredAt">
                Date & Time Occurred <span className="text-red-600">*</span>
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
              <Label htmlFor="location">
                Location <span className="text-red-600">*</span>
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
              <Label htmlFor="description">
                Description <span className="text-red-600">*</span>
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
              <p className="text-sm text-gray-500 mt-1">
                Include who, what, when, where, and how. Be specific and factual.
              </p>
            </div>

            {/* Immediate Action */}
            <div>
              <Label htmlFor="immediateAction">
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
                disabled={createMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {createMutation.isPending ? 'Reporting...' : 'Report Incident'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/incidents')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

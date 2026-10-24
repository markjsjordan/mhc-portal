/**
 * Incident List Page
 *
 * Display all incidents with filtering, searching, and quick actions.
 * Enables coordinators and admins to track compliance incidents.
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useApiClient } from '@/core/hooks';
import {
  createIncidentApiService,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentType,
} from '@/verticals/incident-reporting-frontend/services/incident-api.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function IncidentListPage() {
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'ALL'>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'ALL'>('ALL');

  const apiClient = useApiClient();
  const incidentApi = useMemo(() => createIncidentApiService(apiClient), [apiClient]);

  const { data: rawIncidents, isLoading, error } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentApi.getIncidents(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const incidents = Array.isArray(rawIncidents) ? rawIncidents : [];

  const filteredIncidents = incidents.filter((incident) => {
    if (filterStatus !== 'ALL' && incident.status !== filterStatus) return false;
    if (filterSeverity !== 'ALL' && incident.severity !== filterSeverity) return false;
    return true;
  });

  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'LOW':
        return 'bg-blue-100 text-blue-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'CRITICAL':
        return 'bg-red-100 text-red-800';
    }
  };

  const getStatusColor = (status: IncidentStatus) => {
    switch (status) {
      case 'REPORTED':
        return 'bg-gray-100 text-gray-800';
      case 'UNDER_REVIEW':
        return 'bg-blue-100 text-blue-800';
      case 'INVESTIGATION_REQUIRED':
        return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED':
        return 'bg-green-100 text-green-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getTypeIcon = (type: IncidentType) => {
    switch (type) {
      case 'FALL':
        return '🚨';
      case 'MEDICATION_ERROR':
        return '💊';
      case 'INJURY':
        return '🩹';
      case 'ABUSE_ALLEGATION':
      case 'NEGLECT_ALLEGATION':
      case 'EXPLOITATION_ALLEGATION':
        return '⚠️';
      case 'EMERGENCY_HOSPITALIZATION':
        return '🚑';
      case 'DEATH':
        return '💔';
      case 'INFECTION':
        return '🦠';
      default:
        return '📋';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-4"
          data-testid="incidents-error"
        >
          <p className="text-red-800">
            Failed to load incidents. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incident Reports</h1>
          <p className="text-gray-600 mt-1">Track and manage compliance incidents</p>
        </div>
        <Link to="/incidents/new">
          <Button className="bg-red-600 hover:bg-red-700">
            + Report Incident
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as IncidentStatus | 'ALL')}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="REPORTED">Reported</SelectItem>
                  <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                  <SelectItem value="INVESTIGATION_REQUIRED">Investigation Required</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="severity-filter">Severity</Label>
              <Select value={filterSeverity} onValueChange={(value) => setFilterSeverity(value as IncidentSeverity | 'ALL')}>
                <SelectTrigger id="severity-filter">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Severities</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requiring Investigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {incidents.filter((i) => i.investigationRequired).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">State Reporting Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {incidents.filter((i) => i.stateReportingRequired).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Severity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {incidents.filter((i) => i.severity === 'CRITICAL').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidents List */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">No incidents found</p>
          <p className="text-gray-400 text-sm mt-2">
            {filterStatus !== 'ALL' || filterSeverity !== 'ALL'
              ? 'Try adjusting your filters'
              : 'No incidents have been reported'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIncidents.map((incident) => (
            <Link
              key={incident.id}
              to={`/incidents/${incident.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Icon */}
                    <div className="text-3xl">{getTypeIcon(incident.incidentType)}</div>

                    {/* Incident Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {incident.incidentType.replace(/_/g, ' ')}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(
                            incident.severity
                          )}`}
                        >
                          {incident.severity}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            incident.status
                          )}`}
                        >
                          {incident.status.replace(/_/g, ' ')}
                        </span>
                        {incident.stateReportingRequired && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            State Report Required
                          </span>
                        )}
                        {incident.investigationRequired && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Investigation Required
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 mb-3 line-clamp-2">{incident.description}</p>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Client</p>
                          <p className="font-medium text-gray-900">{incident.clientName || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Location</p>
                          <p className="font-medium text-gray-900">{incident.location}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Occurred</p>
                          <p className="font-medium text-gray-900">
                            {new Date(incident.occurredAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Reported By</p>
                          <p className="font-medium text-gray-900">
                            {incident.reportedByName || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="ml-4">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M9 5l7 7-7 7"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

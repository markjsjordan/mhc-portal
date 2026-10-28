/**
 * Audit Detail Page
 *
 * Displays detailed information about an audit including findings and corrective actions
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, FileText, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { useAuditDetail } from '../hooks';
import { FindingCard, CorrectiveActionCard } from '../components';
import { toast } from 'sonner';

export const AuditDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: audit, isLoading, error } = useAuditDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !audit) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load audit details</p>
        {error && <p className="text-sm text-gray-600 mt-2">{(error as Error).message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            Promise.resolve(navigate('/quality-assurance/audits')).catch((err: unknown) => {
              toast.error(err instanceof Error ? err.message : 'Navigation failed');
            });
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{audit.title}</h1>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
              {audit.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-gray-600 mt-1">{audit.auditNumber}</p>
        </div>
      </div>

      {/* Audit Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-900">Audit Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Description</p>
              <p className="text-gray-900">{audit.description}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Scheduled Dates</p>
                  <p className="text-gray-900">
                    {new Date(audit.scheduledStartDate).toLocaleDateString()} - {new Date(audit.scheduledEndDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Lead Auditor</p>
                  <p className="text-gray-900">{audit.leadAuditorName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Audit Type</p>
                  <p className="text-gray-900">{audit.auditType}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Score */}
          {audit.complianceScore !== undefined && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Compliance Score</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {audit.complianceScore}%
                  </p>
                </div>
                {audit.overallRating && (
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Overall Rating</p>
                    <p className="text-lg font-semibold text-gray-900 mt-1">
                      {audit.overallRating.replace('_', ' ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Executive Summary */}
          {audit.executiveSummary && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-900 mb-2">Executive Summary</p>
              <p className="text-gray-700 whitespace-pre-wrap">{audit.executiveSummary}</p>
            </div>
          )}

          {/* Recommendations */}
          {audit.recommendations && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-900 mb-2">Recommendations</p>
              <p className="text-gray-700 whitespace-pre-wrap">{audit.recommendations}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Findings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Total Findings</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{audit.totalFindings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Critical</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{audit.criticalFindings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Major</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{audit.majorFindings}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">Minor</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{audit.minorFindings}</p>
          </CardContent>
        </Card>
      </div>

      {/* Findings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Findings ({audit.findings?.length || 0})
          </h2>
        </div>
        {audit.findings && audit.findings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {audit.findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-gray-600">
              No findings recorded
            </CardContent>
          </Card>
        )}
      </div>

      {/* Corrective Actions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Corrective Actions ({audit.correctiveActions?.length || 0})
          </h2>
        </div>
        {audit.correctiveActions && audit.correctiveActions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {audit.correctiveActions.map((action) => (
              <CorrectiveActionCard key={action.id} action={action} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-gray-600">
              No corrective actions created
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

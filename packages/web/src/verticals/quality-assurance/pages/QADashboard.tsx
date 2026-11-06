/**
 * QA Dashboard Page
 *
 * Dashboard displaying audit statistics, upcoming audits, critical findings,
 * and overdue corrective actions
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Plus } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent } from '@/components/ui/card.js';
import { useAuditDashboard } from '../hooks';
import { AuditCard, FindingCard, CorrectiveActionCard } from '../components';
import { toast } from 'sonner';

export const QADashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data: dashboard, isLoading, error } = useAuditDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load dashboard data</p>
        <p className="text-sm text-gray-600 mt-2">{(error as Error).message}</p>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const stats = dashboard.statistics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quality Assurance Dashboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor audits, findings, and corrective actions
          </p>
        </div>
        <Link to="/quality-assurance/audits/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Audit
          </Button>
        </Link>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Audits</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalAudits}
                </p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Findings</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalFindings}
                </p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-between">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Corrective Actions</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.openCorrectiveActions}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Compliance Score</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.averageComplianceScore.toFixed(1)}%
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Audits */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Audits</h2>
            <Link to="/quality-assurance/audits?status=SCHEDULED">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.upcomingAudits.length > 0 ? (
              dashboard.upcomingAudits.map((audit) => (
                <AuditCard key={audit.id} audit={audit} />
              ))
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-gray-600 text-sm">
                  No upcoming audits
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* In Progress Audits */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">In Progress</h2>
            <Link to="/quality-assurance/audits?status=IN_PROGRESS">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.inProgressAudits.length > 0 ? (
              dashboard.inProgressAudits.map((audit) => (
                <AuditCard key={audit.id} audit={audit} />
              ))
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-gray-600 text-sm">
                  No audits in progress
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recently Completed */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recently Completed</h2>
            <Link to="/quality-assurance/audits?status=COMPLETED">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.recentlyCompleted.length > 0 ? (
              dashboard.recentlyCompleted.map((audit) => (
                <AuditCard key={audit.id} audit={audit} />
              ))
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-gray-600 text-sm">
                  No recently completed audits
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Critical Findings and Overdue Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Critical Findings */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Critical Findings
            </h2>
          </div>
          <div className="space-y-3">
            {dashboard.criticalFindings.length > 0 ? (
              dashboard.criticalFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onClick={() => {
                    Promise.resolve(navigate(`/quality-assurance/audits/${finding.auditId}`)).catch((err: unknown) => {
                      toast.error(err instanceof Error ? err.message : 'Navigation failed');
                    });
                  }}
                />
              ))
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-gray-600 text-sm">
                  No critical findings
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Overdue Corrective Actions */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Overdue Corrective Actions
            </h2>
            <Link to="/quality-assurance/corrective-actions?overdue=true">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>
          <div className="space-y-3">
            {dashboard.overdueCorrectiveActions.length > 0 ? (
              dashboard.overdueCorrectiveActions.map((action) => (
                <CorrectiveActionCard
                  key={action.id}
                  action={action}
                  onClick={() => {
                    Promise.resolve(navigate(`/quality-assurance/audits/${action.auditId}`)).catch((err: unknown) => {
                      toast.error(err instanceof Error ? err.message : 'Navigation failed');
                    });
                  }}
                />
              ))
            ) : (
              <Card>
                <CardContent className="p-4 text-center text-gray-600 text-sm">
                  No overdue corrective actions
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Play, 
  User, 
  Calendar, 
  Target, 
  AlertTriangle,
  CheckCircle,
  FileText,
  Trash2
} from 'lucide-react';
import { LoadingSpinner, ErrorMessage, StatusBadge } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { usePermissions } from '@/core/hooks';
import { formatDate } from '@/core/utils';
import { useCarePlan, useActivateCarePlan, useUpdateCarePlan, useDeleteCarePlan } from '../hooks';
import { useClient } from '@/verticals/client-demographics/hooks';

const getDeleteDisabledReason = (status?: string): string | undefined => {
  if (status === 'ACTIVE') return 'Cannot delete an active care plan. Please discontinue it first.';
  if (status === 'COMPLETED') return 'Completed care plans are retained for clinical and compliance records and cannot be deleted.';
  return undefined;
};

const getPriorityColor = (priority?: string): string => {
  if (priority === 'URGENT') return 'text-red-600';
  if (priority === 'HIGH') return 'text-orange-600';
  if (priority === 'MEDIUM') return 'text-yellow-600';
  return 'text-gray-600';
};

export const CarePlanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: carePlan, isLoading, error, refetch } = useCarePlan(id);
  const { data: client } = useClient(carePlan?.clientId);
  const activateCarePlan = useActivateCarePlan();
  const updateCarePlan = useUpdateCarePlan();
  const deleteCarePlan = useDeleteCarePlan();
  const [now] = useState(() => Date.now());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canManageCarePlans = can('care-plans:delete') || can('care-plans:*') || can('care_plans:write');
  const canEditCarePlans = can('care-plans:update') || can('care-plans:*') || can('care_plans:write');

  const isDeleteDisabled = carePlan?.status === 'ACTIVE' || carePlan?.status === 'COMPLETED';
  const deleteDisabledReason = getDeleteDisabledReason(carePlan?.status);

  const handleActivate = async () => {
    if (!carePlan) return;
    
    try {
      await activateCarePlan.mutateAsync(carePlan.id);
      void refetch();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleDiscontinue = async () => {
    if (!carePlan) return;
    
    try {
      await updateCarePlan.mutateAsync({
        id: carePlan.id,
        input: { status: 'DISCONTINUED' },
      });
      void refetch();
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleDelete = async () => {
    if (!carePlan) return;
    
    try {
      await deleteCarePlan.mutateAsync(carePlan.id);
      Promise.resolve(navigate('/care-plans')).catch(() => {});
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
  
  const isExpiringSoon = carePlan.expirationDate && 
    new Date(carePlan.expirationDate) <= new Date(now + 30 * 24 * 60 * 60 * 1000);

  const isOverdue = carePlan.reviewDate && 
    new Date(carePlan.reviewDate) < new Date(now);

  const achievedGoalsCount = carePlan.goals.filter(g => g.status === 'ACHIEVED').length;
  const inProgressGoalsCount = carePlan.goals.filter(g => 
    ['IN_PROGRESS', 'ON_TRACK'].includes(g.status)
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/care-plans">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{carePlan.name}</h1>
          <p className="text-gray-600 mt-1">{carePlan.planNumber}</p>
          <p className="text-sm text-gray-500 mt-1">
            {carePlan.planType.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <StatusBadge status={carePlan.status} />
          {canManageCarePlans && (
            <>
              {carePlan.status === 'DRAFT' && (
                <Button
                  onClick={() => { void handleActivate(); }}
                  disabled={activateCarePlan.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Activate
                </Button>
              )}
              {carePlan.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  onClick={() => { void handleDiscontinue(); }}
                  disabled={updateCarePlan.isPending}
                >
                  Discontinue
                </Button>
              )}
              {canEditCarePlans && (
                <Link to={`/care-plans/${carePlan.id}/edit`}>
                  <Button variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </Link>
              )}
              <span
                title={deleteDisabledReason}
                className={isDeleteDisabled ? 'inline-block cursor-not-allowed' : undefined}
              >
                <Button 
                  variant="outline" 
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleteDisabled}
                  className={isDeleteDisabled ? 'opacity-50 pointer-events-none' : 'text-red-600 hover:text-red-700 hover:border-red-300'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Alerts */}
      {(isExpiringSoon ?? isOverdue) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isExpiringSoon && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-md">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-800">Expiring Soon</p>
                <p className="text-sm text-orange-600">
                  This care plan expires on {formatDate(carePlan.expirationDate!)}
                </p>
              </div>
            </div>
          )}
          {isOverdue && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-md">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">Review Overdue</p>
                <p className="text-sm text-red-600">
                  Review was due on {formatDate(carePlan.reviewDate!)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Plan Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Plan Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Client ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{carePlan.clientId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Organization ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{carePlan.organizationId}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Effective Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(carePlan.effectiveDate)}
                  </dd>
                </div>
                {carePlan.expirationDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Expiration Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDate(carePlan.expirationDate)}
                    </dd>
                  </div>
                )}
                {carePlan.reviewDate && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Review Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDate(carePlan.reviewDate)}
                    </dd>
                  </div>
                )}
                {carePlan.estimatedHoursPerWeek && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Estimated Hours/Week</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {carePlan.estimatedHoursPerWeek}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Priority</dt>
                  <dd className="mt-1">
                    <span className={`text-sm font-medium ${getPriorityColor(carePlan.priority)}`}>
                      {carePlan.priority}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Compliance Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={carePlan.complianceStatus} />
                  </dd>
                </div>
              </dl>

              {carePlan.assessmentSummary && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-500">Assessment Summary</dt>
                  <dd className="mt-1 text-sm text-gray-900">{carePlan.assessmentSummary}</dd>
                </div>
              )}

              {carePlan.notes && (
                <div className="mt-4">
                  <dt className="text-sm font-medium text-gray-500">Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900">{carePlan.notes}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{`Goals (${carePlan.goals.length})`}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {carePlan.goals.map((goal) => (
                  <div key={goal.id} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{goal.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{goal.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {goal.category.replace(/_/g, ' ')} • Priority: {goal.priority}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={goal.status} />
                        {goal.progressPercentage !== undefined && (
                          <div className="text-sm text-gray-600">
                            {goal.progressPercentage}% Complete
                          </div>
                        )}
                      </div>
                    </div>
                    {goal.targetDate && (
                      <div className="mt-2 text-sm text-gray-600">
                        Target: {formatDate(goal.targetDate)}
                      </div>
                    )}
                    {goal.achievedDate && (
                      <div className="mt-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4 inline mr-1" />
                        Achieved on {formatDate(goal.achievedDate)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Interventions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">{`Interventions (${carePlan.interventions.length})`}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {carePlan.interventions.map((intervention) => (
                  <div key={intervention.id} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{intervention.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{intervention.description}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {intervention.category.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <StatusBadge status={intervention.status} />
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>{intervention.instructions}</p>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Started: {formatDate(intervention.startDate)}
                      {intervention.endDate && ` • Ends: ${formatDate(intervention.endDate)}`}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Goals</span>
                  <span className="text-sm font-medium">{carePlan.goals.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Achieved</span>
                  <span className="text-sm font-medium text-green-600">{achievedGoalsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="text-sm font-medium text-blue-600">{inProgressGoalsCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Interventions</span>
                  <span className="text-sm font-medium">{carePlan.interventions.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Task Templates</span>
                  <span className="text-sm font-medium">{carePlan.taskTemplates.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link to={`/tasks?carePlanId=${carePlan.id}`}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Target className="h-4 w-4 mr-2" />
                    View Tasks
                  </Button>
                </Link>
                <Link to={`/care-plans/${carePlan.id}/progress-notes`}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="h-4 w-4 mr-2" />
                    Progress Notes
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="w-full justify-start" disabled title="Coming soon">
                  <User className="h-4 w-4 mr-2" />
                  Assign Caregiver
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start" disabled title="Coming soon">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Review
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Care Plan Created</p>
                    <p className="text-xs text-gray-600">
                      {formatDate(carePlan.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Effective Date</p>
                    <p className="text-xs text-gray-600">
                      {formatDate(carePlan.effectiveDate)}
                    </p>
                  </div>
                </div>
                {carePlan.lastReviewedDate && (
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 mt-2 rounded-full bg-yellow-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Last Reviewed</p>
                      <p className="text-xs text-gray-600">
                        {formatDate(carePlan.lastReviewedDate)}
                      </p>
                    </div>
                  </div>
                )}
                {carePlan.lastComplianceCheck && (
                  <div className="flex items-start gap-3">
                    <div className="h-2 w-2 mt-2 rounded-full bg-purple-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Compliance Check</p>
                      <p className="text-xs text-gray-600">
                        {formatDate(carePlan.lastComplianceCheck)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-3 text-red-600">
              <AlertTriangle className="h-6 w-6 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Care Plan</h3>
            </div>
            <p className="text-sm text-gray-700 mb-3">
              Are you sure you want to delete the <span className="font-semibold">{carePlan.planType.replace(/_/g, ' ')}</span> care plan for <span className="font-semibold">{client ? (client.preferredName ?? `${client.firstName} ${client.lastName}`) : 'this client'}</span> ({carePlan.planNumber})?
            </p>
            <p className="text-xs text-gray-500 mb-5">
              This action will soft-delete the care plan and remove it from active views while retaining the record for compliance and audit retention requirements.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteCarePlan.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => { void handleDelete(); }}
                disabled={deleteCarePlan.isPending}
              >
                Delete Plan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
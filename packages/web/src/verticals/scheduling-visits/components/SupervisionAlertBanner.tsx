import React, { useState } from 'react';
import { AlertTriangle, Clock, Calendar, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/core/components';
import { useNavigate } from 'react-router-dom';
import type { SupervisoryCadenceResult } from '../utils/supervisory-cadence';

interface SupervisionAlertBannerProps {
  cadence: SupervisoryCadenceResult;
  onSchedule?: () => void;
  className?: string;
  compact?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export const SupervisionAlertBanner: React.FC<SupervisionAlertBannerProps> = ({
  cadence,
  onSchedule,
  className = '',
  compact = false,
  collapsible = true,
  defaultCollapsed = false,
}) => {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  if (!cadence.showAlert) {
    return null;
  }

  const handleScheduleClick = () => {
    if (onSchedule) {
      onSchedule();
    } else if (cadence.clientId) {
      void navigate(`/scheduling/builder?clientId=${cadence.clientId}&visitType=SUPERVISION`);
    } else {
      void navigate('/scheduling/builder?visitType=SUPERVISION');
    }
  };

  const isOverdue = cadence.isOverdue;

  if (compact) {
    return (
      <div
        className={`flex flex-wrap sm:flex-nowrap items-center justify-between p-3 rounded-lg border text-sm gap-2 ${
          isOverdue
            ? 'bg-red-50 border-red-300 text-red-900'
            : 'bg-amber-50 border-amber-300 text-amber-900'
        } ${className}`}
        role="alert"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isOverdue ? (
            <ShieldAlert className="h-4 w-4 text-red-600 flex-shrink-0" />
          ) : (
            <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <span className="font-semibold">{cadence.alertTitle}: </span>
            <span className="break-words">{cadence.alertMessage}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant={isOverdue ? 'danger' : 'outline'}
          onClick={handleScheduleClick}
          className="ml-auto sm:ml-4 flex-shrink-0 min-h-[44px]"
        >
          Schedule Supervision Visit
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-3.5 sm:p-4 shadow-sm transition-all max-w-full ${
        isOverdue
          ? 'bg-red-50/90 border-red-300 text-red-950'
          : 'bg-amber-50/90 border-amber-300 text-amber-950'
      } ${className}`}
      role="alert"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1 w-full">
          <div
            className={`p-2 rounded-lg flex-shrink-0 mt-0.5 ${
              isOverdue ? 'bg-red-200/80 text-red-700' : 'bg-amber-200/80 text-amber-700'
            }`}
          >
            {isOverdue ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm sm:text-base tracking-tight break-words">{cadence.alertTitle}</h4>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider shrink-0 ${
                  isOverdue
                    ? 'bg-red-200 text-red-900 border border-red-300'
                    : 'bg-amber-200 text-amber-900 border border-amber-300'
                }`}
              >
                {isOverdue ? 'Compliance Overdue' : 'Upcoming Mandate'}
              </span>
              <span className="text-xs text-gray-500 bg-white/70 px-2 py-0.5 rounded border border-gray-200 shrink-0">
                {cadence.regulationCitation}
              </span>
            </div>

            {!isCollapsed && (
              <div className="space-y-1 pt-1">
                <p className="text-sm text-gray-800 leading-relaxed break-words">{cadence.alertMessage}</p>
                <p className="text-xs font-medium text-gray-600 italic break-words">
                  Recommendation: {cadence.recommendation}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-between sm:justify-end pt-2 sm:pt-0 border-t border-black/5 sm:border-0">
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1 min-h-[44px] px-2 rounded"
              aria-label={isCollapsed ? 'Expand alert details' : 'Collapse alert details'}
            >
              {isCollapsed ? (
                <>
                  <span>Details</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span>Collapse</span>
                  <ChevronUp className="h-4 w-4" />
                </>
              )}
            </button>
          )}

          <Button
            variant={isOverdue ? 'danger' : 'primary'}
            size="sm"
            onClick={handleScheduleClick}
            leftIcon={<Calendar className="h-4 w-4" />}
            className="min-h-[44px] shadow-sm flex-1 sm:flex-none text-xs sm:text-sm"
          >
            Schedule Supervision Visit
          </Button>
        </div>
      </div>
    </div>
  );
};

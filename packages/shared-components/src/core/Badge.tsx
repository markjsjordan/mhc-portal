import React from 'react';
import { cn } from '../utils/classnames.js';
import type { Status } from '../types/ui.js';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: Status | 'default';
  size?: 'sm' | 'md';
  className?: string;
}

const variantClasses = {
  default: 'bg-gray-100 text-gray-800 border border-gray-200',
  success: 'bg-green-100 text-green-800',
  error: 'bg-red-100 text-red-800',
  warning: 'bg-yellow-100 text-yellow-800',
  info: 'bg-blue-100 text-blue-800',
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
}) => {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full font-medium whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
};

function formatStatusLabel(status?: string): string {
  if (!status) return '';
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const statusMap: Record<string, { variant: Status | 'default'; label: string }> = {
    ACTIVE: { variant: 'success', label: 'Active' },
    INACTIVE: { variant: 'default', label: 'Inactive' },
    PENDING: { variant: 'warning', label: 'Pending' },
    PENDING_ONBOARDING: { variant: 'warning', label: 'Pending Onboarding' },
    ONBOARDING: { variant: 'info', label: 'Onboarding' },
    APPLICATION: { variant: 'info', label: 'Application' },
    INTERVIEWING: { variant: 'info', label: 'Interviewing' },
    ON_LEAVE: { variant: 'warning', label: 'On Leave' },
    SUSPENDED: { variant: 'error', label: 'Suspended' },
    TERMINATED: { variant: 'error', label: 'Terminated' },
    RETIRED: { variant: 'default', label: 'Retired' },
    INQUIRY: { variant: 'info', label: 'Inquiry' },
    PENDING_INTAKE: { variant: 'warning', label: 'Pending Intake' },
    ON_HOLD: { variant: 'warning', label: 'On Hold' },
    DISCHARGED: { variant: 'default', label: 'Discharged' },
    DECEASED: { variant: 'default', label: 'Deceased' },
    COMPLETED: { variant: 'success', label: 'Completed' },
    CANCELLED: { variant: 'error', label: 'Cancelled' },
    SCHEDULED: { variant: 'info', label: 'Scheduled' },
    IN_PROGRESS: { variant: 'info', label: 'In Progress' },
    COMPLIANT: { variant: 'success', label: 'Compliant' },
    PENDING_VERIFICATION: { variant: 'warning', label: 'Pending Verification' },
    EXPIRING_SOON: { variant: 'warning', label: 'Expiring Soon' },
    EXPIRED: { variant: 'error', label: 'Expired' },
    NON_COMPLIANT: { variant: 'error', label: 'Non-Compliant' },
    REVOKED: { variant: 'error', label: 'Revoked' },
  };

  const config = statusMap[status] || {
    variant: 'default' as const,
    label: formatStatusLabel(status),
  };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

import React from 'react';
import { getVisitTypeConfig } from '../config/visitTypeConfig';
import type { VisitType } from '../types';

interface VisitTypeBadgeProps {
  type: VisitType;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showIcon?: boolean;
  className?: string;
}

/**
 * VisitTypeBadge - Displays a visit type as a colored badge with icon and label
 *
 * Renders as an inline badge suitable for list items, cards, or headers.
 * Automatically uses the correct color, icon, and styling for the visit type.
 */
export const VisitTypeBadge: React.FC<VisitTypeBadgeProps> = ({
  type,
  size = 'md',
  showLabel = true,
  showIcon = true,
  className = '',
}) => {
  const config = getVisitTypeConfig(type);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full font-medium whitespace-nowrap ${
        config.badgeClass
      } ${sizeClasses[size]} ${className}`}
      data-testid="visit-type-badge"
      title={config.description}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {showLabel && config.label}
    </span>
  );
};

export default VisitTypeBadge;

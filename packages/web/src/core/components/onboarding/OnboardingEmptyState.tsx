import React from 'react';
import { Database, Plus, Sparkles } from 'lucide-react';
import { EmptyState } from '../feedback/EmptyState.js';
import { Button } from '@/components/ui/button.js';

export interface OnboardingEmptyStateProps {
  /**
   * The type of resource (e.g., "clients", "caregivers", "visits")
   */
  resourceType: string;
  
  /**
   * Singular form of the resource (e.g., "client", "caregiver", "visit")
   */
  resourceSingular: string;
  
  /**
   * Optional custom description
   */
  description?: string;
  
  /**
   * Whether to show the "Load Sample Data" option
   */
  showDemoDataOption?: boolean;
  
  /**
   * Callback when "Load Sample Data" is clicked
   */
  onLoadDemoData?: () => void;
  
  /**
   * Callback when "Add [Resource]" is clicked
   */
  onAddResource?: () => void;
  
  /**
   * Whether demo data is currently being loaded
   */
  isLoadingDemoData?: boolean;
  
  /**
   * Whether the user has permission to add resources
   */
  canAdd?: boolean;
  
  /**
   * Custom icon to display
   */
  icon?: React.ReactNode;
}

export const OnboardingEmptyState: React.FC<OnboardingEmptyStateProps> = ({
  resourceType,
  resourceSingular,
  description,
  showDemoDataOption = true,
  onLoadDemoData,
  onAddResource,
  isLoadingDemoData = false,
  canAdd = true,
  icon,
}) => {
  const defaultDescription = 
    description || 
    `Get started by ${showDemoDataOption ? 'loading sample data to explore the platform, or by ' : ''}adding your first ${resourceSingular}.`;

  return (
    <EmptyState
      title={`No ${resourceType} yet`}
      description={defaultDescription}
      icon={icon}
      size="lg"
      action={
        showDemoDataOption && onLoadDemoData ? (
          <Button
            onClick={onLoadDemoData}
            disabled={isLoadingDemoData}
            size="lg"
            variant="default"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isLoadingDemoData ? 'Loading...' : 'Load Sample Data'}
          </Button>
        ) : canAdd && onAddResource ? (
          <Button
            onClick={onAddResource}
            size="lg"
            disabled={!canAdd}
            title={!canAdd ? `You do not have permission to create ${resourceType}` : undefined}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {resourceSingular.charAt(0).toUpperCase() + resourceSingular.slice(1)}
          </Button>
        ) : null
      }
      secondaryAction={
        showDemoDataOption && onLoadDemoData && canAdd && onAddResource ? (
          <Button
            variant="outline"
            onClick={onAddResource}
            disabled={!canAdd || isLoadingDemoData}
            title={!canAdd ? `You do not have permission to create ${resourceType}` : undefined}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add {resourceSingular.charAt(0).toUpperCase() + resourceSingular.slice(1)}
          </Button>
        ) : null
      }
      metadata={
        showDemoDataOption && onLoadDemoData ? (
          <div className="bg-primary/10 border border-border rounded-lg p-4 text-sm text-foreground max-w-md">
            <div className="flex items-start gap-2">
              <Database className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
              <div className="text-left">
                <p className="font-medium mb-1">What's sample data?</p>
                <p className="text-muted-foreground">
                  Sample data includes realistic {resourceType}, allowing you to explore features
                  before adding your own. You can remove it anytime.
                </p>
              </div>
            </div>
          </div>
        ) : null
      }
    />
  );
};

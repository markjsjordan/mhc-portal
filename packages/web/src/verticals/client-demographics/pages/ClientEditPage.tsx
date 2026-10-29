import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LoadingSpinner, ErrorMessage } from '@/core/components';
import { useClient } from '../hooks';
import ClientIntakeWorkflow from '@/pages/clients/ClientIntakeWorkflow';
import { mapClientToIntakeData } from '../utils/mappers';

/**
 * ClientEditPage - Edit an existing client's information
 *
 * This page:
 * 1. Loads the existing client data by ID from URL params
 * 2. Pre-populates the ClientIntakeWorkflow form with that data
 * 3. Submits updates via the PUT /api/clients/:id endpoint
 * 4. Navigates back to the client detail page on success
 */
export const ClientEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: client, isLoading, error } = useClient(id);

  // Show loading state while fetching client data
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show error if client failed to load
  if (error || !client) {
    return (
      <ErrorMessage
        message={(error as Error).message || 'Failed to load client'}
        retry={() => window.location.reload()}
      />
    );
  }

  // Map the client data to the intake form structure
  const initialData = mapClientToIntakeData(client);

  const handleSuccess = (updatedClient: { id?: string }) => {
    // Navigate back to the client detail page after successful update
    Promise.resolve(navigate(`/clients/${updatedClient.id ?? id}`)).catch(() => {});
  };

  return (
    <ClientIntakeWorkflow
      initialData={initialData}
      isEditMode={true}
      clientId={id}
      onSuccess={handleSuccess}
    />
  );
};

/**
 * Caregiver Detail Page
 *
 * Renders the full caregiver record (credentials, training, compliance
 * status) using the existing useCaregiver(id) hook, and links out to the
 * existing /caregivers/:id/training route.
 *
 * Includes action buttons for Edit, Delete, and Duplicate with proper
 * modals and confirmation dialogs.
 */
import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Calendar, Briefcase, GraduationCap, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge, LoadingSpinner, ErrorMessage } from '@/core/components';
import { formatDate, formatPhone } from '@/core/utils';
import { useCaregiver } from '../hooks/index.js';
import {
  CaregiverActionButtons,
  EditCaregiverModal,
  DeleteCaregiverConfirmation,
  DuplicateCaregiverModal,
} from '../components/index.js';

export const CaregiverDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: caregiver, isLoading, error, refetch } = useCaregiver(id);

  // Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !caregiver) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ErrorMessage
          message={(error as Error)?.message || 'Failed to load caregiver'}
          retry={() => {
            refetch().catch((err: unknown) => {
              toast.error(err instanceof Error ? err.message : 'Failed to reload caregiver');
            });
          }}
        />
      </div>
    );
  }

  const fullName = [caregiver.firstName, caregiver.middleName, caregiver.lastName]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            Promise.resolve(navigate('/caregivers')).catch((err: unknown) => {
              toast.error(err instanceof Error ? err.message : 'Navigation failed');
            });
          }}
          aria-label="Back to caregivers"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {caregiver.preferredName ?? fullName}
            </h1>
            <StatusBadge status={caregiver.status} />
          </div>
          <p className="text-gray-600 mt-1">
            {caregiver.employeeNumber} &middot; {caregiver.role}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CaregiverActionButtons
            caregiver={caregiver}
            onEdit={() => setIsEditModalOpen(true)}
            onDelete={() => setIsDeleteModalOpen(true)}
            onDuplicate={() => setIsDuplicateModalOpen(true)}
            onViewHistory={() => {
              // Not yet implemented: navigate to audit history page (tracked in wdvf3abp43)
              console.log('View audit history');
            }}
          />
          <Link to={`/caregivers/${caregiver.id}/training`}>
            <Button variant="outline">
              <GraduationCap className="h-4 w-4 mr-1.5" />
              Training & Compliance
            </Button>
          </Link>
        </div>
      </div>

      {/* Contact */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>{caregiver.email}</span>
            </div>
            {caregiver.primaryPhone && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Phone className="h-4 w-4 text-gray-400" />
                <span>{formatPhone(caregiver.primaryPhone.number)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Hired: {formatDate(caregiver.hireDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <span>Type: {caregiver.employmentType?.replace(/_/g, ' ')}</span>
            </div>
            {caregiver.dateOfBirth && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span>DOB: {formatDate(caregiver.dateOfBirth)}</span>
              </div>
            )}
            {caregiver.employmentStatus && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Briefcase className="h-4 w-4 text-gray-400" />
                <span>Status: {caregiver.employmentStatus.replace(/_/g, ' ')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Compliance Status</CardTitle>
          <ShieldCheck className="h-5 w-5 text-gray-400" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <StatusBadge status={caregiver.complianceStatus} />
            <span className="text-sm text-gray-500">
              {caregiver.complianceStatus === 'COMPLIANT'
                ? 'All credentials and training up to date'
                : 'Review credentials and training below'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {caregiver.credentials && caregiver.credentials.length > 0 ? (
            <div className="space-y-3">
              {caregiver.credentials.map((credential) => (
                <div
                  key={credential.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{credential.name}</p>
                    <p className="text-xs text-gray-500">
                      {credential.type}
                      {credential.expirationDate &&
                        ` · Expires ${formatDate(credential.expirationDate)}`}
                    </p>
                  </div>
                  <StatusBadge status={credential.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No credentials on file.</p>
          )}
        </CardContent>
      </Card>

      {/* Training */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-medium">Training</CardTitle>
          <Link
            to={`/caregivers/${caregiver.id}/training`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View full training dashboard &rarr;
          </Link>
        </CardHeader>
        <CardContent>
          {caregiver.training && caregiver.training.length > 0 ? (
            <div className="space-y-3">
              {caregiver.training.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{record.name}</p>
                    <p className="text-xs text-gray-500">
                      {record.category} &middot; Completed {formatDate(record.completionDate)}
                    </p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No training records on file.</p>
          )}
        </CardContent>
      </Card>

      {caregiver && (
        <>
          <EditCaregiverModal
            isOpen={isEditModalOpen}
            caregiver={caregiver}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={() => {
              refetch().catch((err: unknown) => {
                toast.error(err instanceof Error ? err.message : 'Failed to refresh caregiver');
              });
              setIsEditModalOpen(false);
            }}
          />

          <DeleteCaregiverConfirmation
            isOpen={isDeleteModalOpen}
            caregiver={caregiver}
            onClose={() => setIsDeleteModalOpen(false)}
            onSuccess={() => {
              Promise.resolve(navigate('/caregivers')).catch((err: unknown) => {
                toast.error(err instanceof Error ? err.message : 'Navigation failed');
              });
            }}
          />

          <DuplicateCaregiverModal
            isOpen={isDuplicateModalOpen}
            caregiver={caregiver}
            onClose={() => setIsDuplicateModalOpen(false)}
          />
        </>
      )}
    </div>
  );
};

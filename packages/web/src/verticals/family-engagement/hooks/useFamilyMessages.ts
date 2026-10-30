/**
 * Family Messages Hooks
 *
 * React Query hooks for family messaging functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { UUID } from '@folkcare/core/browser';
import { useApiClient } from '@/core/hooks';
import { useFamilyPortalApi } from './useFamilyPortal';

export interface StaffMemberOption {
  id: UUID;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
  status: 'ACTIVE' | 'INACTIVE';
}

/**
 * Hook to fetch organization staff members for thread assignment
 */
export function useOrganizationStaff(organizationId: UUID | null) {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ['teamMembers', organizationId],
    queryFn: async (): Promise<StaffMemberOption[]> => {
      const res = await apiClient.get<
        StaffMemberOption[] | { data?: StaffMemberOption[] }
      >(`/api/organizations/${organizationId}/users`);
      return Array.isArray(res) ? res : (res.data ?? []);
    },
    enabled: !!organizationId,
    staleTime: 60000,
  });
}

/**
 * Hook to get message threads for family member
 */
export function useMessageThreads(familyMemberId: UUID | null) {
  const familyPortalApi = useFamilyPortalApi();

  return useQuery({
    queryKey: ['messageThreads', familyMemberId],
    queryFn: () => familyPortalApi.getMessageThreads(familyMemberId!),
    enabled: !!familyMemberId,
    refetchInterval: 30000, // Poll every 30 seconds for real-time updates
  });
}

/**
 * Hook to get messages in a thread
 */
export function useMessagesInThread(threadId: UUID | null) {
  const familyPortalApi = useFamilyPortalApi();

  return useQuery({
    queryKey: ['messages', threadId],
    queryFn: () => familyPortalApi.getMessagesInThread(threadId!),
    enabled: !!threadId,
    refetchInterval: 10000, // Poll every 10 seconds for active conversations
  });
}

/**
 * Hook to send a message
 */
export function useSendMessage() {
  const familyPortalApi = useFamilyPortalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, messageText }: { threadId: UUID; messageText: string }) =>
      familyPortalApi.sendMessage(threadId, messageText),
    onSuccess: (_, variables) => {
      // Invalidate and refetch messages in this thread
      void queryClient.invalidateQueries({ queryKey: ['messages', variables.threadId] });
      void queryClient.invalidateQueries({ queryKey: ['messageThreads'] });
      void queryClient.invalidateQueries({ queryKey: ['staffInbox'] });
      void queryClient.invalidateQueries({ queryKey: ['familyDashboard'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });
}

/**
 * Hook to create a new message thread
 */
export function useCreateMessageThread() {
  const familyPortalApi = useFamilyPortalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyMemberId,
      clientId,
      subject,
      initialMessage,
    }: {
      familyMemberId: UUID;
      clientId: UUID;
      subject: string;
      initialMessage: string;
    }) => familyPortalApi.createMessageThread(familyMemberId, clientId, subject, initialMessage),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messageThreads'] });
      toast.success('Message sent successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });
}

/**
 * Hook to let staff (admin/coordinator/caregiver) start a conversation with a family member.
 * The server derives `sender_type = STAFF` from the authenticated roles and notifies the family.
 */
export function useStaffCreateThread() {
  const familyPortalApi = useFamilyPortalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyMemberId,
      clientId,
      subject,
      initialMessage,
    }: {
      familyMemberId: UUID;
      clientId: UUID;
      subject: string;
      initialMessage: string;
    }) => familyPortalApi.createMessageThread(familyMemberId, clientId, subject, initialMessage),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staffInbox'] });
      void queryClient.invalidateQueries({ queryKey: ['messageThreads'] });
      toast.success('Message sent to family');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send message');
    },
  });
}

/**
 * Hook to load active family members for a client (recipient picker)
 */
export function useFamilyMembersForClient(clientId: UUID | null) {
  const familyPortalApi = useFamilyPortalApi();

  return useQuery({
    queryKey: ['familyMembersForClient', clientId],
    queryFn: () => familyPortalApi.getFamilyMembersForClient(clientId!),
    enabled: !!clientId,
  });
}

/**
 * Hook to load the staff inbox of family conversations
 */
export function useStaffInbox(status?: 'OPEN' | 'CLOSED') {
  const familyPortalApi = useFamilyPortalApi();

  return useQuery({
    queryKey: ['staffInbox', status ?? 'ALL'],
    queryFn: () => familyPortalApi.getStaffInbox(status),
    refetchInterval: 30000,
  });
}

/**
 * Hook to close/reopen a thread
 */
export function useUpdateMessageThread() {
  const familyPortalApi = useFamilyPortalApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      threadId,
      changes,
    }: {
      threadId: UUID;
      changes: { status?: 'OPEN' | 'CLOSED'; assignedToUserId?: UUID | null };
    }) => familyPortalApi.updateMessageThread(threadId, changes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staffInbox'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update conversation');
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/core/hooks';
import { useCaregiverApi } from './useCaregivers.js';

const CAREGIVER_LIKE_ROLES = ['CAREGIVER', 'NURSE_RN', 'NURSE_LPN', 'NURSE', 'CLINICAL'] as const;

/**
 * Resolves the caregiver.id (caregivers table row) linked to the
 * currently authenticated user, via GET /api/caregivers/me.
 *
 * users.id and caregivers.id are NOT the same identifier — there is
 * no FK between the two tables today; the server resolves the link
 * by matching users.email to caregivers.email (see
 * CaregiverService.getCurrentCaregiverProfile). This hook is the
 * single frontend place that performs that resolution so callers
 * never have to pass user.id where a caregiverId is expected.
 *
 * Only queries for caregiver/RN/clinical roles — admins, coordinators,
 * and family users have no caregiver record, and hitting the endpoint
 * for them would just 404. Returns `undefined` (no error surfaced)
 * when the current user does not have a linked caregiver profile.
 */
export function useMyCaregiverId(): { caregiverId: string | undefined; isLoading: boolean } {
  const { user } = useAuth();
  const caregiverApi = useCaregiverApi();

  const isCaregiverLikeRole = user?.roles.some((role) =>
    (CAREGIVER_LIKE_ROLES as readonly string[]).includes(role)
  ) ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ['caregivers', 'me', user?.id],
    queryFn: () => caregiverApi.getMyCaregiverProfile(),
    enabled: isCaregiverLikeRole,
    staleTime: 5 * 60 * 1000, // 5 minutes — a user's own caregiver link rarely changes
    retry: false, // a 404 here is an expected, valid outcome (no caregiver record)
  });

  return {
    caregiverId: data?.id,
    isLoading: isCaregiverLikeRole && isLoading,
  };
}

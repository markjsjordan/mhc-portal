import { useQuery } from '@tanstack/react-query';
import { useEVVApi } from './useEVVRecords';
import type { LocationPolicy } from '../types';

export const useLocationPolicy = () => {
  const evvApi = useEVVApi();

  const query = useQuery({
    queryKey: ['evv-location-policy'],
    queryFn: () => evvApi.getLocationPolicy(),
  });

  // Fail-safe: while loading or on error, treat the policy as locationRequired: true
  // (never skip a location check just because the policy could not be read)
  const locationRequired: boolean =
    query.isLoading || query.isError || query.data === undefined
      ? true
      : query.data.locationRequired;

  const policy: LocationPolicy = { locationRequired };

  return {
    ...query,
    locationRequired,
    data: policy,
  };
};

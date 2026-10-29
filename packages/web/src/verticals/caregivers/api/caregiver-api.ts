/**
 * Caregiver API Client
 *
 * API methods for caregiver CRUD operations including edit, delete, and duplicate.
 * 
 * Note: This module relies on axiosInstance which is provided by the API client factory.
 * In a React component context, use useApiClient() hook instead.
 */
import type { AxiosInstance } from 'axios';
import type { Caregiver } from '../types/index.js';

// Placeholder for axiosInstance - this will be injected at runtime
// or used via useApiClient() hook in React components
let axiosInstance: AxiosInstance | null = null;

export const setApiInstance = (instance: AxiosInstance) => {
  axiosInstance = instance;
};

export const caregiverApi = {
  /**
   * Get a caregiver by ID
   */
  getCaregiverById: async (id: string): Promise<Caregiver> => {
    if (!axiosInstance) throw new Error('axiosInstance not initialized');
    const response = await axiosInstance.get<Caregiver>(`/api/caregivers/${id}`);
    return response.data;
  },

  /**
   * Update a caregiver (PATCH)
   */
  updateCaregiver: async (id: string, payload: Partial<Caregiver> | Record<string, unknown>): Promise<Caregiver> => {
    if (!axiosInstance) throw new Error('axiosInstance not initialized');
    const response = await axiosInstance.patch<Caregiver>(`/api/caregivers/${id}`, payload);
    return response.data;
  },

  /**
   * Delete a caregiver (soft delete)
   */
  deleteCaregiver: async (id: string, options: { confirmName: string }): Promise<void> => {
    if (!axiosInstance) throw new Error('axiosInstance not initialized');
    await axiosInstance.delete(`/api/caregivers/${id}`, {
      data: options,
    });
  },

  /**
   * Duplicate a caregiver
   */
  duplicateCaregiver: async (id: string, payload: Record<string, unknown>): Promise<Caregiver> => {
    if (!axiosInstance) throw new Error('axiosInstance not initialized');
    const response = await axiosInstance.post<Caregiver>(`/api/caregivers/${id}/duplicate`, payload);
    return response.data;
  },
};

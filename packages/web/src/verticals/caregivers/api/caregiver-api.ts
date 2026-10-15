/**
 * Caregiver API Client
 *
 * API methods for caregiver CRUD operations including edit, delete, and duplicate.
 * 
 * Note: This module relies on axiosInstance which is provided by the API client factory.
 * In a React component context, use useApiClient() hook instead.
 */
import type { Caregiver } from '../types/index.js';

// Placeholder for axiosInstance - this will be injected at runtime
// or used via useApiClient() hook in React components
let axiosInstance: any = null;

export const setApiInstance = (instance: any) => {
  axiosInstance = instance;
};

export const caregiverApi = {
  /**
   * Get a caregiver by ID
   */
  getCaregiverById: async (id: string): Promise<Caregiver> => {
    const response = await axiosInstance.get(`/api/caregivers/${id}`);
    return response.data;
  },

  /**
   * Update a caregiver (PATCH)
   */
  updateCaregiver: async (id: string, payload: any): Promise<Caregiver> => {
    const response = await axiosInstance.patch(`/api/caregivers/${id}`, payload);
    return response.data;
  },

  /**
   * Delete a caregiver (soft delete)
   */
  deleteCaregiver: async (id: string, options: { confirmName: string }): Promise<void> => {
    await axiosInstance.delete(`/api/caregivers/${id}`, {
      data: options,
    });
  },

  /**
   * Duplicate a caregiver
   */
  duplicateCaregiver: async (id: string, payload: any): Promise<Caregiver> => {
    const response = await axiosInstance.post(`/api/caregivers/${id}/duplicate`, payload);
    return response.data;
  },
};

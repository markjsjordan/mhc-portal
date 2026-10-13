/**
 * Caregiver API Client
 *
 * API methods for caregiver CRUD operations including edit, delete, and duplicate.
 */
import { axiosInstance } from '@/core/api/axios-instance.js';
import type { Caregiver } from '../types/index.js';

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

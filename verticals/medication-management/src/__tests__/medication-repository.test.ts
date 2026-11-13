/**
 * Medication Repository Tests
 * 
 * Regression tests for jsonb column parsing bug fix.
 * node-postgres returns jsonb columns already parsed as arrays,
 * so JSON.parse(array) was causing crashes.
 * 
 * This test suite verifies parseJsonStringArray handles:
 * - Already-parsed empty arrays (default from DB)
 * - Already-parsed populated arrays
 * - Raw JSON strings (edge cases)
 * - Null/undefined values
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MedicationRepository } from '../repository/medication-repository.js';
import type { Database, UserContext } from '@folkcare/core';

// Fixed timestamps for deterministic tests
const FIXED_DATE = new Date('2024-01-15T10:00:00.000Z');

// Mock user context for tests
const mockUserContext: UserContext = {
  userId: '123e4567-e89b-12d3-a456-426614174003',
  organizationId: '123e4567-e89b-12d3-a456-426614174001',
  roles: ['COORDINATOR'],
  permissions: ['medication:read', 'medication:write'],
  branchIds: ['123e4567-e89b-12d3-a456-426614174004'],
};

describe('MedicationRepository - jsonb parsing regression tests', () => {
  let mockDatabase: Database;
  let repository: MedicationRepository;

  beforeEach(() => {
    // Mock database with query method
    mockDatabase = {
      query: vi.fn(),
    } as unknown as Database;
    
    repository = new MedicationRepository(mockDatabase);
  });

  describe('mapRowToEntity - jsonb array handling', () => {
    const baseRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      organization_id: '123e4567-e89b-12d3-a456-426614174001',
      client_id: '123e4567-e89b-12d3-a456-426614174002',
      medication_name: 'Lisinopril',
      dosage: '10mg',
      route: 'ORAL',
      frequency: 'Once daily',
      prescribed_by: 'Dr. Smith',
      prescribed_date: FIXED_DATE,
      start_date: FIXED_DATE,
      status: 'ACTIVE',
      created_at: FIXED_DATE,
      updated_at: FIXED_DATE,
      created_by: '123e4567-e89b-12d3-a456-426614174003',
      updated_by: '123e4567-e89b-12d3-a456-426614174003',
      version: 1,
    };

    it('should handle empty jsonb arrays (database default)', async () => {
      // This is what node-postgres returns for jsonb '[]' columns
      const rowWithEmptyArrays = {
        ...baseRow,
        side_effects: [], // Already parsed by node-postgres
        warnings: [],     // Already parsed by node-postgres
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithEmptyArrays],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.sideEffects).toEqual([]);
      expect(medications[0]!.warnings).toEqual([]);
    });

    it('should handle populated jsonb arrays', async () => {
      // This is what node-postgres returns for populated jsonb arrays
      const rowWithPopulatedArrays = {
        ...baseRow,
        side_effects: ['Nausea', 'Dizziness', 'Dry cough'], // Already parsed
        warnings: ['Monitor blood pressure', 'Take with food'], // Already parsed
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithPopulatedArrays],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.sideEffects).toEqual(['Nausea', 'Dizziness', 'Dry cough']);
      expect(medications[0]!.warnings).toEqual(['Monitor blood pressure', 'Take with food']);
    });

    it('should handle raw JSON string arrays (edge case)', async () => {
      // Edge case: if somehow the column comes back as a string
      const rowWithStringArrays = {
        ...baseRow,
        side_effects: '["Headache","Fatigue"]', // Raw JSON string
        warnings: '["Do not take with alcohol"]', // Raw JSON string
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithStringArrays],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.sideEffects).toEqual(['Headache', 'Fatigue']);
      expect(medications[0]!.warnings).toEqual(['Do not take with alcohol']);
    });

    it('should handle null jsonb columns', async () => {
      // When columns are explicitly null
      const rowWithNulls = {
        ...baseRow,
        side_effects: null,
        warnings: null,
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithNulls],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      // Null values should not set the properties
      expect(medications[0]!.sideEffects).toBeUndefined();
      expect(medications[0]!.warnings).toBeUndefined();
    });

    it('should handle undefined jsonb columns', async () => {
      // When columns are not returned in the query
      const rowWithoutJsonbFields = {
        ...baseRow,
        // side_effects and warnings not present
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithoutJsonbFields],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.sideEffects).toBeUndefined();
      expect(medications[0]!.warnings).toBeUndefined();
    });

    it('should handle empty JSON string (regression case)', async () => {
      // This would have caused the original crash: JSON.parse("")
      const rowWithEmptyStrings = {
        ...baseRow,
        side_effects: '', // Empty string edge case
        warnings: '   ', // Whitespace-only string edge case
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithEmptyStrings],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      // Should gracefully return empty arrays for unparseable strings
      expect(medications[0]!.sideEffects).toEqual([]);
      expect(medications[0]!.warnings).toEqual([]);
    });

    it('should handle malformed JSON gracefully', async () => {
      // Malformed JSON should return empty array instead of crashing
      const rowWithBadJson = {
        ...baseRow,
        side_effects: '{not valid json]',
        warnings: '[incomplete',
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithBadJson],
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.sideEffects).toEqual([]);
      expect(medications[0]!.warnings).toEqual([]);
    });

    it('should handle mixed valid and invalid data across rows', async () => {
      const rows = [
        { ...baseRow, id: 'med-1', side_effects: [], warnings: ['Warning 1'] },
        { ...baseRow, id: 'med-2', side_effects: ['Side effect'], warnings: null },
        { ...baseRow, id: 'med-3', side_effects: '["From JSON"]', warnings: [] },
      ];

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows,
      } as any);

      const medications = await repository.findByClientId(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(3);
      
      // First med: empty side_effects, populated warnings
      expect(medications[0]!.sideEffects).toEqual([]);
      expect(medications[0]!.warnings).toEqual(['Warning 1']);
      
      // Second med: populated side_effects, null warnings
      expect(medications[1]!.sideEffects).toEqual(['Side effect']);
      expect(medications[1]!.warnings).toBeUndefined();
      
      // Third med: JSON string side_effects, empty warnings
      expect(medications[2]!.sideEffects).toEqual(['From JSON']);
      expect(medications[2]!.warnings).toEqual([]);
    });
  });

  describe('findActiveWithStatus - jsonb array handling', () => {
    const baseRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      organization_id: '123e4567-e89b-12d3-a456-426614174001',
      client_id: '123e4567-e89b-12d3-a456-426614174002',
      medication_name: 'Aspirin',
      dosage: '81mg',
      route: 'ORAL',
      frequency: 'Daily',
      prescribed_by: 'Dr. Jones',
      prescribed_date: FIXED_DATE,
      start_date: FIXED_DATE,
      status: 'ACTIVE',
      created_at: FIXED_DATE,
      updated_at: FIXED_DATE,
      created_by: '123e4567-e89b-12d3-a456-426614174003',
      updated_by: '123e4567-e89b-12d3-a456-426614174003',
      version: 1,
      refills_remaining: 3,
      last_administered: null,
    };

    it('should handle jsonb arrays in active medications with status', async () => {
      const rowWithArrays = {
        ...baseRow,
        side_effects: ['Stomach upset'], // Already parsed by node-postgres
        warnings: ['Take with water'],   // Already parsed by node-postgres
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowWithArrays],
      } as any);

      const medications = await repository.findActiveWithStatus(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.sideEffects).toEqual(['Stomach upset']);
      expect(medications[0]!.warnings).toEqual(['Take with water']);
      expect(medications[0]!.needsRefill).toBe(false); // 3 refills > 2 threshold
    });

    it('should set needsRefill flag correctly with jsonb fields', async () => {
      const rowNeedingRefill = {
        ...baseRow,
        refills_remaining: 1, // Less than 2 = needs refill
        side_effects: [],
        warnings: ['Low on refills'],
      };

      vi.mocked(mockDatabase.query).mockResolvedValue({
        rows: [rowNeedingRefill],
      } as any);

      const medications = await repository.findActiveWithStatus(
        baseRow.client_id,
        mockUserContext
      );

      expect(medications).toHaveLength(1);
      expect(medications[0]!.needsRefill).toBe(true);
      expect(medications[0]!.warnings).toEqual(['Low on refills']);
    });
  });
});

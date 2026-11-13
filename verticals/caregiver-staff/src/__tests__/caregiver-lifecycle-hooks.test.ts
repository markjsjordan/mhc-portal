import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CaregiverService, CaregiverStatusHook } from '../service/caregiver-service.js';
import { CaregiverImportService } from '../service/caregiver-import-service.js';
import { CaregiverRepository } from '../repository/caregiver-repository.js';
import type { Database, UserContext } from '@folkcare/core';
import type { Caregiver } from '../types/caregiver.js';

describe('Caregiver Lifecycle Hooks', () => {
  let mockDb: Database;
  let mockContext: UserContext;
  let mockHook: CaregiverStatusHook;

  beforeEach(() => {
    mockDb = {
      query: vi.fn(),
    } as unknown as Database;

    mockContext = {
      userId: 'user-admin',
      organizationId: 'org-123',
      branchIds: ['branch-123'],
      roles: ['ORG_ADMIN'],
      permissions: ['caregivers:read', 'caregivers:update', 'caregivers:create'],
    };

    mockHook = {
      handleCaregiverStatusChange: vi.fn().mockResolvedValue(undefined),
    };
  });

  describe('CaregiverService.updateCaregiver status hook', () => {
    it('fires the hook when caregiver is TERMINATED', async () => {
      const service = new CaregiverService(mockDb, mockHook);
      const existing: Partial<Caregiver> = {
        id: 'cg-1',
        organizationId: 'org-123',
        employmentStatus: 'ACTIVE',
        status: 'ACTIVE',
      };

      vi.spyOn(CaregiverRepository.prototype, 'findById').mockResolvedValue(existing as Caregiver);
      vi.spyOn(CaregiverRepository.prototype, 'update').mockResolvedValue({
        ...existing,
        employmentStatus: 'TERMINATED',
      } as Caregiver);

      await service.updateCaregiver('cg-1', { employmentStatus: 'TERMINATED' }, mockContext);

      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledTimes(1);
      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledWith(
        'cg-1',
        'ACTIVE',
        'TERMINATED',
        mockContext
      );
    });

    it('passes ON_LEAVE value through to the hook', async () => {
      const service = new CaregiverService(mockDb, mockHook);
      const existing: Partial<Caregiver> = {
        id: 'cg-1',
        organizationId: 'org-123',
        employmentStatus: 'ACTIVE',
        status: 'ACTIVE',
      };

      vi.spyOn(CaregiverRepository.prototype, 'findById').mockResolvedValue(existing as Caregiver);
      vi.spyOn(CaregiverRepository.prototype, 'update').mockResolvedValue({
        ...existing,
        employmentStatus: 'ON_LEAVE',
      } as Caregiver);

      await service.updateCaregiver('cg-1', { employmentStatus: 'ON_LEAVE' }, mockContext);

      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledTimes(1);
      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledWith(
        'cg-1',
        'ACTIVE',
        'ON_LEAVE',
        mockContext
      );
    });

    it('does NOT fire the hook when status is unchanged', async () => {
      const service = new CaregiverService(mockDb, mockHook);
      const existing: Partial<Caregiver> = {
        id: 'cg-1',
        organizationId: 'org-123',
        employmentStatus: 'ACTIVE',
        status: 'ACTIVE',
      };

      vi.spyOn(CaregiverRepository.prototype, 'findById').mockResolvedValue(existing as Caregiver);
      vi.spyOn(CaregiverRepository.prototype, 'update').mockResolvedValue(existing as Caregiver);

      await service.updateCaregiver('cg-1', { firstName: 'Updated' }, mockContext);

      expect(mockHook.handleCaregiverStatusChange).not.toHaveBeenCalled();

      // Or if employmentStatus is explicitly the same
      await service.updateCaregiver('cg-1', { employmentStatus: 'ACTIVE' }, mockContext);
      expect(mockHook.handleCaregiverStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('CaregiverService.deleteCaregiver access revocation', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const deleteContext = {
      userId: 'user-admin',
      organizationId: 'org-123',
      branchIds: ['branch-123'],
      roles: ['ORG_ADMIN'],
      permissions: ['caregivers:read', 'caregivers:delete'],
    } as UserContext;

    it('revokes portal access BEFORE the soft delete', async () => {
      const service = new CaregiverService(mockDb, mockHook);
      const existing: Partial<Caregiver> = {
        id: 'cg-1',
        organizationId: 'org-123',
        employmentStatus: 'ACTIVE',
        status: 'ACTIVE',
      };

      vi.spyOn(CaregiverRepository.prototype, 'findById').mockResolvedValue(existing as Caregiver);
      const deleteSpy = vi.spyOn(CaregiverRepository.prototype, 'delete').mockResolvedValue(undefined);

      await service.deleteCaregiver('cg-1', deleteContext);

      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledWith(
        'cg-1',
        'ACTIVE',
        'TERMINATED',
        deleteContext
      );
      const revokeOrder = vi.mocked(mockHook.handleCaregiverStatusChange).mock.invocationCallOrder[0];
      const deleteOrder = deleteSpy.mock.invocationCallOrder[0];
      expect(revokeOrder).toBeDefined();
      expect(deleteOrder).toBeDefined();
      expect(revokeOrder!).toBeLessThan(deleteOrder!);
    });

    it('does not soft delete when the revoke fails', async () => {
      const service = new CaregiverService(mockDb, mockHook);
      vi.spyOn(CaregiverRepository.prototype, 'findById').mockResolvedValue({
        id: 'cg-1',
        organizationId: 'org-123',
        employmentStatus: 'ACTIVE',
      } as Caregiver);
      (mockHook.handleCaregiverStatusChange as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('revoke failed')
      );
      const deleteSpy = vi.spyOn(CaregiverRepository.prototype, 'delete').mockResolvedValue(undefined);

      await expect(service.deleteCaregiver('cg-1', deleteContext)).rejects.toThrow('revoke failed');
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe('CaregiverImportService status hook', () => {
    it('fires the hook when import updates employmentStatus of existing caregiver', async () => {
      const importService = new CaregiverImportService(mockDb, mockHook);
      const existingCaregiver: Partial<Caregiver> = {
        id: 'cg-import-1',
        organizationId: 'org-123',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: new Date('1985-05-15T00:00:00.000Z'),
        employmentStatus: 'ACTIVE',
      };

      vi.spyOn(CaregiverRepository.prototype, 'findByEmployeeNumber').mockResolvedValue(
        existingCaregiver as Caregiver
      );
      vi.spyOn(CaregiverRepository.prototype, 'update').mockResolvedValue({
        ...existingCaregiver,
        employmentStatus: 'TERMINATED',
      } as Caregiver);

      const csvRecord = {
        first_name: 'Jane',
        last_name: 'Doe',
        date_of_birth: '1985-05-15',
        primary_branch_id: '11111111-1111-4111-8111-111111111111',
        address_line1: '123 Main St',
        address_city: 'Austin',
        address_state: 'TX',
        address_postal_code: '78701',
        hire_date: '2022-01-01',
        employment_type: 'FULL_TIME',
        role: 'CAREGIVER',
        employee_number: 'EMP-99',
        employment_status: 'TERMINATED',
      };

      await importService.import(
        [csvRecord],
        {
          userId: mockContext.userId,
          organizationId: mockContext.organizationId ?? 'org-123',
          updateExisting: true,
        }
      );

      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledTimes(1);
      expect(mockHook.handleCaregiverStatusChange).toHaveBeenCalledWith(
        'cg-import-1',
        'ACTIVE',
        'TERMINATED',
        expect.objectContaining({
          userId: mockContext.userId,
          organizationId: mockContext.organizationId,
        })
      );
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CarePlanService } from '../care-plan-service';
import { CarePlanRepository } from '../../repository/care-plan-repository';
import { PermissionService } from '@folkcare/core';
import { ValidationError, PermissionError, NotFoundError } from '@folkcare/core';
import { CarePlan, CreateCarePlanGoalInput } from '../../types/care-plan';

describe('CarePlanService - createGoal', () => {
  let service: CarePlanService;
  let mockRepository: Partial<CarePlanRepository>;
  let mockPermissions: Partial<PermissionService>;
  let mockUserRepository: any;

  const mockContext = {
    userId: 'user-123',
    organizationId: 'org-123',
    branchIds: ['branch-123'],
    roles: [] as any[],
    permissions: [],
  };

  const mockCarePlan: CarePlan = {
    id: 'plan-123',
    planNumber: 'CP-001',
    name: 'Test Plan',
    clientId: 'client-123',
    organizationId: 'org-123',
    branchId: 'branch-123',
    planType: 'PERSONAL_CARE' as any,
    status: 'ACTIVE' as any,
    priority: 'MEDIUM' as any,
    effectiveDate: new Date(),
    goals: [],
    interventions: [],
    taskTemplates: [],
    complianceStatus: 'COMPLIANT' as any,
    createdAt: new Date(),
    createdBy: 'user-123',
    updatedAt: new Date(),
    updatedBy: 'user-123',
    version: 1,
    deletedAt: null,
    deletedBy: null,
  };

  beforeEach(() => {
    mockRepository = {
      getCarePlanById: vi.fn().mockResolvedValue(mockCarePlan),
      updateGoals: vi.fn().mockResolvedValue(undefined),
      getDatabase: vi.fn().mockReturnValue(null),
    };

    mockPermissions = {
      hasPermission: vi.fn().mockReturnValue(true),
    };

    mockUserRepository = {
      getUserById: vi.fn(),
    };

    service = new CarePlanService(
      mockRepository as any,
      mockPermissions as any,
      mockUserRepository
    );
  });

  it('should create a goal with valid input', async () => {
    const input: CreateCarePlanGoalInput = {
      title: 'Improve mobility',
      description: 'Patient should be able to walk 50 feet',
      category: 'MOBILITY',
      priority: 'HIGH',
    };

    const result = await service.createGoal('plan-123', input, mockContext);

    expect(result).toBeDefined();
    expect(result.title).toBe('Improve mobility');
    expect(result.carePlanId).toBe('plan-123');
    expect(result.status).toBe('NOT_STARTED');
    expect(mockRepository.updateGoals).toHaveBeenCalled();
  });

  it('should trim title whitespace', async () => {
    const input: CreateCarePlanGoalInput = {
      title: '  Improve mobility  ',
    };

    const result = await service.createGoal('plan-123', input, mockContext);
    expect(result.title).toBe('Improve mobility');
  });

  it('should reject empty title', async () => {
    const input: CreateCarePlanGoalInput = {
      title: '',
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(ValidationError);
  });

  it('should reject whitespace-only title', async () => {
    const input: CreateCarePlanGoalInput = {
      title: '   \t  ',
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(ValidationError);
  });

  it('should reject title exceeding 500 characters', async () => {
    const input: CreateCarePlanGoalInput = {
      title: 'a'.repeat(501),
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(ValidationError);
  });

  it('should reject if user lacks permission', async () => {
    (mockPermissions.hasPermission as any).mockReturnValue(false);

    const input: CreateCarePlanGoalInput = {
      title: 'Improve mobility',
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(PermissionError);
  });

  it('should reject if care plan not found', async () => {
    (mockRepository.getCarePlanById as any).mockResolvedValue(null);

    const input: CreateCarePlanGoalInput = {
      title: 'Improve mobility',
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(NotFoundError);
  });

  it('should reject if user organization differs from plan organization', async () => {
    const otherOrgPlan = { ...mockCarePlan, organizationId: 'org-999' };
    (mockRepository.getCarePlanById as any).mockResolvedValue(otherOrgPlan);

    const input: CreateCarePlanGoalInput = {
      title: 'Improve mobility',
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(PermissionError);
  });

  it('should reject if user branch not in plan branch', async () => {
    const otherBranchPlan = { ...mockCarePlan, branchId: 'branch-999' };
    (mockRepository.getCarePlanById as any).mockResolvedValue(otherBranchPlan);

    const input: CreateCarePlanGoalInput = {
      title: 'Improve mobility',
    };

    await expect(
      service.createGoal('plan-123', input, mockContext)
    ).rejects.toThrow(PermissionError);
  });
});

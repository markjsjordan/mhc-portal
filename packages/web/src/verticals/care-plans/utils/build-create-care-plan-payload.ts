import type { CreateCarePlanInput, CarePlanGoal, GoalCategory, GoalStatus, Priority } from '../types';

/**
 * Raw (form-level) shape of a care plan before it is sent to POST /api/care-plans.
 * Optional text fields may be empty strings because HTML inputs never yield `undefined`.
 */
export interface CarePlanFormValues {
  clientId: string;
  organizationId: string;
  branchId?: string;
  name: string;
  planType: CreateCarePlanInput['planType'];
  effectiveDate: string;
  expirationDate?: string;
  coordinatorId?: string;
  notes?: string;
  goals?: Array<{
    name: string;
    description?: string;
    category?: string;
    targetDate?: string;
    status?: string;
    priority?: string;
  }>;
}

const blankToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return (trimmed?.length ?? 0) > 0 ? trimmed : undefined;
};

/**
 * Build a payload that satisfies the backend CreateCarePlanInputSchema.
 *
 * The backend rejects (400) empty strings for UUID fields (branchId, coordinatorId),
 * dates (expirationDate, goal targetDate) and enum fields (goal category/status/priority),
 * and requires a non-empty goal description. Blank optional values are therefore omitted
 * and goal enums/description fall back to safe defaults.
 */
export function buildCreateCarePlanPayload(values: CarePlanFormValues): CreateCarePlanInput {
  const goals = (values.goals ?? []).map((g) => {
    const name = g.name.trim();
    return {
      name,
      description: blankToUndefined(g.description) ?? name,
      category: (blankToUndefined(g.category) ?? 'OTHER') as GoalCategory,
      targetDate: blankToUndefined(g.targetDate),
      status: (blankToUndefined(g.status) ?? 'NOT_STARTED') as GoalStatus,
      priority: (blankToUndefined(g.priority) ?? 'MEDIUM') as Priority,
    };
  }) as Array<Omit<CarePlanGoal, 'id'>>;

  return {
    clientId: values.clientId,
    organizationId: values.organizationId,
    branchId: blankToUndefined(values.branchId),
    name: values.name.trim(),
    planType: values.planType,
    effectiveDate: values.effectiveDate,
    expirationDate: blankToUndefined(values.expirationDate),
    coordinatorId: blankToUndefined(values.coordinatorId),
    notes: blankToUndefined(values.notes),
    goals,
    interventions: [],
  };
}

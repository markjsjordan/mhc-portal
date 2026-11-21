/**
 * E2E API Data Factories
 *
 * Every factory creates its own isolated test data through the authenticated
 * REST API using the persona storageState minted by e2e/setup/auth.setup.ts.
 *
 * Contract:
 * - Factories use unique names/identifiers so parallel workers (fullyParallel: true)
 *   never collide.
 * - If any factory API call fails, it throws immediately with the HTTP status
 *   and response body in the error message — tests NEVER silently skip.
 */

import { randomUUID } from 'node:crypto';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { getPersonaUser } from './auth.fixture.js';
import { E2E_UUIDS, type E2EPersonaKey } from './test-data.js';

export interface CreatedInvoice {
  id: string;
  invoiceNumber?: string;
  status: string;
  payerId: string;
  payerType: string;
  payerName: string;
}

export interface CreatedCarePlan {
  id: string;
  clientId: string;
  name: string;
  status: string;
}

export interface CreatedTask {
  id: string;
  carePlanId: string;
  clientId: string;
  assignedCaregiverId: string;
  name: string;
}

export interface CreatedClient {
  id: string;
  firstName: string;
  lastName: string;
}

export interface CreatedCaregiver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CreatedVisit {
  id: string;
  clientId: string;
  branchId: string;
  assignedCaregiverId: string | null;
  scheduledDate: string;
}

export interface CreatedPayPeriod {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  payDate: string;
}

export interface CreatedTimeSheet {
  id: string;
  payPeriodId: string;
  caregiverId: string;
  status: string;
}

export interface CreatedPayRun {
  id: string;
  payPeriodId: string;
  status: string;
}

function uniqueSuffix(): string {
  return `${Date.now()}-${randomUUID().slice(0, 8)}`;
}

/**
 * Build authenticated request headers for a seeded E2E persona.
 * Throws loudly if the persona has no token in its storageState.
 */
export function getAuthedHeaders(persona: E2EPersonaKey = 'admin'): Record<string, string> {
  const user = getPersonaUser(persona);
  if (!user.token) {
    throw new Error(
      `E2E factory auth error: persona "${persona}" has no JWT token in storageState. ` +
        `Ensure the "setup" project (e2e/setup/auth.setup.ts) ran and succeeded.`
    );
  }
  return {
    Authorization: `Bearer ${user.token}`,
    'Content-Type': 'application/json',
    'X-Organization-Id': user.organizationId,
    'X-Branch-Id': user.branchId,
    'X-User-Id': user.userId,
  };
}

/**
 * Assert an API response succeeded, or throw a loud error containing the
 * factory label, HTTP status, and response body.
 */
export async function assertFactoryResponse(
  label: string,
  res: APIResponse,
  expectedStatuses: number[] = [200, 201]
): Promise<unknown> {
  const text = await res.text().catch(() => '<unreadable body>');
  if (!expectedStatuses.includes(res.status())) {
    throw new Error(
      `E2E factory "${label}" failed with HTTP ${res.status()} (expected ${expectedStatuses.join('/')}). Body: ${text}`
    );
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Create a DRAFT invoice via POST /api/billing/invoices.
 */
export async function createInvoice(
  request: APIRequestContext,
  overrides: Partial<{
    payerId: string;
    payerType: string;
    payerName: string;
    invoiceDate: string;
    dueDate: string;
    periodStart: string;
    periodEnd: string;
    billableItemIds: string[];
  }> = {}
): Promise<CreatedInvoice> {
  const today = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const suffix = uniqueSuffix();

  const payload = {
    payerId: overrides.payerId ?? E2E_UUIDS.CLIENT_001,
    payerType: overrides.payerType ?? 'PRIVATE_PAY',
    payerName: overrides.payerName ?? `E2E Payer ${suffix}`,
    invoiceDate: overrides.invoiceDate ?? today,
    dueDate: overrides.dueDate ?? dueDate,
    periodStart: overrides.periodStart ?? today,
    periodEnd: overrides.periodEnd ?? today,
    billableItemIds: overrides.billableItemIds ?? [],
  };

  const res = await request.post('/api/billing/invoices', {
    headers: getAuthedHeaders('admin'),
    data: payload,
  });
  const body = (await assertFactoryResponse('createInvoice', res, [201])) as Record<string, unknown>;
  const invoice = (body?.['data'] ?? body) as CreatedInvoice;
  if (!invoice?.id) {
    throw new Error(`E2E factory "createInvoice" returned no invoice id. Body: ${JSON.stringify(body)}`);
  }
  return invoice;
}

/**
 * Transition a DRAFT invoice to SENT via POST /api/billing/invoices/:id/send.
 */
export async function sendInvoice(request: APIRequestContext, invoiceId: string): Promise<void> {
  const res = await request.post(`/api/billing/invoices/${invoiceId}/send`, {
    headers: getAuthedHeaders('admin'),
    data: {},
  });
  await assertFactoryResponse('sendInvoice', res, [200]);
}

/**
 * Create a client via POST /api/clients.
 */
export async function createClient(
  request: APIRequestContext,
  overrides: Partial<{
    firstName: string;
    lastName: string;
    dateOfBirth: string;
  }> = {}
): Promise<CreatedClient> {
  const suffix = uniqueSuffix();
  const payload = {
    branchId: E2E_UUIDS.BRANCH_E2E,
    firstName: overrides.firstName ?? 'E2EClient',
    lastName: overrides.lastName ?? `Test-${suffix}`,
    dateOfBirth: overrides.dateOfBirth ?? '1955-04-12',
    primaryAddress: {
      street: '100 Factory Ln',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
      country: 'USA',
    },
    primaryPhone: '512-555-0199',
  };

  const res = await request.post('/api/clients', {
    headers: getAuthedHeaders('admin'),
    data: payload,
  });
  const body = (await assertFactoryResponse('createClient', res, [201])) as Record<string, unknown>;
  const client = (body?.['data'] ?? body) as CreatedClient;
  if (!client?.id) {
    throw new Error(`E2E factory "createClient" returned no client id. Body: ${JSON.stringify(body)}`);
  }
  return client;
}

/**
 * Create a care plan via POST /api/care-plans.
 */
export async function createCarePlan(
  request: APIRequestContext,
  overrides: Partial<{
    clientId: string;
    name: string;
    description: string;
    startDate: string;
  }> = {}
): Promise<CreatedCarePlan> {
  const suffix = uniqueSuffix();
  const today = new Date().toISOString().slice(0, 10);
  const headers = getAuthedHeaders('admin');

  const templatesRes = await request.get('/api/care-plans/templates', { headers });
  const templatesBody = (await assertFactoryResponse('listCarePlanTemplates', templatesRes, [200])) as
    | Array<{ id: string }>
    | { templates?: Array<{ id: string }>; items?: Array<{ id: string }>; data?: Array<{ id: string }> };
  const templates = Array.isArray(templatesBody)
    ? templatesBody
    : (templatesBody?.templates ?? templatesBody?.items ?? templatesBody?.data ?? []);
  const templateId = templates[0]?.id;
  if (!templateId) {
    throw new Error(
      `E2E factory "createCarePlan" found no care plan templates. Body: ${JSON.stringify(templatesBody)}`
    );
  }

  const payload = {
    templateId,
    clientId: overrides.clientId ?? E2E_UUIDS.CLIENT_001,
    branchId: E2E_UUIDS.BRANCH_E2E,
    name: overrides.name ?? `E2E Care Plan ${suffix}`,
    notes: overrides.description ?? 'Created by E2E factory',
    startDate: overrides.startDate ?? today,
  };

  const res = await request.post('/api/care-plans/from-template', {
    headers,
    data: payload,
  });
  const body = (await assertFactoryResponse('createCarePlan', res, [201])) as Record<string, unknown>;
  const carePlan = (body?.['data'] ?? body) as CreatedCarePlan;
  if (!carePlan?.id) {
    throw new Error(`E2E factory "createCarePlan" returned no carePlan id. Body: ${JSON.stringify(body)}`);
  }
  return carePlan;
}

/**
 * Create a task via POST /api/tasks.
 */
export async function createTask(
  request: APIRequestContext,
  overrides: Partial<{
    carePlanId: string;
    clientId: string;
    assignedCaregiverId: string;
    name: string;
    description: string;
    category: string;
    instructions: string;
    scheduledDate: string;
    requiredSignature: boolean;
    requiredNote: boolean;
  }> & { carePlanId: string; clientId: string; assignedCaregiverId: string }
): Promise<CreatedTask> {
  const suffix = uniqueSuffix();
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    carePlanId: overrides.carePlanId,
    clientId: overrides.clientId,
    assignedCaregiverId: overrides.assignedCaregiverId,
    name: overrides.name ?? `E2E Task ${suffix}`,
    description: overrides.description ?? 'E2E factory task',
    category: overrides.category ?? 'OTHER',
    instructions: overrides.instructions ?? 'Complete task for E2E verification',
    scheduledDate: overrides.scheduledDate ?? today,
    requiredSignature: overrides.requiredSignature ?? false,
    requiredNote: overrides.requiredNote ?? false,
  };

  const res = await request.post('/api/tasks', {
    headers: getAuthedHeaders('admin'),
    data: payload,
  });
  const body = (await assertFactoryResponse('createTask', res, [201])) as Record<string, unknown>;
  const task = (body?.['data'] ?? body) as CreatedTask;
  if (!task?.id) {
    throw new Error(`E2E factory "createTask" returned no task id. Body: ${JSON.stringify(body)}`);
  }
  return task;
}

/**
 * Create an unassigned visit via POST /api/visits.
 */
export async function createUnassignedVisit(
  request: APIRequestContext,
  overrides: Partial<{
    clientId: string;
    serviceTypeId: string;
    serviceTypeName: string;
    scheduledDate: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
  }> = {}
): Promise<CreatedVisit> {
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    clientId: overrides.clientId ?? E2E_UUIDS.CLIENT_001,
    serviceTypeId: overrides.serviceTypeId ?? 'personal-care',
    serviceTypeName: overrides.serviceTypeName ?? 'Personal Care',
    scheduledDate: overrides.scheduledDate ?? today,
    scheduledStartTime: overrides.scheduledStartTime ?? '09:00',
    scheduledEndTime: overrides.scheduledEndTime ?? '11:00',
    notes: `E2E unassigned visit ${uniqueSuffix()}`,
  };

  const res = await request.post('/api/visits', {
    headers: getAuthedHeaders('admin'),
    data: payload,
  });
  const body = (await assertFactoryResponse('createUnassignedVisit', res, [201])) as Record<string, unknown>;
  const visit = (body?.['data'] ?? body) as CreatedVisit;
  if (!visit?.id) {
    throw new Error(`E2E factory "createUnassignedVisit" returned no visit id. Body: ${JSON.stringify(body)}`);
  }
  return visit;
}

/**
 * Create and open a payroll pay period via POST /api/payroll/periods + /open.
 */
export async function createOpenPayPeriod(
  request: APIRequestContext,
  overrides: Partial<{
    startDate: string;
    endDate: string;
    payDate: string;
    frequency: string;
  }> = {}
): Promise<CreatedPayPeriod> {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const payDate = new Date(end);
  payDate.setDate(payDate.getDate() + 5);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const payload = {
    startDate: overrides.startDate ?? fmt(start),
    endDate: overrides.endDate ?? fmt(end),
    payDate: overrides.payDate ?? fmt(payDate),
    periodType: overrides.frequency ?? 'BI_WEEKLY',
  };

  const res = await request.post('/api/payroll/periods', {
    headers: getAuthedHeaders('admin'),
    data: payload,
  });
  const body = (await assertFactoryResponse('createPayPeriod', res, [201])) as Record<string, unknown>;
  const period = (body?.['data'] ?? body) as CreatedPayPeriod;
  if (!period?.id) {
    throw new Error(`E2E factory "createPayPeriod" returned no period id. Body: ${JSON.stringify(body)}`);
  }

  const openRes = await request.post(`/api/payroll/periods/${period.id}/open`, {
    headers: getAuthedHeaders('admin'),
    data: {},
  });
  await assertFactoryResponse('openPayPeriod', openRes, [200]);

  return { ...period, status: 'OPEN' };
}

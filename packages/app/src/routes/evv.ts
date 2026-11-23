/**
 * EVV (Electronic Visit Verification) Routes
 *
 * RESTful API endpoints for EVV clock-in/out and record management.
 *
 * Real clock-in/clock-out persistence is backed by EVVService/EVVHandlers,
 * including geofence validation against the visit's service address and
 * state-specific compliance checks (StateComplianceService). Record search
 * and retrieval use the same real SQL-backed EVVRepository.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Database, AuthMiddleware } from '@folkcare/core';
import {
  EVVRepository,
  EVVService,
  EVVHandlers,
  IntegrationService,
  createClientProvider,
  createCaregiverProvider,
  EVVAggregatorService,
  AggregatorHandlers,
  AggregatorSubmissionRepository,
  AggregatorConfigRepository,
  loadOrgLocationPolicy,
} from '@folkcare/time-tracking-evv';
import { createVisitProvider } from '@folkcare/scheduling-visits';

export function createEVVRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  const evvRepository = new EVVRepository(db);
  const pool = db.getPool();
  const integrationService = new IntegrationService(db);
  const visitProvider = createVisitProvider(pool, db);
  const clientProvider = createClientProvider(db);
  const caregiverProvider = createCaregiverProvider(db);
  const evvService = new EVVService(
    evvRepository,
    integrationService,
    visitProvider,
    clientProvider,
    caregiverProvider,
    db
  );
  const evvHandlers = new EVVHandlers(evvService);

  // Aggregator submission tracking (FC-AUDIT-EVV WU-4)
  const aggregatorSubmissionRepository = new AggregatorSubmissionRepository(db);
  const aggregatorConfigRepository = new AggregatorConfigRepository();
  const evvAggregatorService = new EVVAggregatorService(
    aggregatorConfigRepository,
    aggregatorSubmissionRepository
  );
  const aggregatorHandlers = new AggregatorHandlers(evvAggregatorService, aggregatorSubmissionRepository);

  // All EVV routes require authentication
  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req, res, next) => authMiddleware.auditImpersonatedActions(req, res, next));
  }

  const buildEVVSearchFilters = (req: Request, organizationId: string): Record<string, unknown> => {
    const filters: Record<string, unknown> = { organizationId };
    if (typeof req.query.branchId === 'string' && req.query.branchId !== '') {
      filters.branchId = req.query.branchId;
    }
    if (typeof req.query.caregiverId === 'string' && req.query.caregiverId !== '') {
      filters.caregiverId = req.query.caregiverId;
    }
    if (typeof req.query.clientId === 'string' && req.query.clientId !== '') {
      filters.clientId = req.query.clientId;
    }
    if (typeof req.query.status === 'string' && req.query.status !== '') {
      filters.status = [req.query.status];
    }
    return filters;
  };

  /**
   * GET /api/evv
   * Search EVV records with filters
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user?.organizationId;
      if (orgId === undefined) {
        res.status(400).json({ error: 'Organization ID required' });
        return;
      }

      const queryOrgId = typeof req.query.organizationId === 'string' && req.query.organizationId !== '' ? req.query.organizationId : undefined;
      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') ?? false;
      if (queryOrgId !== undefined && !isSuperAdmin && queryOrgId !== orgId) {
        res.status(403).json({ error: 'Cross-tenant access denied' });
        return;
      }

      const filters = buildEVVSearchFilters(req, isSuperAdmin && queryOrgId !== undefined ? queryOrgId : orgId);

      const pagination = {
        page: parseInt((typeof req.query.page === 'string' && req.query.page !== '') ? req.query.page : '1', 10),
        limit: parseInt((typeof req.query.limit === 'string' && req.query.limit !== '') ? req.query.limit : '25', 10),
      };

      const records = await evvRepository.searchEVVRecords(filters, pagination);
      
      res.json({
        items: records.items,
        total: records.total,
        page: pagination.page,
        limit: pagination.limit,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/evv/location-policy
   * Retrieve location policy for caller's organization
   */
  router.get('/location-policy', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user?.organizationId;
      if (orgId === undefined || orgId === '') {
        res.status(400).json({ error: 'Organization ID required' });
        return;
      }
      const policy = await loadOrgLocationPolicy(db, orgId);
      res.json(policy);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/evv/:id
   * Get EVV record by ID
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;
      if (id === undefined || id === '') {
        res.status(400).json({ error: 'ID required' });
        return;
      }

      const record = await evvRepository.getEVVRecordById(id);
      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN') ?? false;
      const userOrgId = req.user?.organizationId;

      if (
        record === null ||
        (!isSuperAdmin &&
          userOrgId !== undefined &&
          Boolean(record.organizationId) &&
          record.organizationId !== userOrgId)
      ) {
        res.status(404).json({ error: 'EVV record not found' });
        return;
      }
      
      res.json(record);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/evv/clock-in
   * Clock in to start a visit with EVV geofence/compliance verification
   */
  router.post('/clock-in', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: req.body, params: req.params, query: req.query as Record<string, string>, user: req.user! };
      const result = await evvHandlers.clockIn(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : result.data);
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/evv/:id/clock-out
   * Clock out to end a visit with EVV geofence/compliance verification
   */
  router.post('/:id/clock-out', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: { ...req.body, evvRecordId: req.params.id }, params: req.params, query: req.query as Record<string, string>, user: req.user! };
      const result = await evvHandlers.clockOut(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : result.data);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/evv/aggregator/submissions/stats
   * Aggregator submission statistics (FC-AUDIT-EVV WU-4)
   */
  router.get('/aggregator/submissions/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: req.body, params: req.params, query: req.query as Record<string, string>, user: req.user! };
      const result = await aggregatorHandlers.getSubmissionStats(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : { data: result.data });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/evv/aggregator/submissions/pending
   * All pending aggregator submissions needing retry
   */
  router.get('/aggregator/submissions/pending', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: req.body, params: req.params, query: req.query as Record<string, string>, user: req.user! };
      const result = await aggregatorHandlers.getPendingSubmissions(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : { data: result.data });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/evv/aggregator/submissions/retry-all
   * Trigger retry for all pending aggregator submissions
   */
  router.post('/aggregator/submissions/retry-all', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: req.body, params: req.params, query: req.query as Record<string, string>, user: req.user! };
      const result = await aggregatorHandlers.retryAllPending(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : { data: result.data });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/evv/aggregator/submissions/:id/retry
   * Manually retry one failed aggregator submission
   */
  router.post('/aggregator/submissions/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: req.body, params: { submissionId: req.params.id!, ...req.params }, query: req.query as Record<string, string>, user: req.user! };
      const result = await aggregatorHandlers.retrySubmission(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : { data: result.data });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/evv/aggregator/submissions/:evvRecordId
   * Submission history for a specific EVV record
   */
  router.get('/aggregator/submissions/:evvRecordId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const apiReq = { body: req.body, params: req.params, query: req.query as Record<string, string>, user: req.user! };
      const result = await aggregatorHandlers.getSubmissionsByRecord(apiReq);
      res.status(result.status).json(result.error !== undefined ? { error: result.error } : { data: result.data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function pickNonEmptyString(body: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = body[key];
    if (typeof val === 'string' && val.trim() !== '') {
      return val.trim();
    }
  }
  return undefined;
}

async function fetchVisitDataSafe(visitProvider: unknown, visitId: string | undefined): Promise<unknown> {
  if (visitId === undefined) {
    return null;
  }
  const provider = visitProvider as { getVisit?: (id: string) => Promise<unknown> };
  if (typeof provider.getVisit !== 'function') {
    return null;
  }
  try {
    return await provider.getVisit(visitId);
  } catch {
    return null;
  }
}

/**
 * EVV Visits Router (/api/evv-visits)
 *
 * Mobile-first EVV endpoints (wdvf3adf63):
 * - POST /api/evv-visits                — Clock in with snake_case/camelCase EVV payload, returning visit data
 * - PATCH /api/evv-visits/:id/clock-out — Clock out with timestamp, returning updated EVV & visit data
 */
export function createEVVVisitsRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);
  const evvRepository = new EVVRepository(db);
  const pool = db.getPool();
  const integrationService = new IntegrationService(db);
  const visitProvider = createVisitProvider(pool, db);
  const clientProvider = createClientProvider(db);
  const caregiverProvider = createCaregiverProvider(db);
  const evvService = new EVVService(
    evvRepository,
    integrationService,
    visitProvider,
    clientProvider,
    caregiverProvider,
    db
  );
  const evvHandlers = new EVVHandlers(evvService);

  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req, res, next) => authMiddleware.auditImpersonatedActions(req, res, next));
  }

  /**
   * POST /api/evv-visits
   * Clock in to a visit with EVV payload (visit_id, caregiver_id, clock_in_time, clock_out_time)
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const visitId = pickNonEmptyString(body, 'visit_id', 'visitId');

      if (visitId === undefined) {
        res.status(400).json({ error: 'visit_id is required' });
        return;
      }

      const caregiverId = pickNonEmptyString(body, 'caregiver_id', 'caregiverId') ?? req.user?.userId ?? '';
      const clockInTime =
        pickNonEmptyString(body, 'clock_in_time', 'clockInTime', 'timestamp') ?? new Date().toISOString();
      const clockOutTime = pickNonEmptyString(body, 'clock_out_time', 'clockOutTime') ?? null;

      const apiReq = {
        body: { ...body, visitId, caregiverId, timestamp: clockInTime } as unknown as Parameters<
          typeof evvHandlers.clockIn
        >[0]['body'],
        params: req.params,
        query: req.query as Record<string, string>,
        user: req.user!,
      };
      const result = await evvHandlers.clockIn(apiReq);

      if (result.error !== undefined) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      const visitData = await fetchVisitDataSafe(visitProvider, visitId);
      const evvData = (result.data && typeof result.data === 'object' ? result.data : {}) as Record<string, unknown>;
      res.status(result.status).json({
        ...evvData,
        visit_id: visitId,
        caregiver_id: caregiverId,
        clock_in_time: clockInTime,
        clock_out_time: clockOutTime,
        visit: visitData,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PATCH /api/evv-visits/:id/clock-out
   * Clock out of an EVV visit, returning updated EVV & visit data
   */
  router.patch('/:id/clock-out', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const evvRecordId = req.params.id;
      if (evvRecordId === undefined || evvRecordId.trim() === '') {
        res.status(400).json({ error: 'EVV visit ID is required' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const visitId = pickNonEmptyString(body, 'visit_id', 'visitId');
      const caregiverId = pickNonEmptyString(body, 'caregiver_id', 'caregiverId') ?? req.user?.userId ?? '';
      const clockOutTime =
        pickNonEmptyString(body, 'clock_out_time', 'clockOutTime', 'timestamp') ?? new Date().toISOString();

      const apiReq = {
        body: { ...body, evvRecordId, visitId, caregiverId, timestamp: clockOutTime } as unknown as Parameters<
          typeof evvHandlers.clockOut
        >[0]['body'],
        params: req.params,
        query: req.query as Record<string, string>,
        user: req.user!,
      };
      const result = await evvHandlers.clockOut(apiReq);

      if (result.error !== undefined) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      const evvData = (result.data && typeof result.data === 'object' ? result.data : {}) as Record<string, unknown>;
      const resolvedVisitId = visitId ?? pickNonEmptyString(evvData, 'visitId', 'visit_id');
      const visitData = await fetchVisitDataSafe(visitProvider, resolvedVisitId);

      res.status(result.status).json({
        ...evvData,
        visit_id: resolvedVisitId ?? null,
        caregiver_id: caregiverId,
        clock_in_time: evvData.clockInTime ?? evvData.clock_in_time ?? null,
        clock_out_time: clockOutTime,
        visit: visitData,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

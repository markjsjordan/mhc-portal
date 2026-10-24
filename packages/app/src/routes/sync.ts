/**
 * Sync API Routes
 *
 * Provides offline sync capabilities for mobile devices
 */

import { Router, type Request, type Response } from 'express';
import { Database, AuthMiddleware } from '@folkcare/core';
import { syncLimiter } from '../middleware/rate-limit.js';

/**
 * Mutation from client for sync/push
 */
interface SyncMutation {
  clientMutationId: string; // Client-generated UUID for idempotency
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  capturedAt: string; // ISO timestamp from device
  capturedOffline?: boolean;
  gps?: {
    latitude: number;
    longitude: number;
    accuracy: number; // meters
  };
}

/**
 * Result for a single mutation
 */
interface SyncMutationResult {
  success: boolean;
  clientMutationId: string;
  entityType: string;
  entityId: string;
  conflict?: {
    reason: string;
    serverVersion?: Record<string, unknown>;
  };
  error?: string;
}

export function createSyncRouter(db: Database): Router {
  const router = Router();
  const authMiddleware = new AuthMiddleware(db);

  // Apply rate limiting to all sync endpoints
  router.use(syncLimiter);

  // All sync routes require authentication
  router.use(authMiddleware.requireAuth);
  if (authMiddleware.auditImpersonatedActions) {
    router.use((req, res, next) => authMiddleware.auditImpersonatedActions(req, res, next));
  }

  router.get('/sync/changes', async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      
      const userId = req.user.userId;
      const { lastPulledAt } = req.query;

      if (typeof lastPulledAt !== 'string') {
        res.status(400).json({ success: false, error: 'lastPulledAt timestamp required' });
        return;
      }

      const timestamp = new Date(parseInt(lastPulledAt, 10));

      const [visits, tasks, clients] = await Promise.all([
        db.query(
          `SELECT * FROM visits WHERE caregiver_id = $1 AND updated_at > $2 ORDER BY updated_at`,
          [userId, timestamp]
        ),
        db.query(
          `SELECT t.* FROM tasks t
           INNER JOIN visits v ON t.visit_id = v.id
           WHERE v.caregiver_id = $1 AND t.updated_at > $2
           ORDER BY t.updated_at`,
          [userId, timestamp]
        ),
        db.query(
          `SELECT DISTINCT c.* FROM clients c
           INNER JOIN visits v ON c.id = v.client_id
           WHERE v.caregiver_id = $1 AND c.updated_at > $2
           ORDER BY c.updated_at`,
          [userId, timestamp]
        ),
      ]);

      res.json({
        success: true,
        data: {
          changes: { visits: visits.rows, tasks: tasks.rows, clients: clients.rows },
          timestamp: Date.now(),
          hasMore: false,
        },
      });
    } catch (error) {
      console.error('Error fetching sync changes:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sync changes' });
    }
  });

  router.post('/sync/push', async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      
      const userId = req.user.userId;
      const organizationId = req.user.organizationId;
      const { mutations, deviceId } = req.body;

      if (mutations === undefined || mutations === null || !Array.isArray(mutations)) {
        res.status(400).json({ success: false, error: 'mutations array required' });
        return;
      }

      if (!deviceId || typeof deviceId !== 'string') {
        res.status(400).json({ success: false, error: 'deviceId required' });
        return;
      }

      const results: SyncMutationResult[] = [];

      await db.query('BEGIN');
      try {
        for (const mutation of mutations as SyncMutation[]) {
          const { 
            clientMutationId, 
            entityType, 
            entityId, 
            operation, 
            data, 
            capturedAt,
            capturedOffline,
            gps 
          } = mutation;

          // Validate required fields
          if (!clientMutationId || !entityType || !entityId || !operation || !capturedAt) {
            results.push({
              success: false,
              clientMutationId: clientMutationId ?? 'unknown',
              entityType: entityType ?? 'unknown',
              entityId: entityId ?? 'unknown',
              error: 'Missing required fields: clientMutationId, entityType, entityId, operation, capturedAt',
            });
            continue;
          }

          try {
            // Check for existing sync_metadata entry with this clientMutationId (idempotency)
            const existingSync = await db.query(
              `SELECT id, sync_status, conflict_data, sync_error 
               FROM sync_metadata 
               WHERE change_hash = $1 AND user_id = $2`,
              [clientMutationId, userId]
            );

            // If already processed, return the original result
            if (existingSync.rows.length > 0) {
              const existing = existingSync.rows[0];
              
              if (!existing) {
                throw new Error('Unexpected: existingSync row is undefined');
              }
              
              if (existing.sync_status === 'CONFLICT') {
                results.push({
                  success: false,
                  clientMutationId,
                  entityType,
                  entityId,
                  conflict: (existing.conflict_data ?? {}) as { reason: string; serverVersion?: Record<string, unknown> },
                });
              } else if (existing.sync_status === 'ERROR') {
                results.push({
                  success: false,
                  clientMutationId,
                  entityType,
                  entityId,
                  error: (existing.sync_error ?? 'Unknown error') as string,
                });
              } else {
                // SYNCED or PENDING
                results.push({
                  success: true,
                  clientMutationId,
                  entityType,
                  entityId,
                });
              }
              continue;
            }

            // Parse capture timestamp
            const captureTimestamp = new Date(capturedAt);
            
            // Validate GPS if provided
            if (gps) {
              if (
                typeof gps.latitude !== 'number' || 
                typeof gps.longitude !== 'number' || 
                typeof gps.accuracy !== 'number'
              ) {
                throw new Error('Invalid GPS data: latitude, longitude, and accuracy must be numbers');
              }
              if (gps.latitude < -90 || gps.latitude > 90) {
                throw new Error('Invalid GPS latitude: must be between -90 and 90');
              }
              if (gps.longitude < -180 || gps.longitude > 180) {
                throw new Error('Invalid GPS longitude: must be between -180 and 180');
              }
              if (gps.accuracy < 0) {
                throw new Error('Invalid GPS accuracy: must be non-negative');
              }
            }

            // Insert sync_metadata record
            await db.query(
              `INSERT INTO sync_metadata (
                id, device_id, user_id, organization_id, entity_type, entity_id, operation,
                client_timestamp, change_data, change_hash, sync_status, created_by, updated_by
              )
              VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, 'PENDING', $2, $2
              )`,
              [
                deviceId, 
                userId, 
                organizationId, 
                entityType, 
                entityId, 
                operation, 
                captureTimestamp,
                JSON.stringify({
                  ...data,
                  _capturedOffline: capturedOffline ?? false,
                  _gps: gps ?? null,
                }),
                clientMutationId,
              ]
            );

            // Process the mutation based on entity type
            if (operation === 'UPDATE' && entityType === 'TASK') {
              // Check for conflicts (simplified - in production, use version numbers)
              const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [entityId]);
              
              if (existing.rows.length === 0) {
                // Entity doesn't exist - conflict
                await db.query(
                  `UPDATE sync_metadata 
                   SET sync_status = 'CONFLICT', 
                       conflict_data = $2::jsonb,
                       updated_at = NOW()
                   WHERE change_hash = $1`,
                  [
                    clientMutationId,
                    JSON.stringify({ reason: 'ENTITY_NOT_FOUND', entityType, entityId }),
                  ]
                );

                results.push({
                  success: false,
                  clientMutationId,
                  entityType,
                  entityId,
                  conflict: {
                    reason: 'ENTITY_NOT_FOUND',
                  },
                });
                continue;
              }

              // Update task
              await db.query(
                `UPDATE tasks 
                 SET completed = $2, completed_at = $3, notes = $4, updated_at = NOW(), updated_by = $5
                 WHERE id = $1`,
                [entityId, data.completed, data.completedAt, data.notes, userId]
              );

              // Mark as synced
              await db.query(
                `UPDATE sync_metadata 
                 SET sync_status = 'SYNCED', updated_at = NOW()
                 WHERE change_hash = $1`,
                [clientMutationId]
              );

              results.push({ success: true, clientMutationId, entityType, entityId });
            } else if (operation === 'UPDATE' && entityType === 'VISIT') {
              // For visits, we need to preserve the device capture timestamp for EVV
              const existing = await db.query('SELECT * FROM visits WHERE id = $1', [entityId]);
              
              if (existing.rows.length === 0) {
                await db.query(
                  `UPDATE sync_metadata 
                   SET sync_status = 'CONFLICT', 
                       conflict_data = $2::jsonb,
                       updated_at = NOW()
                   WHERE change_hash = $1`,
                  [
                    clientMutationId,
                    JSON.stringify({ reason: 'ENTITY_NOT_FOUND', entityType, entityId }),
                  ]
                );

                results.push({
                  success: false,
                  clientMutationId,
                  entityType,
                  entityId,
                  conflict: {
                    reason: 'ENTITY_NOT_FOUND',
                  },
                });
                continue;
              }

              // Validate geofence if GPS provided (use capture timestamp for validation)
              if (gps && data.status === 'IN_PROGRESS') {
                // This is where we would validate against state-specific geofence rules
                // For now, just store the GPS data with the EVV event
                // TODO: Implement geofence validation using evv_state_validation_rules
              }

              // Update visit - use captureTimestamp for actual_start/actual_end
              const updateFields: string[] = [];
              const updateValues: unknown[] = [entityId];
              let paramIndex = 2;

              if (data.status !== undefined) {
                updateFields.push(`status = $${paramIndex++}`);
                updateValues.push(data.status);
              }
              if (data.actualStart !== undefined) {
                // Use device capture timestamp instead of server timestamp
                updateFields.push(`actual_start_time = $${paramIndex++}`);
                updateValues.push(captureTimestamp);
              }
              if (data.actualEnd !== undefined) {
                updateFields.push(`actual_end_time = $${paramIndex++}`);
                updateValues.push(captureTimestamp);
              }
              if (data.notes !== undefined) {
                updateFields.push(`notes = $${paramIndex++}`);
                updateValues.push(data.notes);
              }
              
              updateFields.push(`updated_at = NOW()`);
              updateFields.push(`updated_by = $${paramIndex++}`);
              updateValues.push(userId);

              if (updateFields.length > 0) {
                await db.query(
                  `UPDATE visits SET ${updateFields.join(', ')} WHERE id = $1`,
                  updateValues
                );
              }

              // Store EVV event with GPS and capture timestamp
              if (gps && (data.status === 'IN_PROGRESS' || data.status === 'COMPLETED')) {
                // Store verification data
                await db.query(
                  `UPDATE visits 
                   SET verification_data = jsonb_build_object(
                     'gps', $2::jsonb,
                     'capturedAt', $3,
                     'capturedOffline', $4,
                     'deviceId', $5
                   )
                   WHERE id = $1`,
                  [
                    entityId,
                    JSON.stringify(gps),
                    captureTimestamp.toISOString(),
                    capturedOffline ?? false,
                    deviceId,
                  ]
                );
              }

              await db.query(
                `UPDATE sync_metadata 
                 SET sync_status = 'SYNCED', updated_at = NOW()
                 WHERE change_hash = $1`,
                [clientMutationId]
              );

              results.push({ success: true, clientMutationId, entityType, entityId });
            } else {
              // Unsupported operation/entity type
              await db.query(
                `UPDATE sync_metadata 
                 SET sync_status = 'ERROR', 
                     sync_error = $2,
                     updated_at = NOW()
                 WHERE change_hash = $1`,
                [clientMutationId, `Unsupported operation ${operation} on ${entityType}`]
              );

              results.push({
                success: false,
                clientMutationId,
                entityType,
                entityId,
                error: `Unsupported operation ${operation} on ${entityType}`,
              });
            }
          } catch (error) {
            // Record error in sync_metadata
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            await db.query(
              `UPDATE sync_metadata 
               SET sync_status = 'ERROR', 
                   sync_error = $2,
                   updated_at = NOW()
               WHERE change_hash = $1`,
              [clientMutationId, errorMessage]
            ).catch(() => {
              // If update fails, the sync_metadata might not exist yet
              // Insert it with ERROR status
              db.query(
                `INSERT INTO sync_metadata (
                  id, device_id, user_id, organization_id, entity_type, entity_id, operation,
                  client_timestamp, change_data, change_hash, sync_status, sync_error, created_by, updated_by
                )
                VALUES (
                  gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, $8, 'ERROR', $9, $2, $2
                )
                ON CONFLICT DO NOTHING`,
                [
                  deviceId,
                  userId,
                  organizationId,
                  entityType,
                  entityId,
                  operation,
                  new Date(capturedAt),
                  clientMutationId,
                  errorMessage,
                ]
              ).catch(() => {
                // Silently ignore - this is a fallback
              });
            });

            results.push({
              success: false,
              clientMutationId,
              entityType,
              entityId,
              error: errorMessage,
            });
          }
        }

        await db.query('COMMIT');
        res.json({
          success: true,
          data: {
            results,
            syncedCount: results.filter((r) => r.success).length,
            failedCount: results.filter((r) => !r.success).length,
            conflictCount: results.filter((r) => r.conflict !== undefined).length,
            timestamp: Date.now(),
          },
        });
      } catch (error) {
        await db.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error pushing sync changes:', error);
      res.status(500).json({ success: false, error: 'Failed to push sync changes' });
    }
  });

  router.get('/sync/status/:deviceId', async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      
      const userId = req.user.userId;
      const { deviceId } = req.params;

      const result = await db.query(
        `SELECT 
          COUNT(*) as total_syncs,
          COUNT(*) FILTER (WHERE sync_status = 'SYNCED') as successful_syncs,
          COUNT(*) FILTER (WHERE sync_status = 'CONFLICT') as conflicts,
          COUNT(*) FILTER (WHERE sync_status = 'ERROR') as errors,
          MAX(server_timestamp) as last_sync_time
        FROM sync_metadata
        WHERE device_id = $1 AND user_id = $2`,
        [deviceId, userId]
      );

      const deviceResult = await db.query(
        `SELECT last_sync_at, last_seen_at, status
         FROM mobile_devices
         WHERE device_id = $1 AND user_id = $2`,
        [deviceId, userId]
      );

      if (deviceResult.rows.length === 0) {
        res.status(404).json({ success: false, error: 'Device not found' });
        return;
      }

      // Aggregation queries always return at least one row, but check for safety
      const syncStats = result.rows[0] ?? {
        total_syncs: 0,
        successful_syncs: 0,
        conflicts: 0,
        errors: 0,
        last_sync_time: null,
      };

      res.json({
        success: true,
        data: {
          syncStats,
          device: deviceResult.rows[0],
        },
      });
    } catch (error) {
      console.error('Error fetching sync status:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch sync status' });
    }
  });

  router.post('/sync/heartbeat', async (req: Request, res: Response): Promise<void> => {
    try {
      if (req.user === undefined) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }
      
      const userId = req.user.userId;
      const { deviceId } = req.body;

      if (deviceId === undefined || deviceId === null) {
        res.status(400).json({ success: false, error: 'deviceId required' });
        return;
      }

      await db.query(
        `UPDATE mobile_devices
         SET last_seen_at = NOW(), updated_at = NOW()
         WHERE device_id = $1 AND user_id = $2`,
        [deviceId, userId]
      );

      res.json({ success: true, data: { timestamp: Date.now() } });
    } catch (error) {
      console.error('Error updating heartbeat:', error);
      res.status(500).json({ success: false, error: 'Failed to update heartbeat' });
    }
  });

  return router;
}

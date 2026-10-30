/**
 * Admin routes for system management and monitoring
 */

import { Router, type Router as RouterType, type Request, type Response, type NextFunction } from 'express';
import { getCacheService } from '@folkcare/core/service/cache.service';
import { AuthMiddleware, getDatabase } from '@folkcare/core';

const router: RouterType = Router();

// Lazily construct AuthMiddleware on first request so this module can be
// imported (and the router mounted) before initializeDatabase() runs in
// server.ts's startup sequence.
let authMiddleware: AuthMiddleware | undefined;
function getAuthMiddleware(): AuthMiddleware {
  if (authMiddleware === undefined) {
    authMiddleware = new AuthMiddleware(getDatabase());
  }
  return authMiddleware;
}

// Apply authentication to all admin routes
// SECURITY: Must be the real JWT-verifying AuthMiddleware.requireAuth, not
// the mock requireAuth (which trusted spoofable X-User-* headers with zero
// JWT cross-check and was the root cause of a confirmed live exploit).
router.use((req: Request, res: Response, next: NextFunction) => {
  getAuthMiddleware().requireAuth(req, res, next).catch(next);
});

// HIPAA audit logging for impersonated actions (lazy - call at request time, not import time)
router.use((req: Request, res: Response, next: NextFunction) => {
  const middleware = getAuthMiddleware();
  if (middleware.auditImpersonatedActions) {
    middleware.auditImpersonatedActions(req, res, next);
  } else {
    next();
  }
});

const requireAdminRole = (req: Request, res: Response, next: NextFunction): void => {
  const middleware = getAuthMiddleware();
  if (typeof middleware.requireRole === 'function') {
    middleware.requireRole(['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN'])(req, res, next);
    return;
  }
  const userRoles = req.user?.roles ?? [];
  const allowed = ['SUPER_ADMIN', 'ORG_ADMIN', 'ADMIN'].some((r) => userRoles.includes(r));
  if (!allowed) {
    res.status(403).json({
      success: false,
      error: 'Insufficient permissions',
      code: 'INSUFFICIENT_PERMISSIONS',
    });
    return;
  }
  next();
};

/**
 * Get cache statistics
 *
 * @route GET /admin/cache/stats
 * @security Requires admin role
 */
router.get('/cache/stats', requireAdminRole, async (_req, res) => {
  try {
    const cache = getCacheService();
    const stats = await cache.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

/**
 * Clear cache
 *
 * @route POST /admin/cache/clear
 * @security Requires admin role
 */
router.post('/cache/clear', requireAdminRole, async (req, res) => {
  try {
    const cache = getCacheService();
    const { pattern } = req.body as { pattern?: string };

    if (pattern !== undefined) {
      await cache.delPattern(pattern);
      res.json({ message: `Cleared cache for pattern: ${pattern}` });
    } else {
      await cache.clearAll();
      res.json({ message: 'Cleared all cache' });
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

export default router;

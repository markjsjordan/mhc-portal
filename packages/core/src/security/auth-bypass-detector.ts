/**
 * HIPAA-002: Auth Bypass Detection & Hardening
 * HIPAA Security Rule § 164.312(a)(1)
 */

import { Request, Response, NextFunction } from 'express';
import { EnvironmentIsolationService } from './environment-isolation';

const BYPASS_PATTERNS = [
  'skip_auth', 'bypass_auth', 'no_auth', 'disable_auth',
  'mock_auth', 'fake_auth', 'test_auth', 'dev_auth',
  'demo_mode', 'test_mode', 'dev_mode', 'debug_mode',
  'impersonate', 'spoof_user', 'as_user', 'switch_user',
  'skip_token', 'no_token', 'bypass_token'
];

export class AuthBypassDetector {
  static blockBypassAttempts = (req: Request, res: Response, next: NextFunction): void => {
    for (const pattern of BYPASS_PATTERNS) {
      if (req.headers[pattern] || req.query[pattern] || (req.body && req.body[pattern])) {
        console.error('🚨 HIPAA-002: Bypass attempt blocked', { pattern, ip: req.ip });
        res.status(403).json({ success: false, error: 'Access denied', code: 'AUTH_BYPASS_BLOCKED' });
        return;
      }
    }
    next();
  };

  static blockMockAuthRoutes = (req: Request, res: Response, next: NextFunction): void => {
    const env = EnvironmentIsolationService.getInstance();
    
    if (env.isProduction()) {
      const mockRoutes = ['/api/auth/mock', '/api/auth/test', '/api/auth/demo', '/api/test', '/api/mock'];
      
      if (mockRoutes.some(route => req.path.startsWith(route))) {
        console.error('🚨 HIPAA-002: Mock route blocked in production', { path: req.path });
        res.status(404).json({ success: false, error: 'Not found' });
        return;
      }
    }
    next();
  };
}

export function createAuthHardeningMiddleware() {
  return [
    AuthBypassDetector.blockBypassAttempts,
    AuthBypassDetector.blockMockAuthRoutes
  ];
}

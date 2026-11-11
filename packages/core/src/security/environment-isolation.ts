/**
 * HIPAA-001: Environment Isolation Service
 *
 * Ensures strict separation between production, preview, and development environments.
 */

export type Environment = 'production' | 'preview' | 'development' | 'test';

export class EnvironmentIsolationService {
  private static instance: EnvironmentIsolationService | undefined;
  private readonly currentEnvironment: Environment;

  private constructor() {
    this.currentEnvironment = this.detectEnvironment();
    this.validateEnvironment();
  }

  static getInstance(): EnvironmentIsolationService {
    EnvironmentIsolationService.instance ??= new EnvironmentIsolationService();
    return EnvironmentIsolationService.instance;
  }

  static resetInstance(): void {
    EnvironmentIsolationService.instance = undefined;
  }

  private detectEnvironment(): Environment {
    const vercelEnv = process.env['VERCEL_ENV'];
    const nodeEnv = process.env['NODE_ENV'];

    if (vercelEnv === 'production') return 'production';
    if (vercelEnv === 'preview') return 'preview';
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'production') return 'production';
    if (nodeEnv === 'preview') return 'preview';

    return 'development';
  }

  /**
   * Exact-match allowlist of production database hostnames from
   * PRODUCTION_DATABASE_HOSTS (comma-separated). Entries are trimmed and
   * lowercased; empty entries are dropped. Parameters are explicitly typed
   * because packages/mobile compiles this source directly via a tsconfig path
   * mapping and reports implicit-any on untyped callbacks.
   */
  private static getProductionHosts(): Set<string> {
    const raw: string = process.env['PRODUCTION_DATABASE_HOSTS'] ?? '';
    const hosts: string[] = raw
      .split(',')
      .map((host: string): string => host.trim().toLowerCase())
      .filter((host: string): boolean => host.length > 0);
    return new Set<string>(hosts);
  }

  private static getDatabaseHostname(databaseUrl: string): string {
    try {
      const hostname = new URL(databaseUrl).hostname.toLowerCase();
      return hostname;
    } catch {
      return '';
    }
  }

  private validateEnvironment(): void {
    console.log(`🔒 HIPAA-001: Environment=${this.currentEnvironment}`);

    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    const productionHosts = EnvironmentIsolationService.getProductionHosts();

    const currentHost = EnvironmentIsolationService.getDatabaseHostname(databaseUrl);
    const isProductionDb = productionHosts.has(currentHost);

    if (this.currentEnvironment === 'production') {
      if (productionHosts.size === 0) {
        throw new Error('HIPAA VIOLATION: PRODUCTION_DATABASE_HOSTS must be configured in production');
      }
      if (!isProductionDb) {
        throw new Error('HIPAA VIOLATION: Production must use production database');
      }
    }

    if (this.currentEnvironment !== 'production') {
      if (productionHosts.size > 0 && isProductionDb) {
        throw new Error('HIPAA VIOLATION: Non-production cannot access production database');
      }
    }

    if (this.currentEnvironment === 'production') {
      this.validateProductionSecrets();
    }
  }

  private validateProductionSecrets(): void {
    const jwtSecret = process.env['JWT_SECRET'] ?? '';
    const encryptionKey = process.env['ENCRYPTION_KEY'] ?? '';

    const insecureValues = ['example', 'test', 'demo', 'change'];
    
    const errors: string[] = [];

    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET is shorter than 32 characters');
    }
    
    if (encryptionKey.length < 64) {
      errors.push('ENCRYPTION_KEY is shorter than 64 characters');
    }

    const jwtHasInsecure = insecureValues.some(v => jwtSecret.toLowerCase().includes(v));
    if (jwtHasInsecure) {
      errors.push('JWT_SECRET contains a placeholder value');
    }

    const encKeyHasInsecure = insecureValues.some(v => encryptionKey.toLowerCase().includes(v));
    if (encKeyHasInsecure) {
      errors.push('ENCRYPTION_KEY contains a placeholder value');
    }

    if (errors.length > 0) {
      throw new Error(`HIPAA VIOLATION: Insecure production secrets detected: ${errors.join(', ')}`);
    }
  }

  private static isProductionEnvironment(): boolean {
    const nodeEnv = process.env['NODE_ENV'] ?? '';
    const vercelEnv = process.env['VERCEL_ENV'] ?? '';
    const envVar = process.env['ENVIRONMENT'] ?? '';
    
    return nodeEnv === 'production' || vercelEnv === 'production' || envVar === 'production';
  }

  private static isProductionDatabase(): boolean {
    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    const productionHosts = EnvironmentIsolationService.getProductionHosts();

    const currentHost = EnvironmentIsolationService.getDatabaseHostname(databaseUrl);
    return productionHosts.has(currentHost);
  }

  static assertNotProductionForDestructiveOperation(operationName = 'nuke'): void {
    if (this.isProductionEnvironment() || this.isProductionDatabase()) {
      throw new Error(
        `HIPAA VIOLATION: Destructive operation "${operationName}" is strictly prohibited in production environments or against production databases.`
      );
    }
  }

  getEnvironment(): Environment {
    return this.currentEnvironment;
  }

  isProduction(): boolean {
    return this.currentEnvironment === 'production';
  }
}

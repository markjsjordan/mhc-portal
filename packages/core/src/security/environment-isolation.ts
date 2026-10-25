/**
 * HIPAA-001: Environment Isolation Service
 * 
 * Ensures strict separation between production, preview, and development environments.
 */

export type Environment = 'production' | 'preview' | 'development' | 'test';

export class EnvironmentIsolationService {
  private static instance: EnvironmentIsolationService;
  private currentEnvironment: Environment;

  private constructor() {
    this.currentEnvironment = this.detectEnvironment();
    this.validateEnvironment();
  }

  static getInstance(): EnvironmentIsolationService {
    if (!EnvironmentIsolationService.instance) {
      EnvironmentIsolationService.instance = new EnvironmentIsolationService();
    }
    return EnvironmentIsolationService.instance;
  }

  private detectEnvironment(): Environment {
    const vercelEnv = process.env['VERCEL_ENV'];
    const nodeEnv = process.env['NODE_ENV'];
    
    if (vercelEnv === 'production') return 'production';
    if (vercelEnv === 'preview') return 'preview';
    if (nodeEnv === 'test') return 'test';
    if (nodeEnv === 'production') return 'production';
    
    return 'development';
  }

  private validateEnvironment(): void {
    console.log(`🔒 HIPAA-001: Environment=${this.currentEnvironment}`);

    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    const isProductionDb = databaseUrl.includes('production') || databaseUrl.includes('prod-');

    if (this.currentEnvironment === 'production' && !isProductionDb) {
      throw new Error('HIPAA VIOLATION: Production must use production database');
    }

    if (this.currentEnvironment !== 'production' && isProductionDb) {
      throw new Error('HIPAA VIOLATION: Non-production cannot access production database');
    }

    if (this.currentEnvironment === 'production') {
      this.validateProductionSecrets();
    }
  }

  private validateProductionSecrets(): void {
    const jwtSecret = process.env['JWT_SECRET'] ?? '';
    const encryptionKey = process.env['ENCRYPTION_KEY'] ?? '';

    const insecure = ['example', 'test', 'demo', 'change'];
    const hasInsecure = insecure.some(v => 
      jwtSecret.toLowerCase().includes(v) || encryptionKey.toLowerCase().includes(v)
    );

    if (hasInsecure || jwtSecret.length < 32 || encryptionKey.length < 64) {
      throw new Error('HIPAA VIOLATION: Insecure production secrets detected');
    }
  }

  getEnvironment(): Environment {
    return this.currentEnvironment;
  }

  isProduction(): boolean {
    return this.currentEnvironment === 'production';
  }
}

/**
 * HIPAA-001: Environment Isolation Service
 * 
 * Ensures strict separation between production, preview, and development environments
 * to prevent PHI exposure in lower-security environments.
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
    console.log(`\n🔒 HIPAA-001: Environment Isolation`);
    console.log(`Environment: ${this.currentEnvironment}\n`);

    const databaseUrl = process.env['DATABASE_URL'] ?? '';
    const isProductionDb = databaseUrl.includes('production') || databaseUrl.includes('prod-');

    // Production must use production database
    if (this.currentEnvironment === 'production' && !isProductionDb) {
      throw new Error(
        'HIPAA VIOLATION: Production environment must use production database'
      );
    }

    // Non-production must NOT use production database
    if (this.currentEnvironment !== 'production' && isProductionDb) {
      throw new Error(
        'HIPAA VIOLATION: Non-production environment attempting to access production PHI'
      );
    }

    // Production secrets validation
    if (this.currentEnvironment === 'production') {
      this.validateProductionSecrets();
    }

    console.log(`✅ Environment isolation validated\n`);
  }

  private validateProductionSecrets(): void {
    const jwtSecret = process.env['JWT_SECRET'] ?? '';
    const encryptionKey = process.env['ENCRYPTION_KEY'] ?? '';

    const insecureValues = ['example', 'test', 'demo', 'change_in_production'];
    const hasInsecureSecret = insecureValues.some(
      value => 
        jwtSecret.toLowerCase().includes(value) ||
        encryptionKey.toLowerCase().includes(value)
    );

    if (hasInsecureSecret) {
      throw new Error(
        'HIPAA VIOLATION: Production using insecure secrets. Run: npm run rotate:secrets'
      );
    }

    if (jwtSecret.length < 32) {
      throw new Error('HIPAA VIOLATION: JWT_SECRET must be at least 32 characters');
    }

    if (encryptionKey.length < 64) {
      throw new Error('HIPAA VIOLATION: ENCRYPTION_KEY must be at least 64 characters');
    }
  }

  getEnvironment(): Environment {
    return this.currentEnvironment;
  }

  isProduction(): boolean {
    return this.currentEnvironment === 'production';
  }
}

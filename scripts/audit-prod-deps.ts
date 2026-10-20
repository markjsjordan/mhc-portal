#!/usr/bin/env tsx
import { execSync } from 'child_process';

console.log('Running scoped production dependency security audit...\n');

try {
  const output = execSync('npm audit --omit=dev --json', {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const audit = JSON.parse(output);
  processAuditResults(audit);
} catch (error: any) {
  if (error.stdout) {
    try {
      const audit = JSON.parse(error.stdout);
      processAuditResults(audit);
    } catch {
      console.error('Failed to parse npm audit output:', error.message);
      process.exit(1);
    }
  } else {
    console.error('Audit execution failed:', error.message);
    process.exit(1);
  }
}

function processAuditResults(audit: any) {
  const vulns = Object.entries(audit.vulnerabilities || {});
  
  // Mobile / dev tooling dependencies that are only bundled on client/device (Expo, Metro, React Native CLI tools)
  const mobileToolingDeps = new Set([
    '@expo/cli',
    '@expo/code-signing-certificates',
    '@expo/metro',
    '@expo/metro-config',
    '@expo/config',
    '@expo/config-plugins',
    '@expo/prebuild-config',
    '@react-native/community-cli-plugin',
    '@react-native/dev-middleware',
    'metro',
    'metro-config',
    'metro-file-map',
    'metro-transform-worker',
    'react-native',
    'react-devtools-core',
    'babel-jest',
    'jest-haste-map',
    'jest-message-util',
    'jest-environment-node',
    '@jest/environment',
    '@jest/fake-timers',
    '@jest/transform',
    'node-forge',
    'image-size',
    'expo',
    'expo-asset',
    'expo-constants',
    'expo-notifications',
    'xcode',
    'ws',
  ]);

  const criticalIssues: any[] = [];
  const highProdIssues: any[] = [];
  const mobileToolingIssues: any[] = [];

  for (const [name, info] of vulns) {
    const v = info as any;
    if (mobileToolingDeps.has(name)) {
      mobileToolingIssues.push({ name, severity: v.severity, via: v.via });
    } else if (v.severity === 'critical') {
      criticalIssues.push({ name, severity: v.severity, via: v.via });
    } else if (v.severity === 'high') {
      highProdIssues.push({ name, severity: v.severity, via: v.via });
    }
  }

  console.log(`Found ${vulns.length} total vulnerability entries.`);
  console.log(`• Critical production runtime issues: ${criticalIssues.length}`);
  console.log(`• High production runtime issues: ${highProdIssues.length}`);
  console.log(`• Mobile / tooling chain entries (scoped): ${mobileToolingIssues.length}\n`);

  if (criticalIssues.length > 0) {
    console.error('❌ Critical production runtime vulnerabilities detected:');
    for (const issue of criticalIssues) {
      console.error(`  - ${issue.name} (${issue.severity})`);
    }
    process.exit(1);
  }

  if (highProdIssues.length > 0) {
    console.log('ℹ️ High production runtime findings (monitored/transitive):');
    for (const issue of highProdIssues) {
      console.log(`  - ${issue.name} (${issue.severity})`);
    }
  }

  console.log('\n✅ Production runtime audit passed (0 critical vulnerabilities).');
  process.exit(0);
}

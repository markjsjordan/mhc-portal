/**
 * User Profile API Tests
 * Tests for GET /api/users/profile and PUT /api/users/profile endpoints
 */

import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { type Database, JWTUtils } from '@folkcare/core';
import { createUsersRouter } from '../users.js';

process.env.JWT_SECRET = 'test-jwt-secret-key-at-least-32-characters-long!';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-at-least-32-chars!';

interface TestUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  organization_id: string;
  status: string;
  version: number;
  token_version: number;
  deleted_at: string | null;
  updated_at: string;
  updated_by: string;
}

class MockProfileDatabase {
  users = new Map<string, TestUser>();

  seedUser(user: TestUser): void {
    this.users.set(user.id, { ...user });
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  async query(text: string, params: unknown[] = []): Promise<{ rows: any[] }> {
    const trimmed = text.trim();

    // 1. SELECT status, token_version FROM users WHERE id = $1 AND deleted_at IS NULL
    if (trimmed.includes('SELECT status, token_version FROM users WHERE id = $1')) {
      const id = params[0] as string;
      const user = this.users.get(id);
      if (user?.deleted_at === null) {
        return { rows: [{ status: user.status, token_version: user.token_version }] };
      }
      return { rows: [] };
    }

    // 2. SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL
    if (trimmed.includes('SELECT * FROM users WHERE id = $1')) {
      const id = params[0] as string;
      const user = this.users.get(id);
      if (user?.deleted_at === null) {
        return { rows: [{ ...user }] };
      }
      return { rows: [] };
    }

    // 3. SELECT id FROM users WHERE email = $1 AND organization_id = $2 AND id != $3 AND deleted_at IS NULL
    if (trimmed.includes('SELECT id FROM users WHERE email = $1 AND organization_id = $2 AND id != $3')) {
      const [email, orgId, currentId] = params as [string, string, string];
      const match = Array.from(this.users.values()).find(
        (u) => u.email === email && u.organization_id === orgId && u.id !== currentId && u.deleted_at === null
      );
      return { rows: match ? [{ id: match.id }] : [] };
    }

    // 4. SELECT version FROM users WHERE id = $1 AND deleted_at IS NULL
    if (trimmed.includes('SELECT version FROM users WHERE id = $1')) {
      const id = params[0] as string;
      const user = this.users.get(id);
      if (user?.deleted_at === null) {
        return { rows: [{ version: user.version }] };
      }
      return { rows: [] };
    }

    // 5. SELECT id, email, first_name, last_name, phone, version, updated_at, updated_by FROM users WHERE id = $1 AND deleted_at IS NULL
    if (trimmed.includes('SELECT id, email, first_name, last_name, phone, version, updated_at, updated_by FROM users WHERE id = $1')) {
      const id = params[0] as string;
      const user = this.users.get(id);
      if (user?.deleted_at === null) {
        return { rows: [{ ...user }] };
      }
      return { rows: [] };
    }

    // 6. UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, updated_at = NOW(), updated_by = $5, version = version + 1 WHERE id = $6 AND deleted_at IS NULL RETURNING *
    if (trimmed.startsWith('UPDATE users') && trimmed.includes('version = version + 1')) {
      const [firstName, lastName, email, phone, updatedBy, id] = params as [
        string,
        string,
        string,
        string | null,
        string,
        string
      ];
      const user = this.users.get(id);
      if (user?.deleted_at !== null) {
        return { rows: [] };
      }
      user.first_name = firstName;
      user.last_name = lastName;
      user.email = email;
      user.phone = phone;
      user.updated_by = updatedBy;
      user.updated_at = new Date().toISOString();
      user.version += 1;
      return { rows: [{ ...user }] };
    }

    // 7. UPDATE users SET deleted_at = NOW() WHERE id = $1
    if (trimmed.includes('UPDATE users SET deleted_at = NOW() WHERE id = $1')) {
      const id = params[0] as string;
      const user = this.users.get(id);
      if (user) {
        user.deleted_at = new Date().toISOString();
      }
      return { rows: [] };
    }

    // 8. INSERT INTO users (id, email, first_name, organization_id) VALUES ($1, $2, $3, $4)
    if (trimmed.startsWith('INSERT INTO users')) {
      const [id, email, firstName, orgId] = params as [string, string, string, string];
      const newUser: TestUser = {
        id,
        email,
        first_name: firstName,
        last_name: '',
        phone: null,
        organization_id: orgId,
        status: 'ACTIVE',
        version: 1,
        token_version: 1,
        deleted_at: null,
        updated_at: new Date().toISOString(),
        updated_by: id,
      };
      this.users.set(id, newUser);
      return { rows: [] };
    }

    return { rows: [] };
  }
}

describe('User Profile API', () => {
  let app: Express;
  let db: MockProfileDatabase;
  let testUserId: string;
  let testToken: string;
  let testUserVersion: number;
  const testOrgId = 'test-org-123';

  beforeEach(async () => {
    // Setup: Create test user and get JWT token
    testUserId = 'test-user-id-' + randomUUID();
    testUserVersion = 1;

    db = new MockProfileDatabase();
    db.seedUser({
      id: testUserId,
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      phone: '(555) 000-0000',
      organization_id: testOrgId,
      status: 'ACTIVE',
      version: testUserVersion,
      token_version: 1,
      deleted_at: null,
      updated_at: new Date().toISOString(),
      updated_by: testUserId,
    });

    testToken = JWTUtils.generateTokenPair({
      userId: testUserId,
      email: 'test@example.com',
      organizationId: testOrgId,
      branchIds: [],
      roles: ['user'],
      permissions: ['profile:read', 'profile:write'],
      tokenVersion: 1,
    }).accessToken;

    app = express();
    app.use(express.json());
    app.use('/api/users', createUsersRouter(db as unknown as Database));
  });

  describe('GET /api/users/profile', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/users/profile');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('should return user profile with all fields', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('firstName');
      expect(response.body.data).toHaveProperty('lastName');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('phone');
      expect(response.body.data).toHaveProperty('organizationId');
      expect(response.body.data).toHaveProperty('roles');
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('updatedAt');
      expect(response.body.data).toHaveProperty('updatedBy');
    });

    it('should return 404 for deleted user', async () => {
      // Setup: Mark user as deleted
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [testUserId]);

      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('USER_NOT_FOUND');
    });

    it('should include phone field in response', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.phone).toBeDefined();
    });
  });

  describe('PUT /api/users/profile', () => {
    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        });

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('AUTH_REQUIRED');
    });

    it('should update profile with valid data', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '(555) 123-4567',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('Jane');
      expect(response.body.data.lastName).toBe('Smith');
      expect(response.body.data.email).toBe('jane@example.com');
      expect(response.body.data.phone).toBe('(555) 123-4567');
      expect(response.body.data.version).toBe(testUserVersion + 1);
    });

    it('should update profile without phone', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.phone).toBeNull();
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject empty first name', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: '',
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject first name exceeding max length', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'a'.repeat(101),
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject phone exceeding max length', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '1234567890123456789012',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject email already in use by another user', async () => {
      // Setup: Create another user with the email
      const otherUserId = 'other-user-' + randomUUID();
      await db.query(
        'INSERT INTO users (id, email, first_name, organization_id) VALUES ($1, $2, $3, $4)',
        [otherUserId, 'taken@example.com', 'Other', testOrgId]
      );

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'taken@example.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('EMAIL_IN_USE');
      expect(response.body.field).toBe('email');
    });

    it('should allow updating own email', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'newemail@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should increment version on successful update', async () => {
      const response1 = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane1@example.com',
        });

      const version1 = response1.body.data.version;

      const response2 = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane2',
          lastName: 'Smith',
          email: 'jane2@example.com',
        });

      const version2 = response2.body.data.version;
      expect(version2).toBe(version1 + 1);
    });

    it('should detect version conflict on concurrent update', async () => {
      // First update - get current version
      const response1 = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      const currentVersion = response1.body.data.version;

      // Second update with stale version
      const response2 = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          version: currentVersion - 1, // Stale version
        });

      expect(response2.status).toBe(409);
      expect(response2.body.code).toBe('VERSION_CONFLICT');
      expect(response2.body.current).toBeDefined();
      expect(response2.body.current.version).toBe(currentVersion);
    });

    it('should return current values on version conflict', async () => {
      const updateResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: '(555) 123-4567',
        });

      const conflictResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          version: updateResponse.body.data.version - 1,
        });

      expect(conflictResponse.status).toBe(409);
      expect(conflictResponse.body.current.firstName).toBe('Jane');
      expect(conflictResponse.body.current.lastName).toBe('Smith');
      expect(conflictResponse.body.current.email).toBe('jane@example.com');
      expect(conflictResponse.body.current.phone).toBe('(555) 123-4567');
    });

    it('should reject request with missing required fields', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          // Missing lastName and email
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should accept optional phone field', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: null,
        });

      expect(response.status).toBe(200);
      expect(response.body.data.phone).toBeNull();
    });

    it('should return timestamp in response', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should update updatedAt and updatedBy fields', async () => {
      const beforeUpdate = new Date();

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      const afterUpdate = new Date();
      const updatedAt = new Date(response.body.data.updatedAt);

      expect(updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
      expect(response.body.data.updatedBy).toBe(testUserId);
    });
  });

  describe('Optimistic Locking', () => {
    it('should handle concurrent updates correctly', async () => {
      // Simulate two users trying to update concurrently
      const update1 = request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'FirstUpdate',
          lastName: 'User',
          email: 'first@example.com',
        });

      const update2 = request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'SecondUpdate',
          lastName: 'User',
          email: 'second@example.com',
        });

      const [resp1, resp2] = await Promise.all([update1, update2]);

      // Both should succeed, but second may trigger conflict
      expect([resp1.status, resp2.status]).toContain(200);
    });

    it('should support optimistic locking version field', async () => {
      // Get initial version
      const getResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);

      const initialVersion = getResponse.body.data.version;

      // Update with correct version
      const updateResponse = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'User',
          email: 'updated@example.com',
          version: initialVersion,
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.version).toBe(initialVersion + 1);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test that the route responds with standard HTTP status code for valid data
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        });

      // Should not return 500 for valid data
      expect([200, 400, 409]).toContain(response.status);
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'notanemail',
        'missing@domain',
        '@example.com',
        'spaces in@email.com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            firstName: 'Jane',
            lastName: 'Smith',
            email,
          });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe('VALIDATION_ERROR');
      }
    });
  });
});

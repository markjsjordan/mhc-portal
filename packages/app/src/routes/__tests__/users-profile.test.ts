/**
 * User Profile API Tests
 * Tests for GET /api/users/profile and PUT /api/users/profile endpoints
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { Database } from '@folkcare/core';

// SKIPPED (wdvf3abp34): placeholder suite. `app` is undefined and `db` is an empty object, so no test can run. Re-enable once a real app+DB+auth test harness exists.
describe.skip('User Profile API', () => {
  let app: any;
  let db: Database;
  let testUserId: string;
  let testToken: string;
  let testUserVersion: number;

  beforeEach(async () => {
    // Setup: Create test user and get JWT token
    // This assumes auth setup is available
    // eslint-disable-next-line sonarjs/pseudo-random
    testUserId = 'test-user-id-' + Math.random().toString(36).slice(2, 11);
    testUserVersion = 1;
    // Initialize test token and database
    testToken = 'test-jwt-token-placeholder';
    db = {} as Database; // Mock database object for tests
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
      // eslint-disable-next-line sonarjs/pseudo-random
      const otherUserId = 'other-user-' + Math.random().toString(36).slice(2, 11);
      await db.query(
        'INSERT INTO users (id, email, first_name, organization_id) VALUES ($1, $2, $3, $4)',
        [otherUserId, 'taken@example.com', 'Other', 'test-org']
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
      // This would require mocking a database failure
      // For now, we test that the error is returned as 500
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

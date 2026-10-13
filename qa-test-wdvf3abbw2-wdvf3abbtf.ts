/**
 * QA Test Suite for Features:
 * 1. wdvf3abbw2 - Create visits from schedule
 * 2. wdvf3abbtf - Create goals in care plans
 * 
 * This comprehensive QA test suite validates all critical functionality
 * for both features after the blocker fix (commit b42150d4)
 */

import * as http from 'http';

// Types for test configuration
interface TestResult {
  feature: string;
  testName: string;
  passed: boolean;
  error?: string;
}

interface APIResponse {
  status: number;
  body: any;
}

// Test results collection
const results: TestResult[] = [];

/**
 * Helper: Make HTTP request
 */
function makeRequest(
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>
): Promise<APIResponse> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer test-token`,
        'X-Organization-Id': 'test-org-123',
        ...(headers || {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 500,
            body: data ? JSON.parse(data) : {},
          });
        } catch (e) {
          resolve({
            status: res.statusCode || 500,
            body: { raw: data },
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Record test result
 */
function recordResult(feature: string, testName: string, passed: boolean, error?: string) {
  results.push({ feature, testName, passed, error });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${status} [${feature}] ${testName}${error ? ': ' + error : ''}`);
}

// ============================================================================
// FEATURE 1: wdvf3abbw2 - Create visits from schedule
// ============================================================================

async function testCreateVisit() {
  console.log('\n=== Testing Feature: wdvf3abbw2 (Create Visits from Schedule) ===\n');

  try {
    // Test 1: Create valid visit
    console.log('Test 1: Create valid visit');
    const validVisitPayload = {
      clientId: 'client-abc123',
      caregiverId: 'caregiver-def456',
      serviceTypeId: 'service-ghi789',
      serviceTypeName: 'Personal Care',
      scheduledDate: '2025-01-20',
      scheduledStartTime: '09:00',
      scheduledEndTime: '10:30',
      address: '123 Main St, Springfield, IL 62701',
      notes: 'Regular weekly visit',
      clientInstructions: 'Please have medications ready',
      status: 'ASSIGNED',
    };

    const createRes = await makeRequest('POST', '/api/visits', validVisitPayload);
    const visitCreated = createRes.status === 201;
    recordResult(
      'wdvf3abbw2',
      'Create valid visit',
      visitCreated,
      visitCreated ? undefined : `Expected 201, got ${createRes.status}`
    );

    if (!visitCreated) {
      console.error('  Response:', createRes.body);
      return;
    }

    const visitId = createRes.body.data?.id;

    // Test 2: Verify visit persistence
    console.log('Test 2: Verify visit persistence');
    const getRes = await makeRequest('GET', `/api/visits/${visitId}`);
    const visitPersisted =
      getRes.status === 200 &&
      getRes.body.data?.client_id === validVisitPayload.clientId &&
      getRes.body.data?.scheduled_date === validVisitPayload.scheduledDate;
    recordResult(
      'wdvf3abbw2',
      'Visit persists in database',
      visitPersisted,
      visitPersisted ? undefined : `Status: ${getRes.status}`
    );

    // Test 3: Edge case - Missing required fields
    console.log('Test 3: Edge case - Missing required fields');
    const missingFieldsPayload = {
      clientId: 'client-abc123',
      // Missing serviceTypeId, scheduledDate, etc.
    };

    const missingRes = await makeRequest('POST', '/api/visits', missingFieldsPayload);
    const missingFieldsHandled = missingRes.status === 400;
    recordResult(
      'wdvf3abbw2',
      'Missing required fields rejected',
      missingFieldsHandled,
      missingFieldsHandled ? undefined : `Expected 400, got ${missingRes.status}`
    );

    // Test 4: Edge case - Invalid date format
    console.log('Test 4: Edge case - Invalid date format');
    const invalidDatePayload = {
      ...validVisitPayload,
      scheduledDate: '01-20-2025', // Wrong format
    };

    const invalidDateRes = await makeRequest('POST', '/api/visits', invalidDatePayload);
    const invalidDateHandled = invalidDateRes.status === 400;
    recordResult(
      'wdvf3abbw2',
      'Invalid date format rejected',
      invalidDateHandled,
      invalidDateHandled ? undefined : `Expected 400, got ${invalidDateRes.status}`
    );

    // Test 5: Edge case - Invalid time format
    console.log('Test 5: Edge case - Invalid time format');
    const invalidTimePayload = {
      ...validVisitPayload,
      scheduledStartTime: '9:00 AM', // Wrong format
    };

    const invalidTimeRes = await makeRequest('POST', '/api/visits', invalidTimePayload);
    const invalidTimeHandled = invalidTimeRes.status === 400;
    recordResult(
      'wdvf3abbw2',
      'Invalid time format rejected',
      invalidTimeHandled,
      invalidTimeHandled ? undefined : `Expected 400, got ${invalidTimeRes.status}`
    );

    // Test 6: Edge case - Client not found
    console.log('Test 6: Edge case - Client not found');
    const nonexistentClientPayload = {
      ...validVisitPayload,
      clientId: 'nonexistent-client-999',
    };

    const clientNotFoundRes = await makeRequest(
      'POST',
      '/api/visits',
      nonexistentClientPayload
    );
    const clientNotFoundHandled = clientNotFoundRes.status === 404;
    recordResult(
      'wdvf3abbw2',
      'Nonexistent client rejected',
      clientNotFoundHandled,
      clientNotFoundHandled ? undefined : `Expected 404, got ${clientNotFoundRes.status}`
    );

    // Test 7: Verify service_types table is NOT queried (bug fix verification)
    console.log('Test 7: Verify service_types table query fix');
    // This test passes if the endpoint doesn't crash with missing service_types table
    const serviceTypeBugFixPayload = {
      clientId: 'client-abc123',
      serviceTypeId: 'service-ghi789',
      serviceTypeName: 'Physical Therapy',
      scheduledDate: '2025-01-21',
      scheduledStartTime: '14:00',
      scheduledEndTime: '15:00',
    };

    const bugFixRes = await makeRequest('POST', '/api/visits', serviceTypeBugFixPayload);
    const bugFixVerified =
      bugFixRes.status !== 500 ||
      (bugFixRes.body?.error && !bugFixRes.body.error.includes('service_types'));
    recordResult(
      'wdvf3abbw2',
      'Service types table query removed (bug fix)',
      bugFixVerified,
      bugFixVerified ? undefined : 'service_types table still being queried'
    );

    // Test 8: Unassigned visit (no caregiver)
    console.log('Test 8: Create unassigned visit');
    const unassignedPayload = {
      clientId: 'client-abc123',
      serviceTypeId: 'service-ghi789',
      serviceTypeName: 'Medication Management',
      scheduledDate: '2025-01-22',
      scheduledStartTime: '11:00',
      scheduledEndTime: '11:30',
      status: 'UNASSIGNED',
    };

    const unassignedRes = await makeRequest('POST', '/api/visits', unassignedPayload);
    const unassignedCreated =
      unassignedRes.status === 201 &&
      unassignedRes.body.data?.status === 'UNASSIGNED';
    recordResult(
      'wdvf3abbw2',
      'Create unassigned visit',
      unassignedCreated,
      unassignedCreated ? undefined : `Expected 201 with UNASSIGNED status`
    );
  } catch (error) {
    recordResult('wdvf3abbw2', 'Feature test suite', false, String(error));
  }
}

// ============================================================================
// FEATURE 2: wdvf3abbtf - Create goals in care plans
// ============================================================================

async function testCreateGoal() {
  console.log('\n=== Testing Feature: wdvf3abbtf (Create Goals in Care Plans) ===\n');

  try {
    // Test 1: Create valid goal
    console.log('Test 1: Create valid goal');
    const validGoalPayload = {
      description: 'Improve mobility and independence',
      goal_type: 'FUNCTIONAL',
      priority: 'HIGH',
      target_date: '2025-03-20',
      status: 'ACTIVE',
      measurement_method: 'OBSERVATION',
      baseline_value: '10 steps with walker',
      target_value: '50 steps without walker',
      notes: 'Patient wants to walk independently',
    };

    const createGoalRes = await makeRequest(
      'POST',
      '/api/care-plans/careplan-123/goals',
      validGoalPayload
    );
    const goalCreated = createGoalRes.status === 201;
    recordResult(
      'wdvf3abbtf',
      'Create valid goal',
      goalCreated,
      goalCreated ? undefined : `Expected 201, got ${createGoalRes.status}`
    );

    if (!goalCreated) {
      console.error('  Response:', createGoalRes.body);
      return;
    }

    const goalId = createGoalRes.body.data?.id;

    // Test 2: Verify goal persistence
    console.log('Test 2: Verify goal persistence');
    const getGoalRes = await makeRequest(
      'GET',
      `/api/care-plans/careplan-123/goals/${goalId}`
    );
    const goalPersisted =
      getGoalRes.status === 200 &&
      getGoalRes.body.data?.description === validGoalPayload.description &&
      getGoalRes.body.data?.priority === validGoalPayload.priority;
    recordResult(
      'wdvf3abbtf',
      'Goal persists in database',
      goalPersisted,
      goalPersisted ? undefined : `Status: ${getGoalRes.status}`
    );

    // Test 3: All fields present
    console.log('Test 3: Goal has all required fields');
    const hasAllFields =
      goalCreated &&
      getGoalRes.body.data?.description &&
      getGoalRes.body.data?.goal_type &&
      getGoalRes.body.data?.priority &&
      getGoalRes.body.data?.target_date &&
      getGoalRes.body.data?.baseline_value &&
      getGoalRes.body.data?.target_value;
    recordResult(
      'wdvf3abbtf',
      'Goal has all fields',
      hasAllFields,
      hasAllFields ? undefined : 'Some fields missing'
    );

    // Test 4: Edge case - Missing care plan ID
    console.log('Test 4: Edge case - Missing care plan ID');
    const missingCarePlanRes = await makeRequest(
      'POST',
      '/api/care-plans//goals',
      validGoalPayload
    );
    const missingCarePlanHandled =
      missingCarePlanRes.status === 400 || missingCarePlanRes.status === 404;
    recordResult(
      'wdvf3abbtf',
      'Missing care plan ID rejected',
      missingCarePlanHandled,
      missingCarePlanHandled ? undefined : `Expected 400/404, got ${missingCarePlanRes.status}`
    );

    // Test 5: Edge case - Nonexistent care plan
    console.log('Test 5: Edge case - Nonexistent care plan');
    const nonexistentCarePlanRes = await makeRequest(
      'POST',
      '/api/care-plans/nonexistent-999/goals',
      validGoalPayload
    );
    const nonexistentCarePlanHandled = nonexistentCarePlanRes.status === 404;
    recordResult(
      'wdvf3abbtf',
      'Nonexistent care plan rejected',
      nonexistentCarePlanHandled,
      nonexistentCarePlanHandled ? undefined : `Expected 404, got ${nonexistentCarePlanRes.status}`
    );

    // Test 6: Error handling - Invalid priority
    console.log('Test 6: Error handling - Invalid priority');
    const invalidPriorityPayload = {
      ...validGoalPayload,
      priority: 'SUPER_HIGH', // Invalid enum value
    };

    const invalidPriorityRes = await makeRequest(
      'POST',
      '/api/care-plans/careplan-123/goals',
      invalidPriorityPayload
    );
    const invalidPriorityHandled = invalidPriorityRes.status === 400;
    recordResult(
      'wdvf3abbtf',
      'Invalid priority rejected',
      invalidPriorityHandled,
      invalidPriorityHandled ? undefined : `Expected 400, got ${invalidPriorityRes.status}`
    );

    // Test 7: Error handling - Invalid goal type
    console.log('Test 7: Error handling - Invalid goal type');
    const invalidGoalTypePayload = {
      ...validGoalPayload,
      goal_type: 'INVALID_TYPE',
    };

    const invalidGoalTypeRes = await makeRequest(
      'POST',
      '/api/care-plans/careplan-123/goals',
      invalidGoalTypePayload
    );
    const invalidGoalTypeHandled = invalidGoalTypeRes.status === 400;
    recordResult(
      'wdvf3abbtf',
      'Invalid goal type rejected',
      invalidGoalTypeHandled,
      invalidGoalTypeHandled ? undefined : `Expected 400, got ${invalidGoalTypeRes.status}`
    );

    // Test 8: Error handling - Invalid date format
    console.log('Test 8: Error handling - Invalid date format');
    const invalidDatePayload = {
      ...validGoalPayload,
      target_date: '03/20/2025', // Wrong format
    };

    const invalidDateRes = await makeRequest(
      'POST',
      '/api/care-plans/careplan-123/goals',
      invalidDatePayload
    );
    const invalidDateHandled = invalidDateRes.status === 400;
    recordResult(
      'wdvf3abbtf',
      'Invalid date format rejected',
      invalidDateHandled,
      invalidDateHandled ? undefined : `Expected 400, got ${invalidDateRes.status}`
    );

    // Test 9: Create goal with minimal fields
    console.log('Test 9: Create goal with minimal fields');
    const minimalPayload = {
      description: 'Simple goal',
      goal_type: 'FUNCTIONAL',
      priority: 'MEDIUM',
    };

    const minimalRes = await makeRequest(
      'POST',
      '/api/care-plans/careplan-123/goals',
      minimalPayload
    );
    const minimalCreated = minimalRes.status === 201;
    recordResult(
      'wdvf3abbtf',
      'Create minimal goal',
      minimalCreated,
      minimalCreated ? undefined : `Expected 201, got ${minimalRes.status}`
    );

    // Test 10: List goals for care plan
    console.log('Test 10: List goals for care plan');
    const listGoalsRes = await makeRequest('GET', '/api/care-plans/careplan-123/goals');
    const listSuccess = listGoalsRes.status === 200 && Array.isArray(listGoalsRes.body.data);
    recordResult(
      'wdvf3abbtf',
      'List goals endpoint',
      listSuccess,
      listSuccess ? undefined : `Expected 200 with array, got ${listGoalsRes.status}`
    );
  } catch (error) {
    recordResult('wdvf3abbtf', 'Feature test suite', false, String(error));
  }
}

// ============================================================================
// Main test runner
// ============================================================================

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   QA Test Suite: Features wdvf3abbw2 & wdvf3abbtf        ║');
  console.log('║   After Blocker Fix (commit b42150d4)                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Run both feature test suites
  await testCreateVisit();
  await testCreateGoal();

  // Summarize results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Test Summary                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const wdvf3abbw2Results = results.filter((r) => r.feature === 'wdvf3abbw2');
  const wdvf3abbtfResults = results.filter((r) => r.feature === 'wdvf3abbtf');

  const wdvf3abbw2Passed = wdvf3abbw2Results.filter((r) => r.passed).length;
  const wdvf3abbw2Total = wdvf3abbw2Results.length;

  const wdvf3abbtfPassed = wdvf3abbtfResults.filter((r) => r.passed).length;
  const wdvf3abbtfTotal = wdvf3abbtfResults.length;

  console.log(`Feature wdvf3abbw2 (Create Visits):`);
  console.log(`  Passed: ${wdvf3abbw2Passed}/${wdvf3abbw2Total}`);
  console.log(
    `  Status: ${wdvf3abbw2Passed === wdvf3abbw2Total ? '✓ PASS' : '✗ FAIL'}`
  );

  console.log(`\nFeature wdvf3abbtf (Create Goals):`);
  console.log(`  Passed: ${wdvf3abbtfPassed}/${wdvf3abbtfTotal}`);
  console.log(
    `  Status: ${wdvf3abbtfPassed === wdvf3abbtfTotal ? '✓ PASS' : '✗ FAIL'}`
  );

  const allPassed =
    wdvf3abbw2Passed === wdvf3abbw2Total && wdvf3abbtfPassed === wdvf3abbtfTotal;

  console.log(`\n${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  console.log(`Total: ${wdvf3abbw2Passed + wdvf3abbtfPassed}/${wdvf3abbw2Total + wdvf3abbtfTotal}`);

  if (allPassed) {
    console.log('\n✓ Both features are READY FOR PRODUCTION MERGE');
  } else {
    console.log('\n✗ Fix failing tests before production merge');
    process.exit(1);
  }
}

// Run tests if this is the main module
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

export { runAllTests };

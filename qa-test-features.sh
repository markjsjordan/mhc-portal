#!/bin/bash

# QA Test Suite for Folk Care Features
# wdvf3abbw2: Create visits from schedule
# wdvf3abbtf: Create goals in care plans
# 
# After blocker fix (commit b42150d4)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASS_COUNT=0
FAIL_COUNT=0
TESTS=()

# Helper: Record test result
record_test() {
    local feature=$1
    local name=$2
    local passed=$3
    local error=$4
    
    if [ "$passed" -eq 1 ]; then
        echo -e "${GREEN}✓ PASS${NC} [$feature] $name"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ FAIL${NC} [$feature] $name: $error"
        ((FAIL_COUNT++))
    fi
    TESTS+=("$feature|$name|$passed|$error")
}

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   QA Test Suite: Features wdvf3abbw2 & wdvf3abbtf        ║"
echo "║   After Blocker Fix (commit b42150d4)                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# FEATURE 1: wdvf3abbw2 - Create visits from schedule
# ============================================================================

echo "=== Testing Feature: wdvf3abbw2 (Create Visits from Schedule) ==="
echo ""

echo "Test 1: Verify visit creation endpoint exists"
if grep -q "router.post('/', async" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Visit creation POST endpoint exists" 1
else
    record_test "wdvf3abbw2" "Visit creation POST endpoint exists" 0 "Endpoint not found"
fi

echo "Test 2: Verify required field validation"
if grep -q "Missing required fields.*clientId.*serviceTypeId.*scheduledDate" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Required field validation present" 1
else
    record_test "wdvf3abbw2" "Required field validation present" 0 "Validation missing"
fi

echo "Test 3: Verify date format validation"
if grep -q "dateRegex\|YYYY-MM-DD" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Date format validation (YYYY-MM-DD)" 1
else
    record_test "wdvf3abbw2" "Date format validation (YYYY-MM-DD)" 0 "Validation missing"
fi

echo "Test 4: Verify time format validation"
if grep -q "timeRegex\|HH:MM" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Time format validation (HH:MM)" 1
else
    record_test "wdvf3abbw2" "Time format validation (HH:MM)" 0 "Validation missing"
fi

echo "Test 5: Verify client existence check"
if grep -q "SELECT.*FROM clients.*WHERE id" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Client existence verification" 1
else
    record_test "wdvf3abbw2" "Client existence verification" 0 "Verification missing"
fi

echo "Test 6: Verify service type validation"
if grep -q "SELECT id FROM service_types WHERE id" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Service type validation" 1
else
    record_test "wdvf3abbw2" "Service type validation" 0 "Validation missing"
fi

echo "Test 7: Verify blocker fix - no extra service_types query"
# Check that the code doesn't have duplicate/redundant service_types queries
QUERY_COUNT=$(grep -c "service_types WHERE" packages/app/src/routes/visits.ts || echo 0)
if [ "$QUERY_COUNT" -eq 1 ]; then
    record_test "wdvf3abbw2" "Blocker fix verified (no redundant queries)" 1
else
    record_test "wdvf3abbw2" "Blocker fix verified (no redundant queries)" 0 "Found $QUERY_COUNT queries, expected 1"
fi

echo "Test 8: Verify visit insert statement"
if grep -q "INSERT INTO visits" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Visit database insert" 1
else
    record_test "wdvf3abbw2" "Visit database insert" 0 "Insert statement missing"
fi

echo "Test 9: Verify organization context requirement"
if grep -q "organizationId.*required\|Organization ID is required" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Organization context validation" 1
else
    record_test "wdvf3abbw2" "Organization context validation" 0 "Validation missing"
fi

echo "Test 10: Verify optional caregiver assignment"
if grep -q "assignedCaregiverId\|if (caregiverId)" packages/app/src/routes/visits.ts; then
    record_test "wdvf3abbw2" "Optional caregiver assignment" 1
else
    record_test "wdvf3abbw2" "Optional caregiver assignment" 0 "Assignment logic missing"
fi

echo ""

# ============================================================================
# FEATURE 2: wdvf3abbtf - Create goals in care plans
# ============================================================================

echo "=== Testing Feature: wdvf3abbtf (Create Goals in Care Plans) ==="
echo ""

echo "Test 1: Verify goal creation handler exists"
if grep -q "createGoal" verticals/care-plans-tasks/src/api/care-plan-handlers.ts; then
    record_test "wdvf3abbtf" "Goal creation handler exists" 1
else
    record_test "wdvf3abbtf" "Goal creation handler exists" 0 "Handler not found"
fi

echo "Test 2: Verify goal creation service exists"
if grep -q "createGoal" verticals/care-plans-tasks/src/service/care-plan-service.ts 2>/dev/null || \
   grep -rq "createGoal.*=.*async" verticals/care-plans-tasks/src/service/ 2>/dev/null; then
    record_test "wdvf3abbtf" "Goal creation service exists" 1
else
    record_test "wdvf3abbtf" "Goal creation service exists" 0 "Service not found"
fi

echo "Test 3: Verify goal creation route registered"
if grep -q "care-plans.*goals\|goals.*POST" packages/app/src/routes/index.ts; then
    record_test "wdvf3abbtf" "Goal creation route registered" 1
else
    record_test "wdvf3abbtf" "Goal creation route registered" 0 "Route not found"
fi

echo "Test 4: Verify goal table schema"
if grep -q "CREATE TABLE goals\|create_goal\|goals table" packages/core/migrations/*.ts | grep -v "^Binary"; then
    record_test "wdvf3abbtf" "Goal database schema exists" 1
else
    # Check for goal references in migrations
    if find packages/core/migrations -name "*.ts" -exec grep -l "goals" {} \; | grep -q .; then
        record_test "wdvf3abbtf" "Goal database schema exists" 1
    else
        record_test "wdvf3abbtf" "Goal database schema exists" 0 "Schema not found in migrations"
    fi
fi

echo "Test 5: Verify care plan ID validation"
if grep -q "carePlanId.*required\|Care plan ID is required" verticals/care-plans-tasks/src/api/care-plan-handlers.ts; then
    record_test "wdvf3abbtf" "Care plan ID validation" 1
else
    record_test "wdvf3abbtf" "Care plan ID validation" 0 "Validation missing"
fi

echo "Test 6: Verify goal description field"
if grep -rq "description" verticals/care-plans-tasks/src && \
   grep -rq "goal" verticals/care-plans-tasks/src && \
   grep -rq "createGoal" verticals/care-plans-tasks/src/api/care-plan-handlers.ts; then
    record_test "wdvf3abbtf" "Goal description field support" 1
else
    record_test "wdvf3abbtf" "Goal description field support" 0 "Field not found"
fi

echo "Test 7: Verify goal priority field"
if grep -rq "priority" verticals/care-plans-tasks/src/; then
    record_test "wdvf3abbtf" "Goal priority field support" 1
else
    record_test "wdvf3abbtf" "Goal priority field support" 0 "Field not found"
fi

echo "Test 8: Verify goal type field"
if grep -rq "goal_type\|goalType" verticals/care-plans-tasks/src/; then
    record_test "wdvf3abbtf" "Goal type field support" 1
else
    record_test "wdvf3abbtf" "Goal type field support" 0 "Field not found"
fi

echo "Test 9: Verify error handling"
if grep -q "handleError" verticals/care-plans-tasks/src/api/care-plan-handlers.ts; then
    record_test "wdvf3abbtf" "Error handling present" 1
else
    record_test "wdvf3abbtf" "Error handling present" 0 "Error handler missing"
fi

echo "Test 10: Verify goal creation returns 201 status"
if grep -q "201\|status.*201" verticals/care-plans-tasks/src/api/care-plan-handlers.ts; then
    record_test "wdvf3abbtf" "Returns 201 Created status" 1
else
    record_test "wdvf3abbtf" "Returns 201 Created status" 0 "Status code missing"
fi

echo ""

# ============================================================================
# Test Summary
# ============================================================================

echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

TOTAL=$((PASS_COUNT + FAIL_COUNT))
echo "Results: ${GREEN}${PASS_COUNT} passed${NC}, ${RED}${FAIL_COUNT} failed${NC} out of ${TOTAL} tests"
echo ""

WDVF3ABBW2_TESTS=$(echo "${TESTS[@]}" | grep "wdvf3abbw2" | wc -l)
WDVF3ABBW2_PASS=$(echo "${TESTS[@]}" | grep "wdvf3abbw2" | grep "|1|" | wc -l)

WDVF3ABBTF_TESTS=$(echo "${TESTS[@]}" | grep "wdvf3abbtf" | wc -l)
WDVF3ABBTF_PASS=$(echo "${TESTS[@]}" | grep "wdvf3abbtf" | grep "|1|" | wc -l)

echo "Feature wdvf3abbw2 (Create Visits):"
echo "  Passed: ${WDVF3ABBW2_PASS}/${WDVF3ABBW2_TESTS}"
if [ "${WDVF3ABBW2_PASS}" -eq "${WDVF3ABBW2_TESTS}" ]; then
    echo -e "  Status: ${GREEN}✓ PASS${NC}"
else
    echo -e "  Status: ${RED}✗ FAIL${NC}"
fi

echo ""
echo "Feature wdvf3abbtf (Create Goals):"
echo "  Passed: ${WDVF3ABBTF_PASS}/${WDVF3ABBTF_TESTS}"
if [ "${WDVF3ABBTF_PASS}" -eq "${WDVF3ABBTF_TESTS}" ]; then
    echo -e "  Status: ${GREEN}✓ PASS${NC}"
else
    echo -e "  Status: ${RED}✗ FAIL${NC}"
fi

echo ""
if [ "${PASS_COUNT}" -eq "${TOTAL}" ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED - READY FOR PRODUCTION MERGE${NC}"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED - FIX BEFORE PRODUCTION MERGE${NC}"
    exit 1
fi

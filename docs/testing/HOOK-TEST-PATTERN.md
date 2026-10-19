# Hook Testing Pattern Guide

## Problem: Test Timeouts with React Query Hooks

Hook tests using `@tanstack/react-query` often timeout due to async mock issues and improper QueryClient lifecycle management.

## Root Causes

1. **Wrapper Closure Scope**: Defining wrapper outside `beforeEach` but referencing `queryClient` created inside causes stale closures
2. **Missing QueryClient Cleanup**: State persists across tests without proper cleanup
3. **Async Mock Timing**: Mocks not properly resolved in test lifecycle
4. **Missing Error Mocks**: Tests expect errors but don't configure mocks to throw
5. **Retry Loops**: Default retry behavior causes tests to hang waiting for retries

## General Pattern for React Query Hook Tests

### 1. Setup Pattern

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useYourHook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create fresh QueryClient with NO retries to avoid timeouts
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { 
          retry: false,        // Disable retry to prevent hanging
          gcTime: 0,          // Disable garbage collection delay
        },
        mutations: { 
          retry: false,        // Disable mutation retry
        },
      },
    });

    // Reset all mocks
    mockClient.get.mockReset();
    mockClient.put.mockReset();

    // Setup default successful responses
    mockClient.get.mockResolvedValue({ 
      success: true, 
      data: { /* mock data */ } 
    });
  });

  afterEach(() => {
    // CRITICAL: Clean up QueryClient to prevent state leakage
    queryClient.clear();
  });

  // Create wrapper INSIDE test scope to capture current queryClient
  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
});
```

### 2. Test Pattern

```typescript
it('should fetch data on mount', async () => {
  const { result } = renderHook(() => useYourHook(), { 
    wrapper: createWrapper()  // Call wrapper creator
  });

  expect(result.current.isLoading).toBe(true);

  // Always use waitFor with explicit timeout
  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  }, { timeout: 5000 });

  expect(result.current.data).toBeDefined();
  expect(mockClient.get).toHaveBeenCalledWith('/api/endpoint');
});
```

### 3. Error Testing Pattern

```typescript
it('should handle errors during fetch', async () => {
  // MUST mock the error BEFORE rendering the hook
  mockClient.get.mockRejectedValueOnce(new Error('Network error'));

  const { result } = renderHook(() => useYourHook(), { 
    wrapper: createWrapper() 
  });

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  }, { timeout: 5000 });

  expect(result.current.isError).toBe(true);
  expect(result.current.error).toBeDefined();
});
```

### 4. Mutation Testing Pattern

```typescript
it('should update data', async () => {
  const { result } = renderHook(() => useYourHook(), { 
    wrapper: createWrapper() 
  });

  // Wait for initial load
  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  }, { timeout: 5000 });

  // Perform mutation inside act
  act(() => {
    result.current.mutate({ field: 'new value' });
  });

  // Wait for mutation to complete
  await waitFor(() => {
    expect(result.current.isUpdating).toBe(false);
  }, { timeout: 5000 });

  expect(result.current.updateSuccess).toBe(true);
  expect(mockClient.put).toHaveBeenCalledWith(
    '/api/endpoint',
    expect.objectContaining({ field: 'new value' })
  );
});
```

### 5. Async Mutation Pattern

```typescript
it('should support mutateAsync', async () => {
  const { result } = renderHook(() => useYourHook(), { 
    wrapper: createWrapper() 
  });

  await waitFor(() => {
    expect(result.current.data).toBeDefined();
  }, { timeout: 5000 });

  // Wrap async mutation in act
  const response = await act(async () => {
    return await result.current.updateAsync({ field: 'value' });
  });

  expect(response.success).toBe(true);
  expect(response.data.field).toBe('value');
});
```

## Non-React Query Hook Patterns

### Timer/Fake Timer Pattern

For hooks using timers (debounce, polling, etc.):

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

describe('useTimerHook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Setup default mocks
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should handle timer-based operations', async () => {
    const { result } = renderHook(() => useTimerHook());

    const promise = result.current.checkSomething();
    
    // Run all pending timers
    await vi.runAllTimersAsync();
    
    // Wait for the promise
    await promise;

    await waitFor(() => {
      expect(result.current.status).toBe('complete');
    }, { timeout: 3000 });
  });
});
```

### Zustand Store Pattern

For hooks using Zustand (synchronous, no special handling needed):

```typescript
describe('useStoreHook', () => {
  beforeEach(() => {
    const store = useMyStore.getState();
    store.reset(); // Reset to initial state
    localStorage.removeItem('store-key'); // Clear persistence
  });

  it('should update store state', () => {
    const { result } = renderHook(() => useMyStore());

    act(() => {
      result.current.updateField('value');
    });

    expect(result.current.field).toBe('value');
  });
});
```

## Common Pitfalls to Avoid

### ❌ DON'T: Wrapper defined outside beforeEach

```typescript
// BAD - stale closure
const wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  queryClient = new QueryClient(); // This doesn't update the wrapper
});
```

### ✅ DO: Create wrapper inside test scope

```typescript
const createWrapper = () => {
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};
```

### ❌ DON'T: Forget to cleanup QueryClient

```typescript
// BAD - state leaks between tests
beforeEach(() => {
  queryClient = new QueryClient();
});
```

### ✅ DO: Always cleanup

```typescript
afterEach(() => {
  queryClient.clear();
});
```

### ❌ DON'T: Test errors without mocking them

```typescript
// BAD - expects error but mock returns success
it('should handle errors', async () => {
  const { result } = renderHook(() => useHook());
  
  await waitFor(() => {
    expect(result.current.error).toBeDefined(); // Never happens!
  });
});
```

### ✅ DO: Mock the error first

```typescript
it('should handle errors', async () => {
  mockClient.get.mockRejectedValueOnce(new Error('Failed'));
  
  const { result } = renderHook(() => useHook());
  
  await waitFor(() => {
    expect(result.current.isError).toBe(true);
  }, { timeout: 5000 });
});
```

### ❌ DON'T: Use default retry behavior in tests

```typescript
// BAD - will retry 3 times by default, causing delays/timeouts
queryClient = new QueryClient();
```

### ✅ DO: Disable retries in tests

```typescript
queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});
```

## Timeout Configuration

Always specify explicit timeouts in `waitFor`:

```typescript
await waitFor(() => {
  expect(result.current.isLoading).toBe(false);
}, { timeout: 5000 }); // Explicit 5-second timeout
```

Default vitest timeout is 10 seconds. If tests hang longer, they'll timeout completely.

## Debugging Hanging Tests

1. **Check mock setup**: Are mocks resolving or rejecting properly?
2. **Check wrapper scope**: Is the wrapper capturing the current queryClient?
3. **Check cleanup**: Is `queryClient.clear()` in afterEach?
4. **Check retries**: Are retries disabled in QueryClient config?
5. **Check async operations**: Are all promises properly awaited?
6. **Check fake timers**: If using `vi.useFakeTimers()`, are you running them with `vi.runAllTimersAsync()`?

## Quick Checklist

- [ ] QueryClient created in `beforeEach` with `retry: false`
- [ ] QueryClient cleaned up in `afterEach` with `queryClient.clear()`
- [ ] Wrapper created via function called inside test, not static closure
- [ ] All mocks reset in `beforeEach`
- [ ] Error tests mock the error before rendering
- [ ] All `waitFor` calls have explicit timeout
- [ ] Mutations wrapped in `act()`
- [ ] Async mutations use `act(async () => ...)`
- [ ] Fake timers properly advanced with `vi.runAllTimersAsync()`

## Files Fixed

This pattern has been applied to:

1. `/packages/web/src/hooks/__tests__/useUserProfile.test.tsx` - React Query hook with queries and mutations
2. `/packages/web/src/hooks/__tests__/useConnectionStatus.test.ts` - Hook with fake timers and fetch

Apply this pattern to any new hook tests involving async operations.

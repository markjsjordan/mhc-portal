import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useIdleLogout, IDLE_LOGOUT_TIMEOUT_MS } from '../useIdleLogout';

const mockClearLocalAuth = vi.fn();
const mockServerLogout = vi.fn();
const mockNavigate = vi.fn();
let mockIsAuthenticated = true;

vi.mock('../auth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    logout: mockClearLocalAuth,
  }),
}));

vi.mock('../api', () => ({
  useAuthService: () => ({ logout: mockServerLogout }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe('useIdleLogout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockIsAuthenticated = true;
    mockClearLocalAuth.mockReset();
    mockServerLogout.mockReset().mockResolvedValue(undefined);
    mockNavigate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing while idle under the timeout', () => {
    renderHook(() => useIdleLogout(), { wrapper });

    act(() => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS - 1000);
    });

    expect(mockServerLogout).not.toHaveBeenCalled();
    expect(mockClearLocalAuth).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('logs out and redirects to /login after the idle timeout elapses', async () => {
    renderHook(() => useIdleLogout(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockServerLogout).toHaveBeenCalledTimes(1);
    expect(mockClearLocalAuth).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('still logs out locally and redirects if the server call fails', async () => {
    mockServerLogout.mockRejectedValueOnce(new Error('network error'));

    renderHook(() => useIdleLogout(), { wrapper });

    await act(async () => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockClearLocalAuth).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('resets the timer on user activity (mousemove)', async () => {
    renderHook(() => useIdleLogout(), { wrapper });

    act(() => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS - 1000);
      window.dispatchEvent(new Event('mousemove'));
    });

    act(() => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS - 1000);
    });

    // Still within the reset window, should not have logged out yet
    expect(mockServerLogout).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockServerLogout).toHaveBeenCalledTimes(1);
  });

  it('does not start a timer when not authenticated', () => {
    mockIsAuthenticated = false;

    renderHook(() => useIdleLogout(), { wrapper });

    act(() => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS + 1000);
    });

    expect(mockServerLogout).not.toHaveBeenCalled();
    expect(mockClearLocalAuth).not.toHaveBeenCalled();
  });

  it('clears the timer and listeners on unmount (no leaks)', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useIdleLogout(), { wrapper });
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    act(() => {
      vi.advanceTimersByTime(IDLE_LOGOUT_TIMEOUT_MS + 1000);
    });
    expect(mockServerLogout).not.toHaveBeenCalled();

    removeEventListenerSpy.mockRestore();
  });
});

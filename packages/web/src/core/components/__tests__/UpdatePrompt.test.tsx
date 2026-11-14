import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { UpdatePrompt } from '../UpdatePrompt';

let mockNeedRefresh = false;
const mockSetNeedRefresh = vi.fn((val: boolean) => {
  mockNeedRefresh = val;
});
const mockUpdateServiceWorker = vi.fn().mockResolvedValue(undefined);
let mockRegistration: any = null;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (options?: any) => {
    if (options?.onRegistered && mockRegistration) {
      options.onRegistered(mockRegistration);
    }
    return {
      needRefresh: [mockNeedRefresh, mockSetNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateServiceWorker,
    };
  },
}));

describe('UpdatePrompt', () => {
  const originalLocation = window.location;
  const originalServiceWorker = navigator.serviceWorker;
  const originalCaches = window.caches;
  const originalIndexedDB = window.indexedDB;

  let reloadMock: ReturnType<typeof vi.fn>;
  let swListeners: Record<string, Array<() => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedRefresh = false;
    mockUpdateServiceWorker.mockResolvedValue(undefined);
    mockRegistration = {
      update: vi.fn().mockResolvedValue(undefined),
      unregister: vi.fn().mockResolvedValue(true),
      waiting: null,
      installing: null,
    };

    reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    swListeners = {};
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn((event: string, cb: () => void) => {
          swListeners[event] = swListeners[event] ?? [];
          swListeners[event].push(cb);
        }),
        removeEventListener: vi.fn((event: string, cb: () => void) => {
          swListeners[event] = (swListeners[event] ?? []).filter((fn) => fn !== cb);
        }),
        getRegistration: vi.fn().mockResolvedValue(mockRegistration),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    });
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: originalCaches,
    });
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: originalIndexedDB,
    });
  });

  it('renders nothing when needRefresh is false', () => {
    mockNeedRefresh = false;
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a friendly update toast when needRefresh is true', () => {
    mockNeedRefresh = true;
    render(<UpdatePrompt />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Update available')).toBeInTheDocument();
    expect(screen.getByText(/A new version of MHC Portal is ready/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /later/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close update notification/i })).toBeInTheDocument();
  });

  it('invokes updateServiceWorker(true) and onUpdate when clicking "Update now"', async () => {
    mockNeedRefresh = true;
    const onUpdate = vi.fn();
    render(<UpdatePrompt onUpdate={onUpdate} />);

    const updateBtn = screen.getByRole('button', { name: /update now/i });
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('dismisses the prompt when clicking "Later"', () => {
    mockNeedRefresh = true;
    const onDismiss = vi.fn();
    render(<UpdatePrompt onDismiss={onDismiss} />);

    const laterBtn = screen.getByRole('button', { name: /later/i });
    fireEvent.click(laterBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('dismisses the prompt when clicking the close button', () => {
    mockNeedRefresh = true;
    const onDismiss = vi.fn();
    render(<UpdatePrompt onDismiss={onDismiss} />);

    const closeBtn = screen.getByRole('button', { name: /close update notification/i });
    fireEvent.click(closeBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSetNeedRefresh).toHaveBeenCalledWith(false);
  });

  it('posts SKIP_WAITING to waiting worker and reloads only after controllerchange when fallback timeout fires', async () => {
    vi.useFakeTimers();
    mockNeedRefresh = true;
    const postMessage = vi.fn();
    mockRegistration.waiting = { postMessage };

    render(<UpdatePrompt />);

    const updateBtn = screen.getByRole('button', { name: /update now/i });
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    expect(reloadMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadMock).not.toHaveBeenCalled();

    await act(async () => {
      for (const cb of swListeners.controllerchange ?? []) {
        cb();
      }
    });

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('last-resort unregister path clears precache without touching IndexedDB folkcare_offline', async () => {
    vi.useFakeTimers();
    mockNeedRefresh = true;
    mockRegistration.waiting = null;
    mockRegistration.installing = null;

    const deleteCacheMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'other-cache']),
        delete: deleteCacheMock,
      },
    });

    const deleteDatabaseMock = vi.fn();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: deleteDatabaseMock,
      },
    });

    render(<UpdatePrompt />);

    const updateBtn = screen.getByRole('button', { name: /update now/i });
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(mockRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(deleteCacheMock).toHaveBeenCalledWith('workbox-precache-v2');
    expect(deleteCacheMock).not.toHaveBeenCalledWith('other-cache');
    expect(deleteDatabaseMock).not.toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('shows inline retry state and does not reload when updateServiceWorker rejects', async () => {
    mockNeedRefresh = true;
    mockUpdateServiceWorker.mockRejectedValueOnce(new Error('SW failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<UpdatePrompt />);

    const updateBtn = screen.getByRole('button', { name: /update now/i });
    await act(async () => {
      fireEvent.click(updateBtn);
    });

    expect(screen.getByText('Update failed, tap to retry')).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PWA] Service worker update failed:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  it('prevents double click from sending multiple updates', async () => {
    mockNeedRefresh = true;
    let resolveUpdate!: () => void;
    mockUpdateServiceWorker.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<UpdatePrompt />);

    const updateBtn = screen.getByRole('button', { name: /update now/i });
    await act(async () => {
      fireEvent.click(updateBtn);
      fireEvent.click(updateBtn);
    });

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(updateBtn).toBeDisabled();

    await act(async () => {
      resolveUpdate();
    });
  });

  it('clears the periodic update interval on unmount', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    mockNeedRefresh = true;

    const { unmount } = render(<UpdatePrompt />);
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});

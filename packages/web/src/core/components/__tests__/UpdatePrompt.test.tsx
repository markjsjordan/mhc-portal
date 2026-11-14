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
    if (options?.onRegistered) {
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
      value: { ...window.location, reload: reloadMock },
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
        getRegistration: vi.fn(async () => mockRegistration),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it('posts SKIP_WAITING to waiting worker and reloads on controllerchange when fallback triggers', async () => {
    vi.useFakeTimers();
    mockNeedRefresh = true;
    const postMessage = vi.fn(() => {
      for (const cb of swListeners['controllerchange'] ?? []) {
        cb();
      }
    });
    mockRegistration.waiting = { postMessage };

    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /update now/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('unregisters and clears precache (never IndexedDB folkcare_offline) when no waiting/installing worker exists', async () => {
    vi.useFakeTimers();
    mockNeedRefresh = true;
    mockRegistration.waiting = null;
    mockRegistration.installing = null;

    const deleteCache = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'other-cache']),
        delete: deleteCache,
      },
    });
    const deleteDatabase = vi.fn();
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: { deleteDatabase },
    });

    render(<UpdatePrompt />);
    fireEvent.click(screen.getByRole('button', { name: /update now/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });

    expect(mockRegistration.unregister).toHaveBeenCalledTimes(1);
    expect(deleteCache).toHaveBeenCalledWith('workbox-precache-v2');
    expect(deleteCache).not.toHaveBeenCalledWith('other-cache');
    expect(deleteDatabase).not.toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('shows retry state and does not reload when updateServiceWorker rejects', async () => {
    mockNeedRefresh = true;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockUpdateServiceWorker.mockRejectedValueOnce(new Error('SW failed'));

    render(<UpdatePrompt />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /update now/i }));
    });

    expect(screen.getByText('Update failed, tap to retry.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry update/i })).toBeInTheDocument();
    expect(reloadMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PWA]'),
      expect.any(Error),
    );
  });

  it('ignores double clicks while an update is in flight', async () => {
    mockNeedRefresh = true;
    let resolveUpdate!: () => void;
    mockUpdateServiceWorker.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = resolve;
        }),
    );

    render(<UpdatePrompt />);
    const btn = screen.getByRole('button', { name: /update now/i });
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    expect(mockUpdateServiceWorker).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();

    resolveUpdate();
  });

  it('clears the periodic update interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    mockNeedRefresh = true;
    const { unmount } = render(<UpdatePrompt />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});

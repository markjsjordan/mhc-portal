import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ForceUpdate, performForceUpdate } from '../ForceUpdate';

describe('ForceUpdate', () => {
  const originalCaches = globalThis.caches;
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
      writable: true,
    });
  });

  it('unregisters service workers and clears all caches including precache', async () => {
    const unregisterMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister: unregisterMock }]),
      },
      configurable: true,
      writable: true,
    });

    const deleteMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'caches', {
      value: {
        keys: vi.fn().mockResolvedValue(['workbox-precache-v2', 'image-cache']),
        delete: deleteMock,
      },
      configurable: true,
      writable: true,
    });

    const result = await performForceUpdate();

    expect(unregisterMock).toHaveBeenCalledTimes(1);
    expect(result.unregisteredCount).toBe(1);
    expect(deleteMock).toHaveBeenCalledWith('workbox-precache-v2');
    expect(deleteMock).toHaveBeenCalledWith('image-cache');
    expect(result.cachesCleared).toEqual(['workbox-precache-v2', 'image-cache']);
  });

  it('runs cleanup and invokes redirect on mount', async () => {
    const onRedirect = vi.fn();

    render(<ForceUpdate onRedirect={onRedirect} />);

    expect(screen.getByTestId('force-update-page')).toBeInTheDocument();
    expect(screen.getByTestId('force-update-version')).toHaveTextContent(/v\S+/);

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledTimes(1);
    });
    expect(onRedirect.mock.calls[0]?.[0]).toMatch(/^\/\?updated=\d+$/);
  });
});

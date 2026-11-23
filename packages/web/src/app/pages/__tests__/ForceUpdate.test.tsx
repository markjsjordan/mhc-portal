import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ForceUpdate, performForceUpdate } from '../ForceUpdate';

describe('performForceUpdate', () => {
  const originalCaches = globalThis.caches;
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    vi.restoreAllMocks();
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
    });
  });

  it('unregisters all service workers and clears all caches including precache', async () => {
    const unregisterMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([{ unregister: unregisterMock }]),
      },
      configurable: true,
    });

    const deleteMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(globalThis, 'caches', {
      value: {
        keys: vi
          .fn()
          .mockResolvedValue(['workbox-precache-v2-abc', 'image-cache']),
        delete: deleteMock,
      },
      configurable: true,
      writable: true,
    });

    const result = await performForceUpdate();

    expect(unregisterMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith('workbox-precache-v2-abc');
    expect(deleteMock).toHaveBeenCalledWith('image-cache');
    expect(result.unregisteredWorkers).toBe(1);
    expect(result.cachesCleared).toEqual([
      'workbox-precache-v2-abc',
      'image-cache',
    ]);
  });
});

describe('ForceUpdate component', () => {
  it('renders updating status and redirects to root with cache-busting query', async () => {
    const onRedirect = vi.fn();

    render(<ForceUpdate onRedirect={onRedirect} />);

    expect(screen.getByTestId('force-update-page')).toBeInTheDocument();
    expect(screen.getByText('Updating MHC Portal...')).toBeInTheDocument();

    await waitFor(() => {
      expect(onRedirect).toHaveBeenCalledTimes(1);
    });

    const redirectUrl = onRedirect.mock.calls[0]?.[0] as string;
    expect(redirectUrl).toMatch(/^\/\?_updated=\d+$/);
  });
});

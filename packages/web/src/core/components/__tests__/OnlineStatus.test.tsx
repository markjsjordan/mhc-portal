import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OnlineStatus } from '../OnlineStatus';

describe('OnlineStatus', () => {
  let onlineGetter: any;

  beforeEach(() => {
    // Mock navigator.onLine
    onlineGetter = vi.spyOn(window.navigator, 'onLine', 'get');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not render when online', () => {
    onlineGetter.mockReturnValue(true);
    const { container } = render(<OnlineStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('should render offline banner when offline', () => {
    onlineGetter.mockReturnValue(false);
    render(<OnlineStatus />);
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByText(/you are currently offline/i)).toBeInTheDocument();
  });

  it('should show banner when going offline', () => {
    onlineGetter.mockReturnValue(true);
    const { rerender } = render(<OnlineStatus />);
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();

    // Simulate going offline
    onlineGetter.mockReturnValue(false);
    window.dispatchEvent(new Event('offline'));
    rerender(<OnlineStatus />);

    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });

  it('should hide banner when going online', () => {
    onlineGetter.mockReturnValue(false);
    const { rerender } = render(<OnlineStatus />);
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();

    // Simulate going online
    onlineGetter.mockReturnValue(true);
    window.dispatchEvent(new Event('online'));
    rerender(<OnlineStatus />);

    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
  });
});

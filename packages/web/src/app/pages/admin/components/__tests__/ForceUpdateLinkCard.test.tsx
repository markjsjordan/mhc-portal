import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForceUpdateLinkCard } from '../ForceUpdateLinkCard';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ForceUpdateLinkCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the deterministic force-update URL and copies it to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(<ForceUpdateLinkCard origin="https://mhc-family-portal.vercel.app" />);

    expect(screen.getByTestId('force-update-link-section')).toBeInTheDocument();
    const input = screen.getByTestId('force-update-url-input') as HTMLInputElement;
    expect(input.value).toBe('https://mhc-family-portal.vercel.app/force-update');

    fireEvent.click(screen.getByTestId('copy-force-update-link-btn'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('https://mhc-family-portal.vercel.app/force-update');
    });
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });
});

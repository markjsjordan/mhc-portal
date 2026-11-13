import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const getMock = vi.fn();
const postMock = vi.fn();
const stableClient = { get: getMock, post: postMock };
vi.mock('@/core/hooks/api.js', () => ({
  // Stable identity: a fresh object per render would re-trigger the fetch effect forever.
  useApiClient: () => stableClient,
}));

import { SystemActivityPage } from '../SystemActivityPage.js';

const ROW = {
  id: 'evt-1',
  timestamp: '2026-01-02T03:04:05.000Z',
  actor: { id: 'u-1', name: 'Real Actor', email: 'a@example.test', role: 'ORG_ADMIN' },
  action: 'VIEW_CLIENT_RECORD',
  eventType: 'DATA_ACCESS',
  resourceType: 'CLIENT',
  resourceId: 'c-1',
  phiAccessed: true,
  result: 'SUCCESS',
  ipAddress: '10.0.0.1',
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/activity']}>
      <Routes>
        <Route path="/admin/activity" element={<SystemActivityPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('SystemActivityPage (wdvf3acxk9)', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('renders real events returned by the API', async () => {
    getMock.mockResolvedValue({ data: { events: [ROW], total: 1, limit: 100, offset: 0 } });
    renderPage();
    expect(screen.getByText('System Activity & Audit Logs')).toBeInTheDocument();
    expect(await screen.findByText('VIEW_CLIENT_RECORD')).toBeInTheDocument();
    expect(screen.getByText('Real Actor')).toBeInTheDocument();
    expect(screen.queryByText(/Eleanor Vance/i)).not.toBeInTheDocument();
  });

  it('shows an empty state with zero events', async () => {
    getMock.mockResolvedValue({ data: { events: [], total: 0, limit: 100, offset: 0 } });
    renderPage();
    expect(await screen.findByText('No audit events in this range')).toBeInTheDocument();
  });

  it('shows an error state when the API fails', async () => {
    getMock.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByText(/Failed to load audit logs/i)).toBeInTheDocument();
  });

  it('requests ePHI-only server-side when toggled', async () => {
    getMock.mockResolvedValue({ data: { events: [ROW], total: 1, limit: 100, offset: 0 } });
    renderPage();
    await screen.findByText('VIEW_CLIENT_RECORD');
    fireEvent.click(screen.getByText('Filter ePHI Access'));
    await waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith(expect.stringContaining('phiOnly=true'))
    );
  });

  it('does not claim an export was logged when logging fails', async () => {
    getMock.mockResolvedValue({ data: { events: [ROW], total: 1, limit: 100, offset: 0 } });
    postMock.mockRejectedValue(new Error('fail'));
    renderPage();
    await screen.findByText('VIEW_CLIENT_RECORD');
    fireEvent.click(screen.getByText('Export Audit Pack (CSV)'));
    expect(await screen.findByText(/Export blocked/i)).toBeInTheDocument();
    expect(screen.queryByText(/recorded in the audit log/i)).not.toBeInTheDocument();
  });
});

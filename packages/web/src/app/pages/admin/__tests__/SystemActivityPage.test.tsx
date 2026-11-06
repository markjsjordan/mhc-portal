import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SystemActivityPage } from '../SystemActivityPage.js';

describe('SystemActivityPage (wdvf3acfj1)', () => {
  it('renders system activity header and audit trail records', () => {
    render(
      <MemoryRouter initialEntries={['/admin/activity']}>
        <Routes>
          <Route path="/admin/activity" element={<SystemActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('System Activity & Audit Logs')).toBeInTheDocument();
    expect(
      screen.getByText(/Immutable system audit trails and ePHI access inspection/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Export Audit Pack (CSV)')).toBeInTheDocument();
    expect(screen.getByText('VIEW_CLIENT_RECORD')).toBeInTheDocument();
    expect(screen.getAllByText(/Eleanor Vance/i).length).toBeGreaterThan(0);
  });

  it('filters by ePHI access when clicking ePHI toggle', () => {
    render(
      <MemoryRouter initialEntries={['/admin/activity']}>
        <Routes>
          <Route path="/admin/activity" element={<SystemActivityPage />} />
        </Routes>
      </MemoryRouter>
    );

    const phiFilterBtn = screen.getByText('Filter ePHI Access');
    fireEvent.click(phiFilterBtn);

    expect(screen.getByText('Showing ePHI Access Only')).toBeInTheDocument();
    expect(screen.getByText('VIEW_CLIENT_RECORD')).toBeInTheDocument();
    expect(screen.queryByText('EVV_CLOCK_IN')).not.toBeInTheDocument();
  });
});

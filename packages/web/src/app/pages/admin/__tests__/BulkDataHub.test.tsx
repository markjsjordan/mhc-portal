import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { BulkDataHub } from '../BulkDataHub.js';

describe('BulkDataHub', () => {
  it('should render bulk data hub header and tabs', () => {
    render(
      <MemoryRouter initialEntries={['/admin/data']}>
        <Routes>
          <Route path="/admin/data" element={<BulkDataHub />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Bulk Data Hub & Regulatory Export')).toBeInTheDocument();
    expect(
      screen.getByText('Import agency records from legacy platforms or generate state survey audit packs.')
    ).toBeInTheDocument();
    expect(screen.getByText('Bulk CSV Import Wizard')).toBeInTheDocument();
    expect(screen.getByText('Regulatory Audit Pack Export')).toBeInTheDocument();
  });

  it('renders without 404', () => {
    render(
      <MemoryRouter initialEntries={['/admin/data']}>
        <Routes>
          <Route path="/admin/data" element={<BulkDataHub />} />
          <Route path="*" element={<div>Not Found</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Not Found')).not.toBeInTheDocument();
  });
});

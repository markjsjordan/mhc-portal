import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithQueryClient } from '@/test/renderWithQueryClient';
import ClientIntakeWorkflow from '../ClientIntakeWorkflow';
import { BrowserRouter } from 'react-router-dom';

vi.mock('@/core/hooks', () => ({
  useAuth: () => ({ user: { id: 'test-user', organizationId: 'test-org', branchIds: ['branch-1'] } }),
}));

vi.mock('@/verticals/client-demographics/hooks', () => ({
  useCreateClient: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'new-client-id' }) }),
  useUpdateClient: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: 'updated-client-id' }) }),
  useClients: () => ({ data: { items: [{ id: 'client-1', branchId: 'branch-1' }] } }),
  useBranches: () => ({ data: [{ id: 'branch-1', name: 'Main Branch', code: 'MB' }] }),
}));

const USPS_50 = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

describe('ClientIntakeWorkflow - Step 1 State selector (50 U.S. states)', () => {
  const openStateOptions = () => {
    renderWithQueryClient(<BrowserRouter><ClientIntakeWorkflow /></BrowserRouter>);
    fireEvent.click(screen.getByRole('combobox', { name: /state/i }) ?? screen.getByText('Select State'));
    const listbox = screen.getByRole('listbox');
    return within(listbox).getAllByRole('option').map((o) => o.textContent ?? '');
  };

  it('offers exactly the 50 USPS state codes (no duplicates)', () => {
    const labels = openStateOptions();
    expect(labels).toHaveLength(50);
    const codes = labels.map((l) => (l.match(/\(([A-Z]{2})\)/) ?? [])[1]);
    expect(new Set(codes).size).toBe(50);
    expect([...codes].sort()).toEqual([...USPS_50].sort());
  });

  it('excludes DC and U.S. territories', () => {
    const codes = openStateOptions().map((l) => (l.match(/\(([A-Z]{2})\)/) ?? [])[1]);
    for (const out of ['DC', 'PR', 'GU', 'VI', 'AS', 'MP']) expect(codes).not.toContain(out);
  });

  it('includes WA, which the old 7-state list lacked', () => {
    const codes = openStateOptions().map((l) => (l.match(/\(([A-Z]{2})\)/) ?? [])[1]);
    expect(codes).toContain('WA');
  });
});

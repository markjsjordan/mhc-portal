import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InviteMemberForm } from '../InviteMemberForm';

describe('InviteMemberForm role options (wdvf3acxk6)', () => {
  it('does not offer portal-derived roles CAREGIVER or FAMILY', () => {
    const { container } = render(<InviteMemberForm onSubmit={vi.fn()} />);
    const values = Array.from(container.querySelectorAll('option, input[type="checkbox"], input[type="radio"]')).map(
      (el) => (el as HTMLInputElement).value
    );
    expect(values.length).toBeGreaterThan(0);
    expect(values).not.toContain('CAREGIVER');
    expect(values).not.toContain('FAMILY');
    expect(values).toContain('COORDINATOR');
  });
});

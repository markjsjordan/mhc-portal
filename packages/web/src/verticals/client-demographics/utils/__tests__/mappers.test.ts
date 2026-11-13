import { describe, it, expect } from 'vitest';
import { mapClientToIntakeData } from '../mappers';
import type { Client } from '../../types/client';

const FIXED = '2026-11-01T12:00:00.000Z';

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1',
    organizationId: 'org-1',
    branchId: 'branch-1',
    firstName: 'Jane',
    lastName: 'Doe',
    dateOfBirth: '1950-03-04',
    primaryPhone: { number: '(512) 555-1212', type: 'HOME', canReceiveSMS: true },
    primaryAddress: {
      type: 'HOME',
      line1: '1 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
    emergencyContacts: [],
    status: 'ACTIVE',
    createdAt: FIXED,
    updatedAt: FIXED,
    ...overrides,
  } as Client;
}

describe('mapClientToIntakeData', () => {
  it('maps saved emergency contacts back into the form with their identity and flags', () => {
    const data = mapClientToIntakeData(
      makeClient({
        emergencyContacts: [
          {
            id: 'ec-1',
            name: 'Sam Smith',
            relationship: 'Son',
            phone: { number: '5125550000', type: 'WORK', canReceiveSMS: true },
            email: 'sam@example.test',
            isPrimary: false,
            canMakeHealthcareDecisions: true,
            notes: 'Call after 5pm',
          },
        ],
      })
    );

    expect(data.emergencyContacts).toEqual([
      {
        id: 'ec-1',
        name: 'Sam Smith',
        relationship: 'Son',
        phone: '5125550000',
        isPrimary: false,
        canMakeHealthcareDecisions: true,
        phoneType: 'WORK',
        canReceiveSMS: true,
        email: 'sam@example.test',
        notes: 'Call after 5pm',
      },
    ]);
  });

  it('does not throw for a client saved without an address and returns blank address fields', () => {
    const client = makeClient();
    // The API can return no address even though the type says it is required.
    (client as unknown as { primaryAddress?: unknown }).primaryAddress = undefined;

    const data = mapClientToIntakeData(client);

    expect(data.address).toEqual({ line1: '', line2: '', city: '', state: '', postalCode: '' });
  });

  it('does not throw when emergencyContacts is missing from the response', () => {
    const client = makeClient();
    (client as unknown as { emergencyContacts?: unknown }).emergencyContacts = undefined;

    expect(mapClientToIntakeData(client).emergencyContacts).toEqual([]);
  });

  it('carries the saved primary phone type and SMS flag', () => {
    const data = mapClientToIntakeData(makeClient());

    expect(data.phone).toBe('(512) 555-1212');
    expect(data.phoneType).toBe('HOME');
    expect(data.phoneCanReceiveSMS).toBe(true);
  });

  it('omits phone type fields when the client has no phone', () => {
    const data = mapClientToIntakeData(makeClient({ primaryPhone: undefined }));

    expect(data.phone).toBe('');
    expect(data).not.toHaveProperty('phoneType');
    expect(data).not.toHaveProperty('phoneCanReceiveSMS');
  });
});

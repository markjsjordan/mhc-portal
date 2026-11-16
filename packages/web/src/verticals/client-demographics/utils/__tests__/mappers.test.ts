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

  it('maps all 5 intake Part B lanes from saved Client', () => {
    const data = mapClientToIntakeData(
      makeClient({
        consents: {
          careAgreement: true,
          hipaa: true,
          financialResponsibility: true,
          evv: true,
          signature: 'Jane Doe',
          signedDate: '2026-11-15',
        },
        primaryPhysician: {
          name: 'Dr. House',
          phone: { number: '5125550000', type: 'WORK', isPrimary: true },
        },
        insurance: [
          {
            type: 'MEDICAID',
            policyNumber: 'MEM-999',
            groupNumber: 'GRP-111',
            isPrimary: true,
          },
        ],
        authorizationInfo: {
          number: 'AUTH-123',
          approvedHours: 20,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        },
        assessmentData: {
          mobility: 'walker',
          cognitive: 'mild',
          conditions: ['Diabetes'],
          medications: [{ name: 'Metformin', dosage: '500mg', frequency: 'BID' }],
          allergies: ['Penicillin'],
          dietaryNeeds: 'Low sodium',
        },
        carePlanSummary: {
          serviceTypes: ['Personal Care'],
          visitFrequency: '3xweek',
          visitDuration: 2,
          preferredTimes: ['Morning'],
          tasks: ['Bathing'],
          goals: 'Maintain independence',
        },
        visitSchedule: {
          scheduleStartDate: '2026-11-20',
          visitSchedule: [{ dayOfWeek: 1, time: '09:00', duration: 2 }],
        },
        caregiverAssignment: {
          primaryCaregiver: 'cg-1',
          backupCaregivers: ['cg-2'],
          preferences: { gender: 'female', language: ['English', 'Spanish'] },
        },
      })
    );

    expect(data.consents).toEqual({
      careAgreement: true,
      hipaa: true,
      financialResponsibility: true,
      evv: true,
    });
    expect(data.signature).toBe('Jane Doe');
    expect(data.signedDate).toBe('2026-11-15');
    expect(data.physician).toEqual({ name: 'Dr. House', phone: '5125550000' });
    expect(data.insurance).toEqual({ type: 'medicaid', memberId: 'MEM-999', groupNumber: 'GRP-111' });
    expect(data.authorization).toEqual({
      number: 'AUTH-123',
      approvedHours: 20,
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
    });
    expect(data.mobility).toBe('walker');
    expect(data.cognitive).toBe('mild');
    expect(data.conditions).toEqual(['Diabetes']);
    expect(data.allergies).toEqual(['Penicillin']);
    expect(data.dietaryNeeds).toBe('Low sodium');
    expect(data.serviceTypes).toEqual(['Personal Care']);
    expect(data.visitFrequency).toBe('3xweek');
    expect(data.scheduleStartDate).toBe('2026-11-20');
    expect(data.visitSchedule).toEqual([{ dayOfWeek: 1, time: '09:00', duration: 2 }]);
    expect(data.primaryCaregiver).toBe('cg-1');
    expect(data.backupCaregivers).toEqual(['cg-2']);
    expect(data.preferences).toEqual({ gender: 'female', language: ['English', 'Spanish'] });
  });
});

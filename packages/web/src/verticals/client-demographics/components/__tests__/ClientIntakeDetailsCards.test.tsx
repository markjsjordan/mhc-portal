import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClientIntakeDetailsCards } from '../ClientIntakeDetailsCards';
import type { Client } from '../../types';

const baseClient: Client = {
  id: 'client-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  clientNumber: 'CL-001',
  firstName: 'Eleanor',
  lastName: 'Vance',
  dateOfBirth: '1948-04-12',
  primaryAddress: {
    type: 'HOME',
    line1: '742 Evergreen Terrace',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'US',
  },
  emergencyContacts: [],
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ClientIntakeDetailsCards', () => {
  it('renders nothing when no intake detail fields are populated', () => {
    const { container } = render(<ClientIntakeDetailsCards client={baseClient} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all intake sections when populated', () => {
    const fullClient: Client = {
      ...baseClient,
      primaryPhysician: {
        name: 'Dr. Gregory House',
        phone: { number: '5125550199', type: 'WORK' },
      },
      insurance: [
        {
          id: 'ins-1',
          type: 'MEDICAID',
          payerName: 'Texas Medicaid',
          policyNumber: 'POL-987654',
          groupNumber: 'GRP-1234',
          isPrimary: true,
        },
      ],
      authorizationInfo: {
        number: 'AUTH-2026-88',
        approvedHours: 24,
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      },
      assessmentData: {
        adls: {
          bathing: 'assistance',
          dressing: 'independent',
          toileting: 'independent',
          transferring: 'dependent',
          feeding: 'independent',
        },
        iadls: {
          housekeeping: 'dependent',
          laundry: 'assistance',
          mealPrep: 'assistance',
          medication: 'assistance',
          transportation: 'dependent',
        },
        mobility: 'walker',
        cognitive: 'mild',
        conditions: ['Hypertension', 'Type 2 Diabetes'],
        medications: [{ name: 'Metformin', dosage: '500mg', frequency: 'Twice daily' }],
        allergies: ['Penicillin'],
        dietaryNeeds: 'Low sodium diabetic diet',
      },
      carePlanSummary: {
        serviceTypes: ['Personal Care', 'Homemaker'],
        visitFrequency: '3x per week',
        visitDuration: '2 hours',
        preferredTimes: ['Morning'],
        tasks: ['Bathing Assistance', 'Meal Preparation'],
        goals: 'Maintain independence at home safely',
      },
      visitSchedule: {
        scheduleStartDate: '2026-02-01',
        visitSchedule: [
          { dayOfWeek: 1, time: '09:00', duration: 2 },
          { dayOfWeek: 3, time: '09:00', duration: 2 },
        ],
      },
      consents: {
        careAgreement: true,
        hipaa: true,
        financialResponsibility: true,
        evv: false,
        signature: 'Eleanor Vance',
        signedDate: '2026-01-15',
      },
    };

    render(<ClientIntakeDetailsCards client={fullClient} />);

    // Physician
    expect(screen.getByTestId('client-physician-card')).toBeInTheDocument();
    expect(screen.getByText('Dr. Gregory House')).toBeInTheDocument();

    // Insurance & Authorization
    expect(screen.getByTestId('client-insurance-authorization-card')).toBeInTheDocument();
    expect(screen.getByText('POL-987654')).toBeInTheDocument();
    expect(screen.getByText('GRP-1234')).toBeInTheDocument();
    expect(screen.getByText('AUTH-2026-88')).toBeInTheDocument();
    expect(screen.getByText('24 hrs')).toBeInTheDocument();

    // Assessment
    expect(screen.getByTestId('client-assessment-card')).toBeInTheDocument();
    expect(screen.getByText('Walker')).toBeInTheDocument();
    expect(screen.getByText('Mild Impairment')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
    expect(screen.getByText('Metformin')).toBeInTheDocument();
    expect(screen.getByText('Penicillin')).toBeInTheDocument();
    expect(screen.getByText('Low sodium diabetic diet')).toBeInTheDocument();

    // Care Plan
    expect(screen.getByTestId('client-care-plan-card')).toBeInTheDocument();
    expect(screen.getByText('Personal Care')).toBeInTheDocument();
    expect(screen.getByText('3x per week')).toBeInTheDocument();
    expect(screen.getByText('2 hours')).toBeInTheDocument();
    expect(screen.getByText('Bathing Assistance')).toBeInTheDocument();
    expect(screen.getByText('Maintain independence at home safely')).toBeInTheDocument();

    // Visit Schedule
    expect(screen.getByTestId('client-visit-schedule-card')).toBeInTheDocument();
    expect(screen.getByText('Monday')).toBeInTheDocument();
    expect(screen.getByText('Wednesday')).toBeInTheDocument();

    // Consents
    expect(screen.getByTestId('client-consents-card')).toBeInTheDocument();
    expect(screen.getByText('Eleanor Vance')).toBeInTheDocument();
  });
});

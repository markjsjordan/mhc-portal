import React from 'react';
import {
  Stethoscope,
  Shield,
  ClipboardList,
  HeartHandshake,
  CalendarClock,
  FileCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Badge } from '@/components/ui/badge.js';
import { formatDate, formatPhone } from '@/core/utils';
import type { Client, AdlLevel } from '../types';

export interface ClientIntakeDetailsCardsProps {
  client: Client;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ADL_LABELS: Record<string, string> = {
  bathing: 'Bathing',
  dressing: 'Dressing',
  toileting: 'Toileting',
  transferring: 'Transferring',
  feeding: 'Feeding',
};

const IADL_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  laundry: 'Laundry',
  mealPrep: 'Meal Prep',
  medication: 'Medication Management',
  transportation: 'Transportation',
};

const LEVEL_LABELS: Record<AdlLevel, string> = {
  independent: 'Independent',
  assistance: 'Assistance',
  dependent: 'Dependent',
};

const MOBILITY_LABELS: Record<string, string> = {
  ambulatory: 'Ambulatory',
  walker: 'Walker',
  wheelchair: 'Wheelchair',
  bedbound: 'Bedbound',
};

const COGNITIVE_LABELS: Record<string, string> = {
  normal: 'Normal',
  mild: 'Mild Impairment',
  moderate: 'Moderate Impairment',
  severe: 'Severe Impairment',
};

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  MEDICAID: 'Medicaid',
  MEDICARE: 'Medicare',
  PRIVATE: 'Private',
  VA: 'VA',
  LONG_TERM_CARE: 'Long-Term Care',
  SELF_PAY: 'Self-Pay',
  OTHER: 'Other',
};

function hasText(value: string | number | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  return String(value).trim().length > 0;
}

export const ClientIntakeDetailsCards: React.FC<ClientIntakeDetailsCardsProps> = ({ client }) => {
  const physician = client.primaryPhysician;
  const hasPhysician = Boolean(physician && (hasText(physician.name) || hasText(physician.phone?.number)));

  const insuranceList = (client.insurance ?? []).filter(
    (ins) => hasText(ins.type) || hasText(ins.payerName) || hasText(ins.policyNumber) || hasText(ins.groupNumber)
  );
  const auth = client.authorizationInfo;
  const hasAuthorization = Boolean(
    auth &&
      (hasText(auth.number) ||
        (auth.approvedHours !== undefined && auth.approvedHours > 0) ||
        hasText(auth.validFrom) ||
        hasText(auth.validTo))
  );
  const hasInsuranceOrAuth = insuranceList.length > 0 || hasAuthorization;

  const assessment = client.assessmentData;
  const adlEntries = Object.entries(assessment?.adls ?? {}).filter(([, v]) => Boolean(v));
  const iadlEntries = Object.entries(assessment?.iadls ?? {}).filter(([, v]) => Boolean(v));
  const conditions = (assessment?.conditions ?? []).filter((c) => hasText(c));
  const medications = (assessment?.medications ?? []).filter(
    (m) => hasText(m.name) || hasText(m.dosage) || hasText(m.frequency)
  );
  const allergies = (assessment?.allergies ?? []).filter((a) => hasText(a));
  const hasAssessment = Boolean(
    adlEntries.length > 0 ||
      iadlEntries.length > 0 ||
      hasText(assessment?.mobility) ||
      hasText(assessment?.cognitive) ||
      conditions.length > 0 ||
      medications.length > 0 ||
      allergies.length > 0 ||
      hasText(assessment?.dietaryNeeds)
  );

  const carePlan = client.carePlanSummary;
  const serviceTypes = (carePlan?.serviceTypes ?? []).filter((s) => hasText(s));
  const preferredTimes = (carePlan?.preferredTimes ?? []).filter((t) => hasText(t));
  const tasks = (carePlan?.tasks ?? []).filter((t) => hasText(t));
  const hasCarePlan = Boolean(
    serviceTypes.length > 0 ||
      hasText(carePlan?.visitFrequency) ||
      hasText(carePlan?.visitDuration) ||
      preferredTimes.length > 0 ||
      tasks.length > 0 ||
      hasText(carePlan?.goals)
  );

  const schedule = client.visitSchedule;
  const scheduleEntries = schedule?.visitSchedule ?? [];
  const hasSchedule = Boolean(hasText(schedule?.scheduleStartDate) || scheduleEntries.length > 0);

  const consents = client.consents;
  const hasConsents = Boolean(
    consents &&
      (consents.careAgreement ||
        consents.hipaa ||
        consents.financialResponsibility ||
        consents.evv ||
        hasText(consents.signature) ||
        hasText(consents.signedDate))
  );

  return (
    <>
      {hasPhysician && physician && (
        <Card data-testid="client-physician-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-gray-500" />
              Primary Physician
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasText(physician.name) && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Physician Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{physician.name}</dd>
                </div>
              )}
              {physician.phone?.number && hasText(physician.phone.number) && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Physician Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatPhone(physician.phone.number)}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {hasInsuranceOrAuth && (
        <Card data-testid="client-insurance-authorization-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              Insurance &amp; Authorization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {insuranceList.length > 0 && (
              <div className="space-y-3">
                {insuranceList.map((ins, idx) => (
                  <div
                    key={ins.id ?? `ins-${idx}`}
                    className="border-b border-gray-200 last:border-0 pb-3 last:pb-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {INSURANCE_TYPE_LABELS[ins.type] ?? ins.type}
                        {ins.payerName ? ` — ${ins.payerName}` : ''}
                      </span>
                      {ins.isPrimary && <Badge variant="secondary">Primary</Badge>}
                    </div>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {hasText(ins.policyNumber) && (
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Member / Policy ID</dt>
                          <dd className="mt-0.5 text-sm text-gray-900">{ins.policyNumber}</dd>
                        </div>
                      )}
                      {hasText(ins.groupNumber) && (
                        <div>
                          <dt className="text-xs font-medium text-gray-500">Group Number</dt>
                          <dd className="mt-0.5 text-sm text-gray-900">{ins.groupNumber}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            )}

            {hasAuthorization && auth && (
              <div className={insuranceList.length > 0 ? 'pt-3 border-t border-gray-200' : ''}>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Service Authorization</h4>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {hasText(auth.number) && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Authorization Number</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{auth.number}</dd>
                    </div>
                  )}
                  {auth.approvedHours !== undefined && auth.approvedHours > 0 && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Approved Hours</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{auth.approvedHours} hrs</dd>
                    </div>
                  )}
                  {hasText(auth.validFrom) && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Valid From</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{formatDate(auth.validFrom!)}</dd>
                    </div>
                  )}
                  {hasText(auth.validTo) && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500">Valid To</dt>
                      <dd className="mt-0.5 text-sm text-gray-900">{formatDate(auth.validTo!)}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasAssessment && assessment && (
        <Card data-testid="client-assessment-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-gray-500" />
              Care Assessment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(hasText(assessment.mobility) || hasText(assessment.cognitive)) && (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasText(assessment.mobility) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Mobility</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {MOBILITY_LABELS[assessment.mobility!] ?? assessment.mobility}
                    </dd>
                  </div>
                )}
                {hasText(assessment.cognitive) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Cognitive Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {COGNITIVE_LABELS[assessment.cognitive!] ?? assessment.cognitive}
                    </dd>
                  </div>
                )}
              </dl>
            )}

            {adlEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Activities of Daily Living (ADLs)
                </h4>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {adlEntries.map(([key, level]) => (
                    <div key={key} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <dt className="text-xs text-gray-500">{ADL_LABELS[key] ?? key}</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {LEVEL_LABELS[level as AdlLevel] ?? level}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {iadlEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Instrumental Activities of Daily Living (IADLs)
                </h4>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {iadlEntries.map(([key, level]) => (
                    <div key={key} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                      <dt className="text-xs text-gray-500">{IADL_LABELS[key] ?? key}</dt>
                      <dd className="text-sm font-medium text-gray-900">
                        {LEVEL_LABELS[level as AdlLevel] ?? level}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {conditions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Medical Conditions</h4>
                <div className="flex flex-wrap gap-1.5">
                  {conditions.map((condition) => (
                    <Badge key={condition} variant="secondary">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {allergies.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Allergies</h4>
                <div className="flex flex-wrap gap-1.5">
                  {allergies.map((allergy) => (
                    <Badge key={allergy} variant="outline">
                      {allergy}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {medications.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Intake Medications</h4>
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
                  {medications.map((med, idx) => (
                    <li key={`${med.name}-${idx}`} className="px-3 py-2 text-sm flex flex-wrap justify-between gap-2">
                      <span className="font-medium text-gray-900">{med.name}</span>
                      <span className="text-gray-600">
                        {[med.dosage, med.frequency].filter(Boolean).join(' • ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasText(assessment.dietaryNeeds) && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Dietary Needs</h4>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">
                  {assessment.dietaryNeeds}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasCarePlan && carePlan && (
        <Card data-testid="client-care-plan-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <HeartHandshake className="h-5 w-5 text-gray-500" />
              Care Plan Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {serviceTypes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Service Types</h4>
                <div className="flex flex-wrap gap-1.5">
                  {serviceTypes.map((service) => (
                    <Badge key={service} variant="secondary">
                      {service}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(hasText(carePlan.visitFrequency) || hasText(carePlan.visitDuration)) && (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasText(carePlan.visitFrequency) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Visit Frequency</dt>
                    <dd className="mt-1 text-sm text-gray-900">{carePlan.visitFrequency}</dd>
                  </div>
                )}
                {hasText(carePlan.visitDuration) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Visit Duration</dt>
                    <dd className="mt-1 text-sm text-gray-900">{String(carePlan.visitDuration)}</dd>
                  </div>
                )}
              </dl>
            )}

            {preferredTimes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Preferred Times</h4>
                <div className="flex flex-wrap gap-1.5">
                  {preferredTimes.map((time) => (
                    <Badge key={time} variant="outline">
                      {time}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {tasks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Care Tasks</h4>
                <div className="flex flex-wrap gap-1.5">
                  {tasks.map((task) => (
                    <Badge key={task} variant="secondary">
                      {task}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {hasText(carePlan.goals) && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Care Goals</h4>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-line">{carePlan.goals}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasSchedule && schedule && (
        <Card data-testid="client-visit-schedule-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-gray-500" />
              Initial Visit Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasText(schedule.scheduleStartDate) && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Schedule Start Date</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(schedule.scheduleStartDate!)}
                </dd>
              </div>
            )}

            {scheduleEntries.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Recurring Visits</h4>
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
                  {scheduleEntries.map((entry, idx) => (
                    <li
                      key={`${entry.dayOfWeek}-${entry.time}-${idx}`}
                      className="px-3 py-2 text-sm flex flex-wrap justify-between gap-2"
                    >
                      <span className="font-medium text-gray-900">
                        {DAY_NAMES[entry.dayOfWeek] ?? `Day ${entry.dayOfWeek}`}
                      </span>
                      <span className="text-gray-600">
                        {entry.time} • {entry.duration} hrs
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {hasConsents && consents && (
        <Card data-testid="client-consents-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-gray-500" />
              Consents &amp; Signatures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">Care Agreement</span>
                <Badge variant={consents.careAgreement ? 'default' : 'secondary'}>
                  {consents.careAgreement ? 'Signed' : 'Not signed'}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">HIPAA Notice</span>
                <Badge variant={consents.hipaa ? 'default' : 'secondary'}>
                  {consents.hipaa ? 'Signed' : 'Not signed'}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">Financial Responsibility</span>
                <Badge variant={consents.financialResponsibility ? 'default' : 'secondary'}>
                  {consents.financialResponsibility ? 'Signed' : 'Not signed'}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">EVV Consent</span>
                <Badge variant={consents.evv ? 'default' : 'secondary'}>
                  {consents.evv ? 'Signed' : 'Not signed'}
                </Badge>
              </div>
            </div>

            {(hasText(consents.signature) || hasText(consents.signedDate)) && (
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                {hasText(consents.signature) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Signature</dt>
                    <dd className="mt-1 text-sm text-gray-900">{consents.signature}</dd>
                  </div>
                )}
                {hasText(consents.signedDate) && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Signed Date</dt>
                    <dd className="mt-1 text-sm text-gray-900">{formatDate(consents.signedDate)}</dd>
                  </div>
                )}
              </dl>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
};

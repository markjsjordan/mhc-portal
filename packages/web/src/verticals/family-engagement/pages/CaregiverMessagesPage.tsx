/**
 * Caregiver Messages Page
 *
 * Caregiver inbox at /caregiver/messages. The API scopes results to threads the
 * caregiver is assigned to or listed on as a participant (HIPAA minimum necessary);
 * messages sent here are recorded with sender_type STAFF.
 */

import React from 'react';
import { StaffMessagesPage } from './StaffMessagesPage';

export const CaregiverMessagesPage: React.FC = () => (
  <StaffMessagesPage basePath="/caregiver/messages" />
);

/**
 * Intake payload helpers.
 *
 * The server (verticals/client-demographics/src/validation/client-validator.ts) rejects
 * a blank string for `email` and enforces exact formats for phone, state and ZIP. The
 * intake form holds every field as a string, so a blank optional field must be omitted
 * from the payload (undefined), never sent as "".
 *
 * The format patterns below mirror the server schema. If the server pattern changes,
 * change it here too; the server stays the source of truth and still validates.
 */

/** Trimmed string, or undefined when blank/absent. */
export function blankToUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

// Mirrors phoneSchema.number in client-validator.ts (same character set, class reordered for lint)
const PHONE_PATTERN = /^\+?[\d\s()-]+$/;
// Mirrors addressSchema.postalCode
const POSTAL_CODE_PATTERN = /^\d{5}(-\d{4})?$/;
const STATE_PATTERN = /^[A-Za-z]{2}$/;

export interface IntakeFormatInput {
  phone?: string;
  address?: { state?: string; postalCode?: string };
  emergencyContacts?: ReadonlyArray<{ name?: string; phone?: string }>;
}

/**
 * Returns the first format problem as { step, message }, or null when every filled-in
 * field is acceptable. Blank fields are not errors here (they are omitted from the
 * payload); only a filled-in value with a format the server will reject is reported.
 */
export function findIntakeFormatError(
  input: IntakeFormatInput
): { step: number; message: string } | null {
  const phone = blankToUndefined(input.phone);
  if (phone !== undefined && !PHONE_PATTERN.test(phone)) {
    return {
      step: 1,
      message: 'Phone number may contain only digits, spaces, dashes, parentheses and a leading +',
    };
  }

  const state = blankToUndefined(input.address?.state);
  if (state !== undefined && !STATE_PATTERN.test(state)) {
    return { step: 1, message: 'State must be a 2-letter code (for example TX)' };
  }

  const postalCode = blankToUndefined(input.address?.postalCode);
  if (postalCode !== undefined && !POSTAL_CODE_PATTERN.test(postalCode)) {
    return { step: 1, message: 'ZIP code must be 5 digits, or 5+4 (for example 78701 or 78701-1234)' };
  }

  for (const contact of input.emergencyContacts ?? []) {
    const contactPhone = blankToUndefined(contact.phone);
    if (contactPhone !== undefined && !PHONE_PATTERN.test(contactPhone)) {
      return {
        step: 1,
        message: `Emergency contact phone for ${blankToUndefined(contact.name) ?? 'contact'} may contain only digits, spaces, dashes, parentheses and a leading +`,
      };
    }
  }

  return null;
}

/**
 * HIPAA-005: Safe Harbor De-Identification & BAA Gate for Outbound AI Requests
 *
 * Ensures that:
 * 1. In production (`NODE_ENV === 'production'`), outbound calls to third-party AI
 *    providers are blocked unless a signed Business Associate Agreement (BAA) is
 *    attested via environment variable (`AI_BAA_ATTESTED === 'true'`).
 * 2. All outbound text and system prompts are scrubbed of HIPAA Safe Harbor
 *    identifiers (45 CFR § 164.514(b)(2)):
 *    - Social Security Numbers (SSNs)
 *    - Phone and fax numbers
 *    - Email addresses
 *    - Street addresses
 *    - Exact dates of birth (DOBs) and clinical dates
 *    - Patient / client names (configured or labeled in text)
 *
 * @module @folkcare/core/ai/hipaa-ai-gateway
 */

export interface SafeHarborRedactionOptions {
  /** Explicit patient/client names to scrub from prompts */
  patientNames?: string[];
}

export const REDACTED_TOKENS = {
  PATIENT: 'PATIENT_REDACTED',
  SSN: '[SSN_REDACTED]',
  PHONE: '[PHONE_REDACTED]',
  EMAIL: '[EMAIL_REDACTED]',
  DOB: '[DOB_REDACTED]',
  ADDRESS: '[ADDRESS_REDACTED]',
} as const;

const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

const PHONE_PAREN_REGEX = /\(\d{3}\)[\s.-]?\d{3}[\s.-]\d{4}\b/g;
// eslint-disable-next-line security/detect-unsafe-regex
const PHONE_DASH_REGEX = /\b(?:\d{3}[\s.-]){2}\d{4}\b/g;

const EMAIL_REGEX = /\b[\w%+.-]+@[\d.a-z-]+\.[a-z]{2,}\b/gi;

// eslint-disable-next-line security/detect-unsafe-regex
const ISO_DATE_REGEX = /\b\d{4}(?:-\d{2}){2}\b/g;
// eslint-disable-next-line security/detect-unsafe-regex
const US_DATE_REGEX = /\b(?:\d{1,2}\/){2}\d{2,4}\b/g;

// eslint-disable-next-line security/detect-unsafe-regex, sonarjs/regex-complexity
const STREET_ADDRESS_CORE_REGEX = /\b\d{1,6}\s+(?:[a-z]+\s+){1,3}(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|court|ct|way|place|pl|circle|cir|parkway|pkwy|terrace|ter|trail|trl|highway|hwy)\b/gi;

// eslint-disable-next-line security/detect-unsafe-regex
const LABELED_PATIENT_NAME_REGEX = /\b(Patient|Client|Member|Resident|Recipient)(?:\s+Name)?\s*[:=-]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g;

// eslint-disable-next-line security/detect-unsafe-regex
const TITLED_NAME_REGEX = /\b(?:Mr|Mrs|Ms|Mis{2})\.?(?:\s+[A-Z][a-z]+){1,2}\b/g;

function replaceCaseInsensitive(text: string, search: string, replacement: string): string {
  const escaped = search.replaceAll(/[$()*+.?[\\\]^{|}]/g, String.raw`\$&`);
  // eslint-disable-next-line security/detect-non-literal-regexp
  const pattern = new RegExp(String.raw`\b${escaped}\b`, 'gi');
  return text.replaceAll(pattern, replacement);
}

function redactConfiguredNames(text: string, patientNames: string[]): string {
  let current = text;
  for (const rawName of patientNames) {
    const trimmed = rawName.trim();
    if (trimmed === '') {
      continue;
    }
    current = replaceCaseInsensitive(current, trimmed, REDACTED_TOKENS.PATIENT);

    const parts = trimmed.split(/\s+/).filter((part) => part.length >= 2);
    for (const part of parts) {
      current = replaceCaseInsensitive(current, part, REDACTED_TOKENS.PATIENT);
    }
  }
  return current;
}

/**
 * Scrub HIPAA Safe Harbor identifiers from an outbound AI prompt string.
 */
export function deidentifyPromptForHIPAA(
  text: string,
  options?: SafeHarborRedactionOptions
): string {
  if (text === '') {
    return text;
  }

  let scrubbed = text;

  // 1. Scrub explicitly provided patient names
  if (options?.patientNames !== undefined && options.patientNames.length > 0) {
    scrubbed = redactConfiguredNames(scrubbed, options.patientNames);
  }

  // 2. Scrub labeled patient/client names (e.g. "Patient: Jane Doe", "Client Name: John Smith")
  scrubbed = scrubbed.replaceAll(
    LABELED_PATIENT_NAME_REGEX,
    `$1: ${REDACTED_TOKENS.PATIENT}`
  );

  // 3. Scrub titled names (e.g. "Mrs. Margaret Hollowell")
  scrubbed = scrubbed.replaceAll(TITLED_NAME_REGEX, REDACTED_TOKENS.PATIENT);

  // 4. Scrub SSNs
  scrubbed = scrubbed.replaceAll(SSN_REGEX, REDACTED_TOKENS.SSN);

  // 5. Scrub phone numbers
  scrubbed = scrubbed.replaceAll(PHONE_PAREN_REGEX, REDACTED_TOKENS.PHONE);
  scrubbed = scrubbed.replaceAll(PHONE_DASH_REGEX, REDACTED_TOKENS.PHONE);

  // 6. Scrub email addresses
  scrubbed = scrubbed.replaceAll(EMAIL_REGEX, REDACTED_TOKENS.EMAIL);

  // 7. Scrub exact dates (ISO and US formats)
  scrubbed = scrubbed.replaceAll(ISO_DATE_REGEX, REDACTED_TOKENS.DOB);
  scrubbed = scrubbed.replaceAll(US_DATE_REGEX, REDACTED_TOKENS.DOB);

  // 8. Scrub street addresses
  scrubbed = scrubbed.replaceAll(STREET_ADDRESS_CORE_REGEX, REDACTED_TOKENS.ADDRESS);

  return scrubbed;
}

/**
 * Assert that a Business Associate Agreement (BAA) is attested before sending data
 * to an external AI provider in production.
 */
export function assertAIBAAAttested(providerName = 'AI Provider'): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.AI_BAA_ATTESTED !== 'true'
  ) {
    throw new Error(
      `HIPAA-005 violation: Outbound request to ${providerName} blocked in production because AI_BAA_ATTESTED is not 'true'.`
    );
  }
}

/**
 * HIPAA AI Gateway utility class
 */
export const HIPAAAIGateway = {
  deidentifyPrompt: deidentifyPromptForHIPAA,
  assertBAAAttested: assertAIBAAAttested,
  REDACTED_TOKENS,
};

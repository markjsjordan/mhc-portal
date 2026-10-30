/**
 * Tests for HIPAA-005 AI Egress Hardening & Safe Harbor De-Identification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deidentifyPromptForHIPAA,
  assertAIBAAAttested,
  REDACTED_TOKENS,
} from '../hipaa-ai-gateway.js';
import { AnthropicProvider } from '../providers/anthropic-provider.js';
import { GeocodingService } from '../../service/geocoding.service.js';

describe('HIPAAAIGateway & Outbound Egress Hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('deidentifyPromptForHIPAA', () => {
    it('strips SSNs, phone numbers, exact DOBs, email addresses, street addresses, and patient names', () => {
      const rawPrompt = [
        'Patient: Eleanor Vance',
        'DOB: 1948-05-14',
        'SSN: 123-45-6789',
        'Phone: (512) 555-0199 and 512-555-0144',
        'Email: eleanor.vance@example.com',
        'Address: 742 Evergreen Terrace, Austin, TX 78701',
        'Notes: Eleanor Vance reported mild dizziness on 05/14/1948.',
      ].join('\n');

      const scrubbed = deidentifyPromptForHIPAA(rawPrompt, {
        patientNames: ['Eleanor Vance'],
      });

      expect(scrubbed).not.toContain('Eleanor');
      expect(scrubbed).not.toContain('Vance');
      expect(scrubbed).not.toContain('1948-05-14');
      expect(scrubbed).not.toContain('05/14/1948');
      expect(scrubbed).not.toContain('123-45-6789');
      expect(scrubbed).not.toContain('512-555-0199');
      expect(scrubbed).not.toContain('(512) 555-0199');
      expect(scrubbed).not.toContain('512-555-0144');
      expect(scrubbed).not.toContain('eleanor.vance@example.com');
      expect(scrubbed).not.toContain('742 Evergreen Terrace');

      expect(scrubbed).toContain(REDACTED_TOKENS.PATIENT);
      expect(scrubbed).toContain(REDACTED_TOKENS.SSN);
      expect(scrubbed).toContain(REDACTED_TOKENS.PHONE);
      expect(scrubbed).toContain(REDACTED_TOKENS.DOB);
      expect(scrubbed).toContain(REDACTED_TOKENS.EMAIL);
      expect(scrubbed).toContain(REDACTED_TOKENS.ADDRESS);
    });

    it('redacts labeled client names even when patientNames option is not provided', () => {
      const prompt = 'Client Name: Robert Paulson had BP 120/80 at 100 Congress Ave.';
      const scrubbed = deidentifyPromptForHIPAA(prompt);

      expect(scrubbed).not.toContain('Robert Paulson');
      expect(scrubbed).not.toContain('100 Congress Ave');
      expect(scrubbed).toContain(REDACTED_TOKENS.PATIENT);
      expect(scrubbed).toContain(REDACTED_TOKENS.ADDRESS);
    });
  });

  describe('AnthropicProvider BAA Gate and De-Identification', () => {
    it('blocks outbound AI calls in production when AI_BAA_ATTESTED is not true', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.AI_BAA_ATTESTED;

      expect(() => assertAIBAAAttested('Anthropic Claude')).toThrow(/AI_BAA_ATTESTED/);

      const provider = new AnthropicProvider('test-api-key');

      await expect(
        provider.generateText('Patient: Jane Doe, SSN 123-45-6789')
      ).rejects.toThrow(/AI_BAA_ATTESTED/);
    });

    it('scrubs ePHI from prompts before sending to Anthropic client', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AI_BAA_ATTESTED = 'true';

      const provider = new AnthropicProvider('test-api-key');
      const createSpy = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Summary complete' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });

      (provider as any).client = {
        messages: {
          create: createSpy,
        },
      };

      await provider.generateText(
        'Visit note for Margaret Hollowell (DOB: 1952-11-03, SSN: 987-65-4321, Phone: 512-867-5309) at 450 Oak Street.',
        {
          systemPrompt: 'Summarize care for Margaret Hollowell',
          patientNames: ['Margaret Hollowell'],
        }
      );

      expect(createSpy).toHaveBeenCalledTimes(1);
      const callArg = createSpy.mock.calls[0]?.[0];
      const sentContent = callArg.messages[0].content as string;
      const sentSystem = callArg.system as string;

      expect(sentContent).not.toContain('Margaret');
      expect(sentContent).not.toContain('Hollowell');
      expect(sentContent).not.toContain('1952-11-03');
      expect(sentContent).not.toContain('987-65-4321');
      expect(sentContent).not.toContain('512-867-5309');
      expect(sentContent).not.toContain('450 Oak Street');
      expect(sentSystem).not.toContain('Margaret');
      expect(sentSystem).toContain(REDACTED_TOKENS.PATIENT);
    });
  });

  describe('GeocodingService Nominatim Production Gate', () => {
    it('blocks public Nominatim geocoding in production when GEOCODING_BAA_ATTESTED is not true', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.GEOCODING_BAA_ATTESTED;

      const geocoder = new GeocodingService('nominatim');

      await expect(
        geocoder.geocodeAddress({
          line1: '123 Main St',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
        })
      ).rejects.toThrow(/GEOCODING_BAA_ATTESTED/);
    });
  });
});

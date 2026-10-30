import { z } from 'zod';

// ============================================================================
// Webhook Event Types
// ============================================================================

export const WEBHOOK_EVENTS = {
  // Client events
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_DELETED: 'client.deleted',

  // Caregiver events
  CAREGIVER_CREATED: 'caregiver.created',
  CAREGIVER_UPDATED: 'caregiver.updated',
  CAREGIVER_DELETED: 'caregiver.deleted',

  // Visit events
  VISIT_SCHEDULED: 'visit.scheduled',
  VISIT_STARTED: 'visit.started',
  VISIT_COMPLETED: 'visit.completed',
  VISIT_CANCELLED: 'visit.cancelled',
  VISIT_MISSED: 'visit.missed',

  // EVV events
  EVV_CLOCK_IN: 'evv.clock_in',
  EVV_CLOCK_OUT: 'evv.clock_out',
  EVV_LOCATION_VERIFIED: 'evv.location_verified',
  EVV_SIGNATURE_CAPTURED: 'evv.signature_captured',

  // Care plan events
  CARE_PLAN_CREATED: 'care_plan.created',
  CARE_PLAN_UPDATED: 'care_plan.updated',
  CARE_PLAN_APPROVED: 'care_plan.approved',

  // Billing events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  PAYMENT_RECEIVED: 'payment.received',

  // Alert events
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_RESOLVED: 'alert.resolved',

  // Document events
  DOCUMENT_UPLOADED: 'document.uploaded',
  DOCUMENT_SIGNED: 'document.signed',
} as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

// ============================================================================
// Webhook Configuration
// ============================================================================

export const WebhookStatusSchema = z.enum(['active', 'inactive', 'suspended']);
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;

function isPrivateOrRestrictedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replaceAll(/(^\[)|(\]$)/g, '');

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '0.0.0.0' ||
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) {
      return true;
    }
    const [a, b] = octets;
    // Loopback 127.0.0.0/8, Unspecified 0.0.0.0/8
    if (a === 127 || a === 0) return true;
    // Private RFC 1918: 10.0.0.0/8
    if (a === 10) return true;
    // Private RFC 1918: 172.16.0.0/12
    if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
    // Private RFC 1918: 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // Link-local / cloud metadata: 169.254.0.0/16
    if (a === 169 && b === 254) return true;
  }

  return false;
}

export const SecureWebhookUrlSchema = z
  .string()
  .url()
  .refine((val) => val.startsWith('https://'), {
    message: 'Webhook URL must use HTTPS (https://) to protect ePHI in transit',
  })
  .refine(
    (val) => {
      try {
        const parsed = new globalThis.URL(val);
        return !isPrivateOrRestrictedHost(parsed.hostname);
      } catch {
        return false;
      }
    },
    {
      message:
        'Webhook URL cannot target localhost, loopback, link-local, or private RFC 1918 addresses',
    }
  );

export const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: SecureWebhookUrlSchema,
  events: z.array(z.string()).min(1),
  description: z.string().max(500).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(0).max(10).default(3),
      retryDelayMs: z.number().int().min(1000).max(300000).default(5000),
      exponentialBackoff: z.boolean().default(true),
    })
    .optional(),
});

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>;

export const UpdateWebhookSchema = CreateWebhookSchema.partial().extend({
  status: WebhookStatusSchema.optional(),
});

export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>;

export interface Webhook {
  id: string;
  organizationId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  description?: string;
  headers?: Record<string, string>;
  status: WebhookStatus;
  retryPolicy: {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastTriggeredAt?: Date;
  successCount: number;
  failureCount: number;
}

// ============================================================================
// Webhook Delivery
// ============================================================================

export const DeliveryStatusSchema = z.enum([
  'pending',
  'delivered',
  'failed',
  'retrying',
]);
export type DeliveryStatus = z.infer<typeof DeliveryStatusSchema>;

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  lastAttemptAt?: Date;
  nextRetryAt?: Date;
  responseStatus?: number;
  responseBody?: string;
  responseTimeMs?: number;
  errorMessage?: string;
  createdAt: Date;
  deliveredAt?: Date;
}

// ============================================================================
// Webhook Event Payload
// ============================================================================

export interface WebhookEventPayload<T = Record<string, unknown>> {
  id: string;
  type: WebhookEventType;
  timestamp: string;
  organizationId: string;
  data: T;
  metadata?: {
    triggeredBy?: string;
    correlationId?: string;
    source?: string;
  };
}

// ============================================================================
// Webhook Signature
// ============================================================================

export interface WebhookSignature {
  timestamp: number;
  signature: string;
}

// ============================================================================
// Webhook Statistics
// ============================================================================

export interface WebhookStats {
  webhookId: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageResponseTimeMs: number;
  lastDeliveryAt?: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
}

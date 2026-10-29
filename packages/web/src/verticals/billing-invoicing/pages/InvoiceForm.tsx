/**
 * Invoice Form Page
 *
 * Form to create a new invoice or edit an existing DRAFT/PENDING_REVIEW invoice.
 */

import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  LoadingSpinner,
  ErrorMessage,
} from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useInvoice, useCreateInvoice, useUpdateInvoice } from '../hooks';
import { billingErrorMessage } from '../services/billing-api';
import type { CreateInvoiceInput, UpdateInvoiceInput } from '../types';

const payerTypeOptions = [
  { value: 'MEDICAID', label: 'Medicaid' },
  { value: 'MEDICARE', label: 'Medicare' },
  { value: 'MEDICARE_ADVANTAGE', label: 'Medicare Advantage' },
  { value: 'PRIVATE_INSURANCE', label: 'Private Insurance' },
  { value: 'MANAGED_CARE', label: 'Managed Care' },
  { value: 'VETERANS_BENEFITS', label: 'Veterans Benefits' },
  { value: 'WORKERS_COMP', label: 'Workers Comp' },
  { value: 'PRIVATE_PAY', label: 'Private Pay' },
  { value: 'GRANT', label: 'Grant' },
  { value: 'OTHER', label: 'Other' },
];

const invoiceStatusOptions = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'SENT', label: 'Sent' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PAST_DUE', label: 'Past Due' },
  { value: 'DISPUTED', label: 'Disputed' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'VOIDED', label: 'Voided' },
];

const invoiceFormSchema = z.object({
  clientId: z.string().optional(),
  payerId: z.string().min(1, 'Payer is required'),
  payerType: z.enum([
    'MEDICAID',
    'MEDICARE',
    'MEDICARE_ADVANTAGE',
    'PRIVATE_INSURANCE',
    'MANAGED_CARE',
    'VETERANS_BENEFITS',
    'WORKERS_COMP',
    'PRIVATE_PAY',
    'GRANT',
    'OTHER',
  ]),
  payerName: z.string().min(1, 'Payer name is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  periodStart: z.string().min(1, 'Period start is required'),
  periodEnd: z.string().min(1, 'Period end is required'),
  billableItemIdsRaw: z.string().optional(),
  notes: z.string().optional(),
  // Edit-mode only fields (UpdateInvoiceInput)
  status: z
    .enum([
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'READY_TO_SUBMIT',
      'SENT',
      'SUBMITTED',
      'PARTIALLY_PAID',
      'PAID',
      'PAST_DUE',
      'DISPUTED',
      'CANCELLED',
      'VOIDED',
    ])
    .optional(),
  taxAmount: z.string().optional(),
  discountAmount: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

/**
 * Parse a comma/newline separated string of billable item IDs into an array.
 *
 * Pending: No reusable billable-items picker component exists under
 * @/core/components yet. Using a plain textarea stopgap (comma or
 * newline separated IDs) until a real billable-items selector is built.
 */
function parseBillableItemIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const getSubmitButtonLabel = (isPending: boolean, isEditMode: boolean): string => {
  if (isPending) return 'Saving...';
  if (isEditMode) return 'Save Changes';
  return 'Create Invoice';
};

export const InvoiceForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const { data: existingInvoice, isLoading: isLoadingInvoice } = useInvoice(id);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const isPending = createInvoice.isPending || updateInvoice.isPending;
  const isError = createInvoice.isError || updateInvoice.error;
  const error = createInvoice.error ?? updateInvoice.error;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      clientId: '',
      payerId: '',
      payerType: 'PRIVATE_PAY',
      payerName: '',
      invoiceDate: '',
      dueDate: '',
      periodStart: '',
      periodEnd: '',
      billableItemIdsRaw: '',
      notes: '',
      status: 'DRAFT',
      taxAmount: '',
      discountAmount: '',
    },
  });

  const payerType = useWatch({ control, name: 'payerType' });
  const status = useWatch({ control, name: 'status' });

  // Pre-populate defaultValues in edit mode once the invoice loads
  React.useEffect(() => {
    if (isEditMode && existingInvoice) {
      reset({
        clientId: existingInvoice.clientId ?? '',
        payerId: existingInvoice.payerId,
        payerType: existingInvoice.payerType,
        payerName: existingInvoice.payerName,
        invoiceDate: existingInvoice.invoiceDate.slice(0, 10),
        dueDate: existingInvoice.dueDate.slice(0, 10),
        periodStart: existingInvoice.periodStart.slice(0, 10),
        periodEnd: existingInvoice.periodEnd.slice(0, 10),
        billableItemIdsRaw: existingInvoice.lineItems
          .map((item) => item.billableItemId)
          .join('\n'),
        notes: existingInvoice.notes ?? '',
        status: existingInvoice.status,
        taxAmount: String(existingInvoice.taxAmount),
        discountAmount: String(existingInvoice.discountAmount),
      });
    }
  }, [isEditMode, existingInvoice, reset]);

  const onFormSubmit = async (data: InvoiceFormData) => {
    try {
      if (isEditMode && id) {
        const updateInput: UpdateInvoiceInput = {
          status: data.status,
          dueDate: data.dueDate,
          notes: data.notes,
          taxAmount: data.taxAmount ? Number(data.taxAmount) : undefined,
          discountAmount: data.discountAmount ? Number(data.discountAmount) : undefined,
        };
        const result = await updateInvoice.mutateAsync({ id, input: updateInput });
        await navigate(`/billing/${result.id}`);
      } else {
        const createInput: CreateInvoiceInput = {
          clientId: data.clientId ?? undefined,
          payerId: data.payerId,
          payerType: data.payerType,
          payerName: data.payerName,
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          billableItemIds: parseBillableItemIds(data.billableItemIdsRaw),
          notes: data.notes ?? undefined,
        };
        const result = await createInvoice.mutateAsync(createInput);
        await navigate(`/billing/${result.id}`);
      }
    } catch (err) {
      // The mutation's onError already surfaces a toast; keep a console trace so
      // the failure is never fully silent.
      console.error('Invoice save failed', err);
    }
  };

  if (isEditMode && isLoadingInvoice) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorMessage
        message={(error as Error).message || 'Failed to save invoice'}
        retry={() => {
          createInvoice.reset();
          updateInvoice.reset();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={isEditMode && id ? `/billing/${id}` : '/billing'}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {isEditMode ? 'Edit Invoice' : 'New Invoice'}
        </h1>
        <p className="text-gray-600 mt-1">
          {isEditMode
            ? 'Update invoice details'
            : 'Create a new invoice for a payer'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { handleSubmit(onFormSubmit)(e).catch((err: unknown) => { toast.error(billingErrorMessage(err, 'Failed to save invoice')); }); }} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="invoice-client-id">Client ID</Label>
                <Input
                  id="invoice-client-id"
                  {...register('clientId')}
                  placeholder="Optional client ID"
                  disabled={isEditMode}
                  data-testid="invoice-client-id"
                />
                {errors.clientId?.message && (
                  <p className="text-destructive text-sm">{errors.clientId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-payer-id">
                  Payer ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-payer-id"
                  {...register('payerId')}
                  placeholder="Payer ID"
                  disabled={isEditMode}
                  data-testid="invoice-payer-id"
                />
                {errors.payerId?.message && (
                  <p className="text-destructive text-sm">{errors.payerId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-payer-type">
                  Payer Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={payerType}
                  onValueChange={(val) =>
                    setValue('payerType', val as InvoiceFormData['payerType'], { shouldValidate: true })
                  }
                  disabled={isEditMode}
                >
                  <SelectTrigger id="invoice-payer-type" data-testid="invoice-payer-type">
                    <SelectValue placeholder="Select payer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {payerTypeOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.payerType?.message && (
                  <p className="text-destructive text-sm">{errors.payerType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-payer-name">
                  Payer Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-payer-name"
                  {...register('payerName')}
                  placeholder="Payer name"
                  disabled={isEditMode}
                  data-testid="invoice-payer-name"
                />
                {errors.payerName?.message && (
                  <p className="text-destructive text-sm">{errors.payerName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="invoice-date">
                  Invoice Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-date"
                  type="date"
                  {...register('invoiceDate')}
                  disabled={isEditMode}
                  data-testid="invoice-date"
                />
                {errors.invoiceDate?.message && (
                  <p className="text-destructive text-sm">{errors.invoiceDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-due-date">
                  Due Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-due-date"
                  type="date"
                  {...register('dueDate')}
                  data-testid="invoice-due-date"
                />
                {errors.dueDate?.message && (
                  <p className="text-destructive text-sm">{errors.dueDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-period-start">
                  Period Start <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-period-start"
                  type="date"
                  {...register('periodStart')}
                  disabled={isEditMode}
                  data-testid="invoice-period-start"
                />
                {errors.periodStart?.message && (
                  <p className="text-destructive text-sm">{errors.periodStart.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice-period-end">
                  Period End <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-period-end"
                  type="date"
                  {...register('periodEnd')}
                  disabled={isEditMode}
                  data-testid="invoice-period-end"
                />
                {errors.periodEnd?.message && (
                  <p className="text-destructive text-sm">{errors.periodEnd.message}</p>
                )}
              </div>
            </div>

            {/*
              Pending: No reusable billable-items picker component exists under
              @/core/components yet. Using a plain textarea stopgap (comma or
              newline separated IDs) until a real billable-items selector is
              built in a follow-up.
            */}
            <div className="space-y-2">
              <Label htmlFor="invoice-billable-item-ids">
                Billable Item IDs
              </Label>
              <Textarea
                id="invoice-billable-item-ids"
                {...register('billableItemIdsRaw')}
                rows={4}
                placeholder="Enter billable item IDs, one per line or comma-separated"
                disabled={isEditMode}
                data-testid="invoice-billable-item-ids"
              />
              {errors.billableItemIdsRaw?.message && (
                <p className="text-destructive text-sm">{errors.billableItemIdsRaw.message}</p>
              )}
            </div>

            {isEditMode && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="invoice-status">Status</Label>
                  <Select
                    value={status}
                    onValueChange={(val) =>
                      setValue('status', val as InvoiceFormData['status'], { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="invoice-status" data-testid="invoice-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {invoiceStatusOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.status?.message && (
                    <p className="text-destructive text-sm">{errors.status.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-tax-amount">Tax Amount</Label>
                  <Input
                    id="invoice-tax-amount"
                    type="number"
                    step="0.01"
                    {...register('taxAmount')}
                    data-testid="invoice-tax-amount"
                  />
                  {errors.taxAmount?.message && (
                    <p className="text-destructive text-sm">{errors.taxAmount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice-discount-amount">Discount Amount</Label>
                  <Input
                    id="invoice-discount-amount"
                    type="number"
                    step="0.01"
                    {...register('discountAmount')}
                    data-testid="invoice-discount-amount"
                  />
                  {errors.discountAmount?.message && (
                    <p className="text-destructive text-sm">{errors.discountAmount.message}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="invoice-notes">Notes</Label>
              <Textarea
                id="invoice-notes"
                {...register('notes')}
                rows={3}
                placeholder="Optional notes"
                data-testid="invoice-notes"
              />
              {errors.notes?.message && (
                <p className="text-destructive text-sm">{errors.notes.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" disabled={isPending} data-testid="invoice-submit">
                {getSubmitButtonLabel(isPending, isEditMode)}
              </Button>
              <Link to={isEditMode && id ? `/billing/${id}` : '/billing'}>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {isPending && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 flex items-center gap-3 shadow-lg border">
            <LoadingSpinner size="lg" />
            <span className="text-lg font-medium">
              {isEditMode ? 'Saving Invoice...' : 'Creating Invoice...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

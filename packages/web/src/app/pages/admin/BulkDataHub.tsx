/**
 * Bulk Data Hub
 *
 * Provides agency administrators with:
 * 1. Bulk CSV Import Wizard (Clients & Caregivers) with:
 *    - Two-phase workflow (Phase 1: Validation, Duplicate Detection, Preview; Phase 2: Transactional Commit)
 *    - Support for legacy systems (HHAeXchange, ClearCare, Alora)
 *    - Drag-and-drop file upload, column mapping selector, preview table with error highlights
 * 2. Regulatory Audit Pack Export with:
 *    - One-click ZIP generation containing client records, EVV logs, caregiver credentials, visit notes
 *    - HIPAA Security Rule (45 CFR § 164.312(b)) audit logging
 */

import React, { useState, useRef, useId } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Layers,
  ShieldCheck,
  Calendar,
  Users,
  UserCheck,
  FileArchive,
  Lock,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group.js';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.js';

type EntityType = 'clients' | 'caregivers';
type ImportStep = 'upload' | 'mapping' | 'preview' | 'completed';
type DuplicateStrategy = 'skip' | 'update';

interface ColumnMapping {
  csvHeader: string;
  targetField: string;
}

interface DuplicateMatch {
  matchedBy: 'id' | 'email' | 'name_dob';
  existingRecordId: string;
  details: string;
}

interface ImportPreviewRow {
  rowNumber: number;
  data: Record<string, unknown>;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  duplicateMatch?: DuplicateMatch;
}

interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  duplicateRows: number;
  detectedPreset?: string;
  rows: ImportPreviewRow[];
  headers: string[];
  suggestedMappings: ColumnMapping[];
}

const CLIENT_TARGET_FIELDS = [
  { key: 'client_number', label: 'Client / Patient ID *', required: true },
  { key: 'first_name', label: 'First Name *', required: true },
  { key: 'last_name', label: 'Last Name *', required: true },
  { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD) *', required: true },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'phone', label: 'Phone Number', required: false },
  { key: 'email', label: 'Email Address', required: false },
  { key: 'street1', label: 'Street Address 1', required: false },
  { key: 'street2', label: 'Street Address 2', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State (2-letter code)', required: false },
  { key: 'zipCode', label: 'ZIP Code', required: false },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name', required: false },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', required: false },
  { key: 'status', label: 'Status (ACTIVE/INACTIVE)', required: false },
  { key: 'notes', label: 'Clinical / Service Notes', required: false },
];

const CAREGIVER_TARGET_FIELDS = [
  { key: 'employee_number', label: 'Employee / Staff ID *', required: true },
  { key: 'first_name', label: 'First Name *', required: true },
  { key: 'last_name', label: 'Last Name *', required: true },
  { key: 'date_of_birth', label: 'Date of Birth (YYYY-MM-DD) *', required: true },
  { key: 'email', label: 'Email Address *', required: true },
  { key: 'phone', label: 'Phone Number *', required: true },
  { key: 'hire_date', label: 'Hire Date (YYYY-MM-DD)', required: false },
  { key: 'employment_type', label: 'Employment Type (FULL_TIME, PART_TIME)', required: false },
  { key: 'role', label: 'Staff Role / Title', required: false },
  { key: 'street1', label: 'Street Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'zipCode', label: 'ZIP Code', required: false },
  { key: 'credentials', label: 'Credentials / Certifications (semicolon separated)', required: false },
  { key: 'pay_rate_amount', label: 'Hourly Pay Rate ($)', required: false },
  { key: 'status', label: 'Status (ACTIVE/INACTIVE)', required: false },
];

const getStepClass = (isCurrent: boolean, isPassed: boolean): string => {
  if (isCurrent) return 'border-blue-600 bg-blue-50 text-blue-700';
  if (isPassed) return 'border-green-200 bg-green-50 text-green-700';
  return 'border-gray-200 bg-white text-gray-400';
};

const getRowBgClass = (hasErrors: boolean, hasDup: boolean): string => {
  if (hasErrors) return 'bg-red-50/40';
  if (hasDup) return 'bg-purple-50/40';
  return 'hover:bg-gray-50/50';
};

const renderRowBadge = (hasErrors: boolean, hasDup: boolean) => {
  if (hasErrors) return <Badge variant="destructive">Invalid</Badge>;
  if (hasDup) {
    return <Badge className="bg-yellow-100 text-yellow-800 border-transparent hover:bg-yellow-100">Duplicate</Badge>;
  }
  return <Badge className="bg-green-100 text-green-800 border-transparent hover:bg-green-100">Valid</Badge>;
};

export const BulkDataHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');

  // Import State
  const [entityType, setEntityType] = useState<EntityType>('clients');
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [detectedPreset, setDetectedPreset] = useState<string>('Custom');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'issues' | 'duplicates'>('all');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [commitSummary, setCommitSummary] = useState<{ imported: number; updated: number; skipped: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const auditPackStartDateId = useId();
  const auditPackEndDateId = useId();

  // Export State
  const [exportStartDate, setExportStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] ?? ''
  );
  const [exportEndDate, setExportEndDate] = useState<string>(
    new Date().toISOString().split('T')[0] ?? ''
  );
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith('.csv')) {
        handleFileSelected(file);
      } else {
        setErrorMessage('Please upload a valid .csv file.');
      }
    }
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setCommitSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      setFileContent(text);
      parseHeadersAndPreset(text);
    };
    reader.readAsText(file);
  };

  const parseHeadersAndPreset = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setErrorMessage('The uploaded CSV file is empty.');
      return;
    }

    const headerLine = lines[0] ?? '';
    const rawHeaders = headerLine.split(',').map((h) => h.replace(/(^["'])|(["']$)/g, '').trim());
    setCsvHeaders(rawHeaders);

    // Auto-detect mappings and presets
    const targetFields = entityType === 'clients' ? CLIENT_TARGET_FIELDS : CAREGIVER_TARGET_FIELDS;
    const initialMappings: Record<string, string> = {};
    const headerLower = rawHeaders.map((h) => h.toLowerCase());

    // Legacy format heuristics
    let detected = 'Standard';
    if (headerLower.some((h) => h.includes('hha') || h.includes('member_id') || h.includes('caregiver_code'))) {
      detected = 'HHAeXchange';
    } else if (headerLower.some((h) => h.includes('clearcare') || h.includes('client_id') || h.includes('staff_id'))) {
      detected = 'ClearCare';
    } else if (headerLower.some((h) => h.includes('alora') || h.includes('patient_code'))) {
      detected = 'Alora';
    }
    setDetectedPreset(detected);

    for (const header of rawHeaders) {
      const norm = header.toLowerCase().replace(/[^\da-z]/g, '');
      const match = targetFields.find((tf) => {
        const tfNorm = tf.key.toLowerCase().replace(/[^\da-z]/g, '');
        return tfNorm === norm || norm.includes(tfNorm) || tfNorm.includes(norm);
      });
      if (match) {
        initialMappings[header] = match.key;
      }
    }

    setMappings(initialMappings);
    setStep('mapping');
  };

  // Phase 1: Validate file, parse columns, detect duplicates, return preview
  const handleRunValidationPreview = async () => {
    if (!fileContent) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const formattedMappings = Object.entries(mappings).map(([csvHeader, targetField]) => ({
        csvHeader,
        targetField,
      }));

      const endpoint = entityType === 'clients' ? '/api/import/clients/csv' : '/api/import/caregivers/csv';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvContent: fileContent,
          columnMappings: formattedMappings,
          previewOnly: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? `Server responded with status ${response.status}`);
      }

      const data = await response.json();
      setPreviewResult(data);
      setStep('preview');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Validation failed. Please verify your CSV headers.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Phase 2: Confirm & commit records into database inside single transaction
  const handleConfirmAndCommit = async () => {
    if (!previewResult) return;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const validRecordsToCommit = previewResult.rows
        .filter((r) => r.isValid)
        .map((r) => r.data);

      const endpoint = entityType === 'clients' ? '/api/import/clients/csv' : '/api/import/caregivers/csv';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm: true,
          records: validRecordsToCommit,
          duplicateStrategy,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? `Commit failed with status ${response.status}`);
      }

      const resData = await response.json();
      setCommitSummary({
        imported: resData.imported ?? resData.summary?.imported ?? validRecordsToCommit.length,
        updated: resData.updated ?? resData.summary?.updated ?? 0,
        skipped: resData.skipped ?? resData.summary?.skipped ?? 0,
      });
      setStep('completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to commit import records into database.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download template
  const handleDownloadTemplate = (type: EntityType) => {
    let csvContent = '';
    let filename = '';
    if (type === 'clients') {
      filename = 'folkcare-clients-template.csv';
      csvContent =
        'client_number,first_name,last_name,date_of_birth,phone,email,street1,city,state,zipCode,emergency_contact_name,emergency_contact_phone,status,notes\n' +
        'C001,John,Smith,1950-01-15,512-555-0101,john.smith@example.com,100 Oak Ave,Austin,TX,78701,Mary Smith,512-555-0102,ACTIVE,Mild mobility assistance needed\n' +
        'C002,Mary,Johnson,1955-06-20,512-555-0201,mary.j@example.com,200 Elm St,Austin,TX,78702,Bob Johnson,512-555-0202,ACTIVE,Wound dressing support\n';
    } else {
      filename = 'folkcare-caregivers-template.csv';
      csvContent =
        'employee_number,first_name,last_name,date_of_birth,email,phone,hire_date,employment_type,role,credentials,pay_rate_amount,status\n' +
        'E001,Maria,Garcia,1980-05-12,maria.garcia@example.com,512-555-0301,2023-01-15,FULL_TIME,HOME_HEALTH_AIDE,CPR;CNA,18.50,ACTIVE\n' +
        'E002,James,Brown,1975-08-22,james.brown@example.com,512-555-0302,2023-03-01,PART_TIME,COMPANION,CPR,16.00,ACTIVE\n';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Regulatory Audit Pack Export handler
  const handleGenerateAuditPack = async () => {
    setIsExporting(true);
    setErrorMessage(null);
    setExportSuccessMessage(null);

    try {
      const response = await fetch('/api/export/audit-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: exportStartDate,
          endDate: exportEndDate,
          format: exportFormat,
          includeEvv: true,
          includeCredentials: true,
          includeNotes: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? `Export failed with status ${response.status}`);
      }

      // Download the blob directly
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-pack-${exportStartDate}-to-${exportEndDate}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccessMessage(
        `Audit pack successfully generated and downloaded. HIPAA Security Rule compliance audit log entry recorded.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate regulatory audit pack.';
      setErrorMessage(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const targetFields = entityType === 'clients' ? CLIENT_TARGET_FIELDS : CAREGIVER_TARGET_FIELDS;

  // Filter preview rows
  const filteredRows = (previewResult?.rows ?? []).filter((row) => {
    if (previewFilter === 'valid') return row.isValid && !row.duplicateMatch;
    if (previewFilter === 'issues') return !row.isValid || row.errors.length > 0 || row.warnings.length > 0;
    if (previewFilter === 'duplicates') return !!row.duplicateMatch;
    return true;
  });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        setActiveTab(value as 'import' | 'export');
        setErrorMessage(null);
      }}
      className="space-y-6"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bulk Data Hub & Regulatory Export</h1>
          <p className="mt-1 text-sm text-gray-600">
            Import agency records from legacy platforms or generate state survey audit packs.
          </p>
        </div>

        {/* Tab Switcher */}
        <TabsList className="rounded-lg border border-gray-200 bg-gray-50 p-1 h-auto">
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Bulk CSV Import Wizard
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <FileArchive className="h-4 w-4" />
            Regulatory Audit Pack Export
          </TabsTrigger>
        </TabsList>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <span className="font-semibold">Error:</span> {errorMessage}
          </div>
        </div>
      )}

      {exportSuccessMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-green-800">{exportSuccessMessage}</div>
        </div>
      )}

      {/* TAB 1: BULK IMPORT WIZARD */}
      <TabsContent value="import" className="space-y-6 mt-0">
          {/* Step Breadcrumb */}
          <div className="grid grid-cols-4 gap-2 text-sm">
            {[
              { id: 'upload', label: '1. Upload CSV' },
              { id: 'mapping', label: '2. Column Mapping' },
              { id: 'preview', label: '3. Preview & Validate' },
              { id: 'completed', label: '4. Commit Records' },
            ].map((s) => {
              const isCurrent = step === s.id;
              const isPassed =
                (s.id === 'upload' && step !== 'upload') ||
                (s.id === 'mapping' && (step === 'preview' || step === 'completed')) ||
                (s.id === 'preview' && step === 'completed');

              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-center py-2.5 px-3 rounded-lg border font-medium text-center ${getStepClass(isCurrent, isPassed)}`}
                >
                  {isPassed ? <Check className="h-4 w-4 mr-1 text-green-600" /> : null}
                  {s.label}
                </div>
              );
            })}
          </div>

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Select Entity & Upload CSV</CardTitle>
                <CardDescription>Import clients or caregivers from HHAeXchange, ClearCare, Alora, or standard CSV.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Entity Selector */}
                <div>
                  <Label className="block text-sm font-medium mb-2">Target Entity</Label>
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <Button
                      type="button"
                      variant={entityType === 'clients' ? 'secondary' : 'outline'}
                      onClick={() => setEntityType('clients')}
                      className="h-auto p-4 justify-start text-left gap-3"
                    >
                      <Users className="h-6 w-6 text-primary shrink-0" />
                      <div>
                        <div className="font-semibold text-foreground">Clients</div>
                        <div className="text-xs text-muted-foreground">Demographics, contacts, addresses</div>
                      </div>
                    </Button>

                    <Button
                      type="button"
                      variant={entityType === 'caregivers' ? 'secondary' : 'outline'}
                      onClick={() => setEntityType('caregivers')}
                      className="h-auto p-4 justify-start text-left gap-3"
                    >
                      <UserCheck className="h-6 w-6 text-primary shrink-0" />
                      <div>
                        <div className="font-semibold text-foreground">Caregivers</div>
                        <div className="text-xs text-muted-foreground">Staff records, credentials, roles</div>
                      </div>
                    </Button>
                  </div>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors bg-gray-50/50"
                >
                  <Input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileSelected(e.target.files[0]);
                      }
                    }}
                  />
                  <FileSpreadsheet className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-900">Drag and drop your CSV file here</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    Supports exports from HHAeXchange, ClearCare, Alora, or custom agency exports.
                  </p>
                  <Button
                    variant="default"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse CSV File
                  </Button>
                </div>

                {/* Templates & Guidance */}
                <div className="border-t pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-600">
                  <span>Need an example template formatted for MHC Portal?</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadTemplate(entityType)}
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Download {entityType === 'clients' ? 'Client' : 'Caregiver'} Template (.csv)
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 2: MAPPING */}
          {step === 'mapping' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Column Mapping & Legacy Preset</CardTitle>
                <CardDescription>Map CSV columns from &quot;{selectedFile?.name}&quot; to MHC Portal {entityType} fields.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Preset Banner */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <div className="flex items-center gap-3">
                    <Layers className="h-5 w-5 text-blue-600" />
                    <div>
                      <span className="font-semibold text-blue-900">Detected System: </span>
                      <span className="text-blue-800 font-medium">{detectedPreset} Format</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">Auto-Mapped {Object.keys(mappings).length} Columns</Badge>
                </div>

                {/* Mapping Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CSV Header</TableHead>
                        <TableHead>Sample Header Name</TableHead>
                        <TableHead>Target MHC Portal Field</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvHeaders.map((header) => {
                        const currentTarget = mappings[header] ?? '';

                        return (
                          <TableRow key={header}>
                            <TableCell className="font-mono text-xs text-gray-900 font-semibold">{header}</TableCell>
                            <TableCell className="text-gray-500">{header}</TableCell>
                            <TableCell>
                              <Select
                                value={currentTarget || '__none__'}
                                onValueChange={(val) => {
                                  setMappings((prev) => {
                                    const next = { ...prev };
                                    if (val === '__none__') {
                                      delete next[header];
                                    } else {
                                      next[header] = val;
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="-- Ignore this column --" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">-- Ignore this column --</SelectItem>
                                  {targetFields.map((tf) => (
                                    <SelectItem key={tf.key} value={tf.key}>
                                      {tf.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {currentTarget ? (
                                <Badge className="bg-green-100 text-green-800 border-transparent hover:bg-green-100">Mapped</Badge>
                              ) : (
                                <Badge variant="secondary">Ignored</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => setStep('upload')}>
                    Back
                  </Button>
                  <Button
                    variant="default"
                    disabled={isProcessing || Object.keys(mappings).length === 0}
                    onClick={() => { void handleRunValidationPreview(); }}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Validating Data...
                      </>
                    ) : (
                      <>
                        Preview & Detect Duplicates
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: PREVIEW */}
          {step === 'preview' && previewResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Phase 1: Validation & Deduplication Preview</CardTitle>
                <CardDescription>Review validated records, duplicates, and errors before committing to the database.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Stats Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-lg border bg-gray-50 text-center">
                    <div className="text-xs text-gray-500 font-medium">Total Rows</div>
                    <div className="text-xl font-bold text-gray-900 mt-0.5">{previewResult.totalRows}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-center">
                    <div className="text-xs text-green-700 font-medium">Valid Ready</div>
                    <div className="text-xl font-bold text-green-700 mt-0.5">{previewResult.validRows}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-center">
                    <div className="text-xs text-amber-700 font-medium">Warnings</div>
                    <div className="text-xl font-bold text-amber-700 mt-0.5">{previewResult.warningRows}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-center">
                    <div className="text-xs text-red-700 font-medium">Errors (Blocked)</div>
                    <div className="text-xl font-bold text-red-700 mt-0.5">{previewResult.errorRows}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-purple-200 bg-purple-50 text-center">
                    <div className="text-xs text-purple-700 font-medium">Duplicates</div>
                    <div className="text-xl font-bold text-purple-700 mt-0.5">{previewResult.duplicateRows}</div>
                  </div>
                </div>

                {/* Duplicate Policy Choice */}
                <div className="p-4 rounded-lg bg-gray-50 border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">Duplicate Record Policy</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Choose how MHC Portal handles existing matching clients / caregivers during commit.
                    </div>
                  </div>
                  <div className="flex gap-4">
                  <RadioGroup
                    value={duplicateStrategy}
                    onValueChange={(val) => setDuplicateStrategy(val as DuplicateStrategy)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="skip" id="dupStrategy-skip" />
                      <Label htmlFor="dupStrategy-skip" className="cursor-pointer">
                        Skip Duplicates (Recommended)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="update" id="dupStrategy-update" />
                      <Label htmlFor="dupStrategy-update" className="cursor-pointer">
                        Update Existing Records
                      </Label>
                    </div>
                  </RadioGroup>
                  </div>
                </div>

                {/* Filter Tabs */}
                <Tabs
                  value={previewFilter}
                  onValueChange={(value) => setPreviewFilter(value as 'all' | 'valid' | 'issues' | 'duplicates')}
                >
                  <div className="flex items-center justify-between border-b pb-2">
                    <TabsList variant="line" className="gap-2">
                      {(['all', 'valid', 'issues', 'duplicates'] as const).map((filter) => (
                        <TabsTrigger
                          key={filter}
                          value={filter}
                          className="capitalize bg-secondary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {filter} {filter === 'all' ? `(${previewResult.totalRows})` : ''}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <span className="text-xs text-gray-500">Showing {filteredRows.length} rows</span>
                  </div>
                </Tabs>

                {/* Table */}
                <div className="border rounded-lg max-h-96 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0">
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Identifier</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>DOB</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Issues / Duplicates</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => {
                        const hasErrors = row.errors.length > 0;
                        const hasDup = !!row.duplicateMatch;

                        const idVal = String(
                          row.data['client_number'] ?? row.data['employee_number'] ?? row.data['id'] ?? '-'
                        );
                        const nameVal = `${row.data['first_name'] ?? ''} ${row.data['last_name'] ?? ''}`.trim() || '-';
                        const dobVal = String(row.data['date_of_birth'] ?? '-');
                        const contactVal = String(row.data['email'] ?? row.data['phone'] ?? '-');

                        return (
                          <TableRow
                            key={row.rowNumber}
                            className={getRowBgClass(hasErrors, hasDup)}
                          >
                            <TableCell className="font-mono text-gray-500 text-xs">{row.rowNumber}</TableCell>
                            <TableCell className="text-xs">
                              {renderRowBadge(hasErrors, hasDup)}
                            </TableCell>
                            <TableCell className="font-mono font-medium text-gray-900 text-xs">{idVal}</TableCell>
                            <TableCell className="font-medium text-gray-900 text-xs">{nameVal}</TableCell>
                            <TableCell className="text-gray-600 text-xs">{dobVal}</TableCell>
                            <TableCell className="text-gray-600 text-xs">{contactVal}</TableCell>
                            <TableCell className="text-xs">
                              {hasErrors && (
                                <div className="text-red-700 flex items-center gap-1">
                                  <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span>{row.errors.join('; ')}</span>
                                </div>
                              )}
                              {hasDup && (
                                <div className="text-purple-700 flex items-center gap-1 mt-0.5">
                                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span>{row.duplicateMatch?.details}</span>
                                </div>
                              )}
                              {!hasErrors && !hasDup && <span className="text-gray-400">None</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => setStep('mapping')}>
                    Back to Mappings
                  </Button>
                  <Button
                    variant="default"
                    disabled={isProcessing || previewResult.validRows === 0}
                    onClick={() => { void handleConfirmAndCommit(); }}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Committing Transaction...
                      </>
                    ) : (
                      <>
                        Confirm & Commit ({previewResult.validRows} Records)
                        <CheckCircle2 className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 4: COMPLETED */}
          {step === 'completed' && commitSummary && (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Import Successfully Committed!</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto">
                  All records were imported in a single atomic database transaction with full audit logging.
                </p>

                <div className="flex justify-center gap-6 py-4">
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-green-600">{commitSummary.imported}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Imported Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-blue-600">{commitSummary.updated}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Updated Records</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-extrabold text-gray-600">{commitSummary.skipped}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Skipped Duplicates</div>
                  </div>
                </div>

                <div className="pt-4 flex justify-center gap-3">
                  <Button
                    variant="default"
                    onClick={() => {
                      setStep('upload');
                      setSelectedFile(null);
                      setFileContent('');
                      setPreviewResult(null);
                      setCommitSummary(null);
                    }}
                  >
                    Import Another File
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
      </TabsContent>

      {/* TAB 2: REGULATORY AUDIT PACK EXPORT */}
      <TabsContent value="export" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-900">State Regulatory Audit Pack Export</CardTitle>
            <CardDescription>
              Generate a comprehensive, immutable ZIP audit package for state licensing surveys (HHSC/AHCA), CMS Medicare/Medicaid audits, or accreditation reviews.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Security Notice */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex items-start gap-3">
              <ShieldCheck className="h-6 w-6 text-blue-700 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-sm font-semibold text-blue-900">
                  HIPAA Security Rule Audit Compliance (45 CFR § 164.312(b))
                </div>
                <div className="text-xs text-blue-800 leading-relaxed">
                  Every regulatory audit pack generation is permanently logged with the requester&apos;s user ID, IP
                  address, export timestamp, client count, and cryptographic manifest. The resulting archive contains
                  self-contained verification manifests to support state survey audit trails.
                </div>
              </div>
            </div>

            {/* Scope / Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor={auditPackStartDateId} className="block text-sm font-medium text-gray-700 mb-1">
                  Audit Survey Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                  <Input
                    id={auditPackStartDateId}
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={auditPackEndDateId} className="block text-sm font-medium text-gray-700 mb-1">
                  Audit Survey End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 z-10 pointer-events-none" />
                  <Input
                    id={auditPackEndDateId}
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Package Contents Checklist */}
            <div className="rounded-lg border p-4 bg-gray-50/50 space-y-3">
              <div className="text-sm font-semibold text-gray-900">Audit Pack Manifest Contents:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>
                    <strong>Client Records</strong> (`clients.csv` / `clients.json`)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>
                    <strong>EVV Electronic Visit Logs</strong> (`evv_logs.csv` - 6 Cures Act elements)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>
                    <strong>Caregiver Licensure & Screenings</strong> (`caregiver_credentials.csv`)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>
                    <strong>Visit Notes & Supervisory Evaluations</strong> (`visit_notes.csv`)
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:col-span-2">
                  <Lock className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span>
                    <strong>Cryptographic Audit Manifest</strong> (`manifest.json` - SHA-256 verification hashes)
                  </span>
                </div>
              </div>
            </div>

            {/* Format Selector */}
            <div>
              <Label className="block text-sm font-medium mb-2">Package Data Format</Label>
              <RadioGroup
                value={exportFormat}
                onValueChange={(val) => setExportFormat(val as 'csv' | 'json')}
                className="flex flex-col sm:flex-row gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="fmt-csv" />
                  <Label htmlFor="fmt-csv" className="cursor-pointer">
                    CSV Archive (Standard for state auditors & Excel inspection)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="fmt-json" />
                  <Label htmlFor="fmt-json" className="cursor-pointer">
                    JSON Archive (Machine-readable healthcare interoperability)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Action Button */}
            <div className="pt-4 border-t flex justify-end">
              <Button
                variant="default"
                disabled={isExporting}
                onClick={() => { void handleGenerateAuditPack(); }}
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating Audit Pack Archive...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Generate & Download Audit Pack (.zip)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

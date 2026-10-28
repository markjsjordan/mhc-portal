import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  Search,
  FileText,
  ShieldCheck,
  FileSpreadsheet,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Badge } from '@/components/ui/badge.js';

interface BatchActionsBarProps {
  onGenerateInvoices: () => void;
  isGenerating: boolean;
  onOpenExportModal: (type: '837p' | 'cms1500' | 'csv') => void;
  search: string;
  onSearchChange: (search: string) => void;
  selectedCount: number;
  totalCount: number;
  verifiedReadyCount: number;
}

export const BatchActionsBar: React.FC<BatchActionsBarProps> = ({
  onGenerateInvoices,
  isGenerating,
  onOpenExportModal,
  search,
  onSearchChange,
  selectedCount,
  totalCount,
  verifiedReadyCount,
}) => {
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm">
      {/* Left: Search Bar */}
      <div className="relative flex-1 max-w-md">
        <Label htmlFor="batch-claims-search" className="sr-only">
          Search claims
        </Label>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
        <Input
          id="batch-claims-search"
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search patient, caregiver, claim #, or service code..."
          className="pl-9 pr-8"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Right: Batch Action Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Selection indicator */}
        {selectedCount > 0 && (
          <Badge variant="secondary" className="whitespace-nowrap">
            {selectedCount} of {totalCount} selected
          </Badge>
        )}

        {/* Generate Invoices for Verified Visits */}
        <Button
          onClick={onGenerateInvoices}
          disabled={isGenerating || verifiedReadyCount === 0}
          className="whitespace-nowrap text-xs"
          title={`Generate invoices for ${verifiedReadyCount} EVV-verified visits. Visits with missing EVV are blocked.`}
        >
          <Sparkles className="h-4 w-4 mr-1.5 text-yellow-400" />
          {isGenerating ? 'Validating & Invoicing...' : `Generate Invoices (${verifiedReadyCount} Verified)`}
        </Button>

        {/* Export Claims Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="text-xs whitespace-nowrap"
          >
            <Download className="h-4 w-4 mr-1.5 text-muted-foreground" />
            Export Claims
            <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
          </Button>

          {exportDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setExportDropdownOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-64 bg-popover text-popover-foreground rounded-lg shadow-lg border py-1.5 z-30 text-xs animate-in fade-in zoom-in-95 duration-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    onOpenExportModal('837p');
                  }}
                  className="w-full justify-start h-auto gap-2.5 py-2 font-normal rounded-none"
                >
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">ANSI 837P EDI Preview</p>
                    <p className="text-[11px] text-muted-foreground">Electronic professional claim</p>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    onOpenExportModal('cms1500');
                  }}
                  className="w-full justify-start h-auto gap-2.5 py-2 font-normal rounded-none border-t border-border"
                >
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">CMS-1500 Form Preview</p>
                    <p className="text-[11px] text-muted-foreground">Standard paper claim layout</p>
                  </div>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setExportDropdownOpen(false);
                    onOpenExportModal('csv');
                  }}
                  className="w-full justify-start h-auto gap-2.5 py-2 font-normal rounded-none border-t border-border"
                >
                  <FileSpreadsheet className="h-4 w-4 text-purple-600" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Clearinghouse CSV Export</p>
                    <p className="text-[11px] text-muted-foreground">Spreadsheet batch upload</p>
                  </div>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';
import type { PayorTypeFilter } from '../types';

interface PayorFilterTabsProps {
  selectedPayor: PayorTypeFilter;
  onChange: (payor: PayorTypeFilter) => void;
  counts?: Partial<Record<PayorTypeFilter, number>>;
}

export const PayorFilterTabs: React.FC<PayorFilterTabsProps> = ({
  selectedPayor,
  onChange,
  counts = {},
}) => {
  const tabs: { key: PayorTypeFilter; label: string; description: string }[] = [
    { key: 'ALL', label: 'All Payors', description: 'All claims & visits' },
    { key: 'MEDICAID_MCO', label: 'Medicaid MCO', description: 'Superior, Molina, UHC (EVV Mandated)' },
    { key: 'MEDICARE', label: 'Medicare', description: 'Palmetto GBA, Noridian' },
    { key: 'PRIVATE_PAY', label: 'Private Pay', description: 'Direct Client & Family' },
    { key: 'VA', label: 'VA', description: 'Veterans Affairs Community Care' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/50 rounded-lg border">
      {tabs.map((tab) => {
        const isSelected = selectedPayor === tab.key;
        const count = counts[tab.key];

        return (
          <Button
            key={tab.key}
            type="button"
            variant={isSelected ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onChange(tab.key)}
            className="gap-2"
            title={tab.description}
          >
            <span>{tab.label}</span>
            {count !== undefined && (
              <Badge
                variant={isSelected ? 'default' : 'outline'}
                className="text-[10px] px-1.5 py-0"
              >
                {count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { getForceUpdateUrl } from '@/core/utils/version';

export interface ForceUpdateLinkCardProps {
  /** Optional override for the origin used to construct the link. */
  origin?: string;
}

/**
 * Admin dashboard card displaying the public, deterministic Force Update link
 * that admins can copy and share with staff or families after a release.
 */
export const ForceUpdateLinkCard: React.FC<ForceUpdateLinkCardProps> = ({ origin }) => {
  const [copied, setCopied] = useState(false);
  const forceUpdateUrl = getForceUpdateUrl(origin);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(forceUpdateUrl);
      }
      setCopied(true);
      toast.success('Force update link copied to clipboard');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy link. Please copy it manually.');
    }
  };

  return (
    <Card data-testid="force-update-link-section">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" aria-hidden="true" />
          <span>Force Update Link</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600">
          Share this public link with staff or families after a release to immediately clear cached
          files and load the latest version of MHC Portal.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input
            type="text"
            readOnly
            value={forceUpdateUrl}
            aria-label="Force Update URL"
            data-testid="force-update-url-input"
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 bg-gray-50 font-mono text-gray-800"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleCopy();
            }}
            data-testid="copy-force-update-link-btn"
            className="flex items-center gap-1.5 shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                <span>Copy Link</span>
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

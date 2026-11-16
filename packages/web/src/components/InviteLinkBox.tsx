import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input.js';
import { Button } from '@/components/ui/button.js';

export interface InviteLinkBoxProps {
  inviteUrl: string;
  inviteExpiresAt?: string | null;
  onCopied?: () => void;
}

export function InviteLinkBox({ inviteUrl, inviteExpiresAt, onCopied }: InviteLinkBoxProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      onCopied?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: ignore clipboard error if unavailable
    }
  };

  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          readOnly
          value={inviteUrl}
          aria-label="Portal invite link"
          onClick={(e) => e.currentTarget.select()}
          className="h-7 flex-1 min-w-0 bg-white px-2 py-1 text-xs font-mono text-slate-800"
        />
        <Button
          type="button"
          size="sm"
          onClick={handleCopy}
          className="h-7 shrink-0 bg-teal-600 px-2.5 text-xs text-white hover:bg-teal-700"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 mr-1" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copy link
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
        <span>Share this link directly with the recipient.</span>
        {inviteExpiresAt ? (
          <span>Expires {new Date(inviteExpiresAt).toLocaleDateString()}</span>
        ) : null}
      </div>
    </div>
  );
}

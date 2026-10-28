/**
 * New Staff Message Dialog
 *
 * Lets staff start a conversation with a client's family member (incident reports,
 * schedule changes, care plan updates). Recipients are limited server-side to active
 * family members inside the caller's organization and staff scope.
 */

import React, { useState } from 'react';
import { useClients } from '@/verticals/client-demographics/hooks/useClients.js';
import { useFamilyMembersForClient, useStaffCreateThread } from '../hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { NativeSelect } from '@/components/ui/select.js';
import { Textarea } from '@/components/ui/textarea.js';
import type { UUID } from '@folkcare/core/browser';

interface NewStaffMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new thread id after a successful send */
  onCreated: (threadId: string) => void;
}

export const NewStaffMessageDialog: React.FC<NewStaffMessageDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const [clientId, setClientId] = useState('');
  const [familyMemberId, setFamilyMemberId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const { data: clients, isLoading: clientsLoading } = useClients({ pageSize: 100 });
  const { data: familyMembers, isLoading: membersLoading } = useFamilyMembersForClient(
    (clientId || null) as UUID | null
  );
  const createThread = useStaffCreateThread();

  const canSubmit =
    !!clientId &&
    !!familyMemberId &&
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    !createThread.isPending;

  const reset = () => {
    setClientId('');
    setFamilyMemberId('');
    setSubject('');
    setMessage('');
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    createThread.mutate(
      {
        familyMemberId: familyMemberId as UUID,
        clientId: clientId as UUID,
        subject: subject.trim(),
        initialMessage: message.trim(),
      },
      {
        onSuccess: (thread) => {
          reset();
          onOpenChange(false);
          onCreated(thread.id);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New message to family</DialogTitle>
            <DialogDescription>
              Choose a client and a family member. Do not include more health information than
              the family needs to know.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="new-message-client">Client</Label>
            <NativeSelect
              id="new-message-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setFamilyMemberId('');
              }}
              disabled={clientsLoading}
            >
              <option value="">{clientsLoading ? 'Loading clients…' : 'Select a client'}</option>
              {clients?.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.lastName}, {client.preferredName || client.firstName}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-message-recipient">Family member</Label>
            <NativeSelect
              id="new-message-recipient"
              value={familyMemberId}
              onChange={(e) => setFamilyMemberId(e.target.value)}
              disabled={!clientId || membersLoading}
            >
              <option value="">
                {!clientId
                  ? 'Select a client first'
                  : membersLoading
                    ? 'Loading family members…'
                    : familyMembers && familyMembers.length > 0
                      ? 'Select a family member'
                      : 'No active family members'}
              </option>
              {familyMembers?.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} ({member.relationship.toLowerCase()})
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-message-subject">Subject</Label>
            <Input
              id="new-message-subject"
              value={subject}
              maxLength={200}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-message-body">Message</Label>
            <Textarea
              id="new-message-body"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createThread.isPending ? 'Sending…' : 'Send message'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

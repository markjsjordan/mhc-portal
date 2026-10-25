/**
 * Staff Messages Page
 *
 * Inbox where admins, coordinators and assigned caregivers answer family
 * conversations. Visibility (org-wide / branch / assigned-only) is enforced by
 * the API; this page only renders what the server returns.
 */

import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useStaffInbox,
  useMessagesInThread,
  useSendMessage,
  useUpdateMessageThread,
} from '../hooks';
import { MessageThread, MessageComposer } from '../components';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Badge } from '@/components/ui/badge.js';

type StatusFilter = 'OPEN' | 'CLOSED';

export const StaffMessagesPage: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const [status, setStatus] = useState<StatusFilter>('OPEN');

  const { data: threads, isLoading: threadsLoading } = useStaffInbox(status);
  const { data: messages, isLoading: messagesLoading } = useMessagesInThread(threadId ?? null);
  const sendMessage = useSendMessage();
  const updateThread = useUpdateMessageThread();

  const activeThread = threads?.find((t) => t.id === threadId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-gray-600">Conversations with client families</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex gap-2" role="tablist" aria-label="Conversation status">
                {(['OPEN', 'CLOSED'] as const).map((s) => (
                  <Button
                    key={s}
                    role="tab"
                    aria-selected={status === s}
                    variant={status === s ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatus(s)}
                    className={status === s ? 'font-semibold' : 'text-muted-foreground'}
                  >
                    {s === 'OPEN' ? 'Open' : 'Closed'}
                  </Button>
                ))}
              </div>

              {threadsLoading ? (
                <p className="py-6 text-center text-sm text-gray-500">Loading conversations…</p>
              ) : !threads || threads.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">No {status.toLowerCase()} conversations</p>
              ) : (
                <ul className="space-y-2">
                  {threads.map((thread) => (
                    <li key={thread.id}>
                      <Link
                        to={`/messages/${thread.id}`}
                        className={`block rounded-lg border p-3 hover:bg-gray-50 transition-colors ${
                          thread.id === threadId ? 'border-primary bg-primary/5' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900">{thread.subject}</p>
                          {thread.unreadCountStaff > 0 && (
                            <Badge variant="destructive" className="px-2 py-0.5 text-xs font-semibold">
                              {thread.unreadCountStaff}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-600">
                          {thread.familyMemberName} ({thread.familyMemberRelationship.toLowerCase()})
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          <span>
                            {new Date(thread.lastMessageAt).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {thread.priority === 'HIGH' && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              High priority
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {threadId ? (
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between border-b p-4 space-y-0">
                <div>
                  <CardTitle className="text-base font-semibold text-gray-900">
                    {activeThread?.subject ?? 'Conversation'}
                  </CardTitle>
                  {activeThread && (
                    <p className="text-xs text-gray-600 mt-0.5">
                      with {activeThread.familyMemberName} ({activeThread.familyMemberRelationship.toLowerCase()})
                    </p>
                  )}
                </div>
                {activeThread && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {activeThread.assignedToUserId ? 'Assigned' : 'Unassigned'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        updateThread.mutate({
                          threadId: activeThread.id,
                          changes: { status: activeThread.status === 'OPEN' ? 'CLOSED' : 'OPEN' },
                        })
                      }
                      disabled={updateThread.isPending}
                    >
                      {activeThread.status === 'OPEN' ? 'Close conversation' : 'Reopen'}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: '500px' }}>
                <MessageThread messages={messages || []} loading={messagesLoading} viewer="STAFF" />
              </div>
              <MessageComposer
                onSend={(messageText) => sendMessage.mutate({ threadId, messageText })}
                disabled={sendMessage.isPending || activeThread?.status === 'CLOSED'}
                placeholder="Reply to the family…"
              />
            </Card>
          ) : (
            <Card className="flex h-96 items-center justify-center text-gray-500">
              <CardContent className="text-center">
                <p>Select a conversation</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

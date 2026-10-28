/**
 * Messages Page
 *
 * Messaging interface for family members
 */

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useMessageThreads,
  useMessagesInThread,
  useSendMessage,
  useCreateMessageThread,
  useFamilyMemberProfile,
} from '../hooks';
import { useAuth } from '@/core/hooks';
import { MessageList, MessageThread, MessageComposer } from '../components';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Textarea } from '@/components/ui/textarea.js';
import type { UUID } from '@folkcare/core/browser';

export const MessagesPage: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const familyMemberId = user?.id as UUID | null;

  // Get family member profile to get clientId
  const { data: profile } = useFamilyMemberProfile(familyMemberId);
  const clientId = profile?.clientId ?? null;

  const [showNewThread, setShowNewThread] = useState(false);
  const [newThreadSubject, setNewThreadSubject] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');

  const { data: threads, isLoading: threadsLoading } = useMessageThreads(familyMemberId);
  const { data: messages, isLoading: messagesLoading } = useMessagesInThread(threadId || null);
  const sendMessage = useSendMessage();
  const createThread = useCreateMessageThread();

  const handleSendMessage = (messageText: string) => {
    if (!threadId) return;
    sendMessage.mutate({ threadId, messageText });
  };

  const handleCreateThread = () => {
    if (!newThreadSubject || !newThreadMessage) {
      alert('Please fill in all fields');
      return;
    }

    if (!familyMemberId || !clientId) {
      alert('Unable to create message. Please try refreshing the page.');
      return;
    }

    createThread.mutate(
      {
        familyMemberId,
        clientId,
        subject: newThreadSubject,
        initialMessage: newThreadMessage,
      },
      {
        onSuccess: (thread) => {
          setShowNewThread(false);
          setNewThreadSubject('');
          setNewThreadMessage('');
          navigate(`/family-portal/messages/${thread.id}`);
        },
        onError: (error) => {
          alert('Failed to create message thread. Please try again.');
          console.error(error);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          <p className="mt-1 text-gray-600">Communicate with your care team</p>
        </div>
        <Button
          onClick={() => setShowNewThread(!showNewThread)}
          variant={showNewThread ? "outline" : "default"}
        >
          {showNewThread ? 'Cancel' : 'New Message'}
        </Button>
      </div>

      {/* New Thread Form */}
      {showNewThread && (
        <Card>
          <CardHeader className="p-6 pb-2">
            <CardTitle className="text-lg font-semibold text-gray-900">New Message</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-2 space-y-4">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Subject</Label>
              <Input
                type="text"
                value={newThreadSubject}
                onChange={(e) => setNewThreadSubject(e.target.value)}
                placeholder="What is this about?"
                className="w-full text-sm"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Message</Label>
              <Textarea
                value={newThreadMessage}
                onChange={(e) => setNewThreadMessage(e.target.value)}
                placeholder="Type your message..."
                rows={4}
                className="w-full text-sm"
              />
            </div>
            <Button
              onClick={handleCreateThread}
              disabled={createThread.isPending}
              className="w-full"
            >
              {createThread.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Thread List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold text-gray-900">Conversations</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              <MessageList threads={threads || []} loading={threadsLoading} />
            </CardContent>
          </Card>
        </div>

        {/* Message Thread */}
        <div className="lg:col-span-2">
          {threadId ? (
            <Card className="flex flex-col">
              <CardHeader className="border-b p-4">
                <CardTitle className="text-base font-semibold text-gray-900">
                  {threads?.find((t) => t.id === threadId)?.subject || 'Conversation'}
                </CardTitle>
              </CardHeader>
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: '500px' }}>
                <MessageThread messages={messages || []} loading={messagesLoading} />
              </div>
              <MessageComposer
                onSend={handleSendMessage}
                disabled={sendMessage.isPending}
                placeholder="Type your message..."
              />
            </Card>
          ) : (
            <Card className="flex h-96 items-center justify-center text-gray-500">
              <CardContent className="text-center">
                <p className="text-3xl mb-2">💬</p>
                <p>Select a conversation or start a new one</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Note Autofill Button Component
 *
 * Provides a button with popover that displays AI-powered autofill suggestions
 * for visit notes. Users can click suggestions to apply them to the form.
 *
 * Features:
 * - Fetches suggestions from AI service
 * - Displays suggestions in an organized popover
 * - Click to apply suggestions to form fields
 * - Loading and error states
 */

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { Button } from '@/components/ui/button.js';
import { useNoteAutofill, type AutofillSuggestions } from '../../hooks/useNoteAutofill';

export interface NoteAutofillButtonProps {
  visitId: string;
  clientId?: string;
  caregiverId?: string;
  onApplyActivity?: (activity: string) => void;
  onApplyMood?: (mood: string) => void;
  onApplyPhrase?: (phrase: string) => void;
  onApplyNoteStarter?: (starter: string) => void;
  className?: string;
}

/**
 * Button with popover for note autofill suggestions
 */
export function NoteAutofillButton({
  visitId,
  clientId,
  caregiverId,
  onApplyActivity,
  onApplyMood,
  onApplyPhrase,
  onApplyNoteStarter,
  className = '',
}: Readonly<NoteAutofillButtonProps>) {
  const { suggestions, loading, error, fetchSuggestions, clearSuggestions } = useNoteAutofill();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch suggestions when component mounts or visitId changes
  useEffect(() => {
    if (visitId && isOpen && !suggestions && !loading) {
      void fetchSuggestions({ visitId, clientId, caregiverId });
    }
  }, [visitId, clientId, caregiverId, isOpen, suggestions, loading, fetchSuggestions]);

  const handleRefresh = () => {
    clearSuggestions();
    void fetchSuggestions({ visitId, clientId, caregiverId });
  };

  return (
    <Popover className="relative">
      {({ open }) => {
        // Sync internal state with Headless UI state
        if (open !== isOpen) {
          setIsOpen(open);
        }

        return (
          <>
            <PopoverButton
              className={`
                inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                text-purple-700 bg-purple-50 border border-purple-200
                rounded-lg hover:bg-purple-100 focus:outline-none focus:ring-2
                focus:ring-purple-500 focus:ring-offset-2 transition-colors
                ${className}
              `}
              title="Get AI-powered suggestions based on previous notes"
            >
              <Sparkles className="h-4 w-4" />
              <span>Auto-fill Suggestions</span>
            </PopoverButton>

            <PopoverPanel className="absolute z-10 mt-2 w-96 max-w-sm">
              <div className="rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 bg-white overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    AI Suggestions
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="text-xs font-medium"
                  >
                    Refresh
                  </Button>
                </div>

                {/* Content */}
                <div className="px-4 py-3 max-h-96 overflow-y-auto">
                  {loading && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p className="text-sm">Analyzing previous notes...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
                      <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                      </div>
                    </div>
                  )}

                  {suggestions && !loading && !error && (
                    <SuggestionsContent
                      suggestions={suggestions}
                      onApplyActivity={onApplyActivity}
                      onApplyMood={onApplyMood}
                      onApplyPhrase={onApplyPhrase}
                      onApplyNoteStarter={onApplyNoteStarter}
                    />
                  )}
                </div>
              </div>
            </PopoverPanel>
          </>
        );
      }}
    </Popover>
  );
}

/**
 * Display suggestions content
 */
function SuggestionsContent({
  suggestions,
  onApplyActivity,
  onApplyMood,
  onApplyPhrase,
  onApplyNoteStarter,
}: Readonly<{
  suggestions: AutofillSuggestions;
  onApplyActivity?: (activity: string) => void;
  onApplyMood?: (mood: string) => void;
  onApplyPhrase?: (phrase: string) => void;
  onApplyNoteStarter?: (starter: string) => void;
}>) {
  if (suggestions.analyzedNotesCount === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <p className="text-sm">No previous notes found for this client/caregiver combination.</p>
        <p className="text-xs mt-2">Start typing to create your first note!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metadata */}
      <div className="text-xs text-gray-500 pb-2 border-b border-gray-200">
        Based on {suggestions.analyzedNotesCount} previous note
        {suggestions.analyzedNotesCount !== 1 ? 's' : ''}
      </div>

      {/* Note Starter */}
      {suggestions.noteStarter && onApplyNoteStarter && (
        <SuggestionSection
          title="Suggested Note Starter"
          icon={<Sparkles className="h-4 w-4" />}
        >
          <Button
            type="button"
            variant="outline"
            onClick={() => onApplyNoteStarter(suggestions.noteStarter!)}
            className="w-full h-auto text-left justify-start p-3 whitespace-normal font-normal text-sm"
          >
            {suggestions.noteStarter}
          </Button>
        </SuggestionSection>
      )}

      {/* Suggested Mood */}
      {suggestions.suggestedMood && onApplyMood && (
        <SuggestionSection title="Typical Client Mood">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApplyMood(suggestions.suggestedMood!)}
            className="inline-flex items-center gap-2"
          >
            <span className="font-medium">{formatMood(suggestions.suggestedMood)}</span>
            <span className="text-xs text-muted-foreground">• Apply</span>
          </Button>
        </SuggestionSection>
      )}

      {/* Suggested Activities */}
      {suggestions.suggestedActivities.length > 0 && onApplyActivity && (
        <SuggestionSection title="Common Activities">
          <div className="flex flex-wrap gap-2">
            {suggestions.suggestedActivities.slice(0, 8).map((activity, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyActivity(activity)}
                className="inline-flex items-center gap-1.5"
              >
                <span>{activity}</span>
              </Button>
            ))}
          </div>
        </SuggestionSection>
      )}

      {/* Common Phrases */}
      {suggestions.commonPhrases.length > 0 && onApplyPhrase && (
        <SuggestionSection title="Common Phrases">
          <div className="space-y-2">
            {suggestions.commonPhrases.map((phrase, index) => (
              <Button
                key={index}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyPhrase(phrase)}
                className="w-full h-auto text-left justify-start p-2 whitespace-normal font-normal text-sm"
              >
                "{phrase}"
              </Button>
            ))}
          </div>
        </SuggestionSection>
      )}
    </div>
  );
}

/**
 * Suggestion section wrapper
 */
function SuggestionSection({
  title,
  icon,
  children,
}: Readonly<{
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

/**
 * Format mood enum for display
 */
function formatMood(mood: string): string {
  return mood
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

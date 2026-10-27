import React, { useState } from 'react';
import { X, FileText, Tag } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import { Badge } from '@/components/ui/badge.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { formatDate } from '@/core/utils';
import type { ProgressNote, ProgressNoteType } from '../types';

export interface ProgressNoteFormProps {
  carePlanId: string;
  clientId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<ProgressNote, 'id' | 'carePlanId' | 'clientId' | 'authorId' | 'authorName' | 'authorRole' | 'noteDate' | 'createdAt' | 'updatedAt' | 'reviewedBy' | 'reviewedAt' | 'approved'>) => void;
  isLoading?: boolean;
  authorInfo: {
    id: string;
    name: string;
    role: string;
  };
}

const noteTypeOptions = [
  { value: 'VISIT_NOTE', label: 'Visit Note' },
  { value: 'WEEKLY_SUMMARY', label: 'Weekly Summary' },
  { value: 'MONTHLY_SUMMARY', label: 'Monthly Summary' },
  { value: 'CARE_PLAN_REVIEW', label: 'Care Plan Review' },
  { value: 'INCIDENT', label: 'Incident Report' },
  { value: 'CHANGE_IN_CONDITION', label: 'Change in Condition' },
  { value: 'COMMUNICATION', label: 'Communication' },
  { value: 'OTHER', label: 'Other' },
];

const commonTags = [
  'Positive Progress',
  'Concern',
  'Medication',
  'Mobility',
  'Nutrition',
  'Hygiene',
  'Social',
  'Emotional',
  'Cognitive',
  'Pain',
  'Safety',
  'Family',
  'Follow-up Required',
];

export const ProgressNoteForm: React.FC<ProgressNoteFormProps> = ({
  carePlanId,
  clientId,
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  authorInfo,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [noteType, setNoteType] = useState<ProgressNoteType>('VISIT_NOTE');
  const [content, setContent] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleFormSubmit = () => {
    if (!content.trim()) return;
    
    onSubmit({
      noteType,
      content,
      tags: selectedTags,
      isPrivate,
    });
  };

  const addTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    setSelectedTags(selectedTags.filter(t => t !== tag));
  };

  const addCustomTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Add Progress Note</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Author Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Author Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Name</span>
                  <p className="mt-1 text-sm">{authorInfo.name}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Role</span>
                  <p className="mt-1 text-sm">{authorInfo.role}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Date</span>
                  <p className="mt-1 text-sm">{formatDate(new Date())}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Note Type */}
          <div className="space-y-1.5">
            <Label htmlFor="note-type-select">
              Note Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={noteType}
              onValueChange={(val) => setNoteType(val as ProgressNoteType)}
            >
              <SelectTrigger id="note-type-select">
                <SelectValue placeholder="Select note type" />
              </SelectTrigger>
              <SelectContent>
                {noteTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content */}
          <div className="space-y-1.5">
            <Label htmlFor="note-content">
              Note Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="note-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter detailed progress note..."
              rows={8}
            />
          </div>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Common Tags */}
                <div>
                  <Label className="mb-2 block">Common Tags</Label>
                  <div className="flex flex-wrap gap-2">
                    {commonTags.map((tag) => (
                      <Button
                        key={tag}
                        type="button"
                        variant={selectedTags.includes(tag) ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => addTag(tag)}
                        className="rounded-full h-8 px-3 text-xs"
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Custom Tag */}
                <div>
                  <Label htmlFor="custom-tag-input" className="mb-2 block">Custom Tag</Label>
                  <div className="flex gap-2">
                    <Input
                      id="custom-tag-input"
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomTag();
                        }
                      }}
                      placeholder="Enter custom tag..."
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addCustomTag}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* Selected Tags */}
                {selectedTags.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Selected Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="inline-flex items-center gap-1.5 py-1 px-3 text-xs font-normal"
                        >
                          {tag}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeTag(tag)}
                            className="h-4 w-4 p-0 ml-0.5 hover:bg-transparent"
                            aria-label={`Remove ${tag}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Privacy Settings */}
          <div className="space-y-2">
            <Label>Privacy Settings</Label>
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="is-private-note"
                checked={isPrivate}
                onCheckedChange={(checked) => setIsPrivate(Boolean(checked))}
              />
              <Label htmlFor="is-private-note" className="text-sm font-normal cursor-pointer">
                Mark as private note (only visible to authorized staff)
              </Label>
            </div>
          </div>

          {/* Context Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Context</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Care Plan ID:</span>
                  <p className="mt-1">{carePlanId}</p>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Client ID:</span>
                  <p className="mt-1">{clientId}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/20">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleFormSubmit}
            disabled={isLoading || !content.trim()}
          >
            {isLoading ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <FileText className="h-4 w-4 mr-2" />
            )}
            Save Note
          </Button>
        </div>
      </div>
    </div>
  );
};

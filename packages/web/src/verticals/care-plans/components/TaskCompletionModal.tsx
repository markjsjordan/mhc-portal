import React, { useState } from 'react';
import { toast } from 'sonner';
import { X, CheckCircle, Camera, MapPin, Clock } from 'lucide-react';
import { LoadingSpinner } from '@/core/components';
import { Button } from '@/components/ui/button.js';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.js';
import { Textarea } from '@/components/ui/textarea.js';
import { Label } from '@/components/ui/label.js';
import { formatDate, formatTime } from '@/core/utils';
import { useAuth } from '@/core/hooks';
import { useCompleteTask } from '../hooks';
import { SignaturePad } from './SignaturePad.js';
import type { TaskInstance, CompleteTaskInput } from '../types';

export interface TaskCompletionModalProps {
  task: TaskInstance;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  task,
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user } = useAuth();
  const [completionNote, setCompletionNote] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [photoData, setPhotoData] = useState<string[]>([]);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const completeTask = useCompleteTask();

  const handleComplete = async () => {
    try {
      const input: CompleteTaskInput = {
        completionNote: completionNote || 'Task completed successfully',
        // NOTE: the backend's CompleteTaskInputSchema/validateTaskCompletion
        // (verticals/care-plans-tasks/src/validation/care-plan-validator.ts)
        // require `signature` as a top-level structured object matching
        // SignatureSchema ({ signatureData, signedBy, signedByName,
        // signatureType }) — NOT nested inside customFieldValues as a raw
        // data URL. Sending it under customFieldValues (as this previously
        // did) means the backend's requiredSignature check never sees it and
        // always rejects the completion with 400 "Signature is required for
        // this task", even when the user drew and saved a signature here.
        ...(task.requiredSignature && signatureData
          ? {
              signature: {
                signatureData,
                signedBy: user?.id ?? '',
                signedByName: user?.name ?? 'Unknown',
                signatureType: 'ELECTRONIC' as const,
              },
            }
          : {}),
        customFieldValues: {
          photos: photoData,
          observations,
          gpsLocation,
        },
      };

      await completeTask.mutateAsync({ id: task.id, input });
      onComplete?.();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to complete task'
      );
    }
  };

  const handlePhotoCapture = () => {
    // FEATURE COMING SOON: Camera integration pending
    // Currently deferred pending:
    // 1. react-native-vision-camera integration for mobile
    // 2. Web camera API integration via getUserMedia()
    // 3. Image compression and base64 encoding
    // 4. EXIF metadata extraction for GPS/timestamp
    toast('📷 Photo capture is coming soon. We are building camera integration for mobile and web.');
  };

  const requestGPSLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGpsLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('GPS location error:', error);
        }
      );
    }
  };

  const handleObservationChange = (key: string, value: string) => {
    setObservations({ ...observations, [key]: value });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card text-card-foreground rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Complete Task</h2>
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
          {/* Task Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Task Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <span className="font-medium">{task.name}</span>
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDate(task.scheduledDate)} {task.scheduledTime && formatTime(task.scheduledTime)}
                  </span>
                  <span>{task.category.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Completion Note */}
          <div className="space-y-1.5">
            <Label htmlFor="task-completion-note">
              Completion Note <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="task-completion-note"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
              placeholder="Describe how the task was completed..."
              rows={4}
            />
          </div>

          {/* Signature Capture */}
          {task.requiredSignature && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Signature Required</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signatureData ? (
                    <div className="border-2 border-border rounded-md p-4">
                      <img src={signatureData} alt="Signature" className="max-h-32 mx-auto" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSignatureData('')}
                        className="mt-2"
                      >
                        Clear Signature
                      </Button>
                    </div>
                  ) : (
                    <SignaturePad onCapture={(dataUrl) => setSignatureData(dataUrl)} />
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photo Capture */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {photoData.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {photoData.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo}
                          alt={`Task photo ${index + 1}`}
                          className="w-full h-24 object-cover rounded-md border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          onClick={() => setPhotoData(photoData.filter((_, i) => i !== index))}
                          className="absolute top-1 right-1 h-6 w-6 rounded-full"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <Button
                  variant="outline"
                  onClick={handlePhotoCapture}
                  disabled
                  title="Photo capture coming soon"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  📷 Add Photo (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GPS Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gpsLocation ? (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <MapPin className="h-4 w-4" />
                    Location verified: {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={requestGPSLocation}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Verify Location
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Observations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="observation-client-condition">Client Condition</Label>
                  <Textarea
                    id="observation-client-condition"
                    value={observations.clientCondition || ''}
                    onChange={(e) => handleObservationChange('clientCondition', e.target.value)}
                    placeholder="Describe client's condition during task..."
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="observation-concerns">Issues or Concerns</Label>
                  <Textarea
                    id="observation-concerns"
                    value={observations.concerns || ''}
                    onChange={(e) => handleObservationChange('concerns', e.target.value)}
                    placeholder="Any issues or concerns noted..."
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="observation-additional-notes">Additional Notes</Label>
                  <Textarea
                    id="observation-additional-notes"
                    value={observations.additionalNotes || ''}
                    onChange={(e) => handleObservationChange('additionalNotes', e.target.value)}
                    placeholder="Any additional observations..."
                    rows={3}
                  />
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
            onClick={handleComplete}
            disabled={completeTask.isPending || (task.requiredSignature && !signatureData)}
          >
            {completeTask.isPending ? (
              <LoadingSpinner size="sm" className="mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Complete Task
          </Button>
        </div>
      </div>
    </div>
  );
};

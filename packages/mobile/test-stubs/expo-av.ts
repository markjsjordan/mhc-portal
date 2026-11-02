/**
 * Type declarations and stub for expo-av in mobile environment.
 */

/* eslint-disable @typescript-eslint/no-namespace */
export namespace Audio {
  export interface RecordingOptions {
    android?: Record<string, unknown>;
    ios?: Record<string, unknown>;
    web?: Record<string, unknown>;
  }

  export class Recording {
    static async createAsync(_options?: unknown): Promise<{ recording: Recording }> {
      return { recording: new Recording() };
    }
    async prepareToRecordAsync(_options?: RecordingOptions): Promise<void> {}
    async startAsync(): Promise<void> {}
    async stopAndUnloadAsync(): Promise<void> {}
    getURI(): string | null {
      return 'file:///test-recording.m4a';
    }
  }

  export const RecordingOptionsPresets = {
    HIGH_QUALITY: {},
  };

  export async function requestPermissionsAsync(): Promise<{ status: string; granted: boolean }> {
    return { status: 'granted', granted: true };
  }

  export async function setAudioModeAsync(_options: Record<string, unknown>): Promise<void> {}
}

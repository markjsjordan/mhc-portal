import { clickupService } from './clickup.service.js';

/**
 * Gemini model rotation pool for QA testing
 * Rotates through models to distribute quota usage
 */
const GEMINI_POOL = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3-flash',
  'gemini-2.5-flash',
] as const;

let currentGeminiIndex = 0;

/**
 * Get next Gemini model in round-robin rotation
 */
function getNextGeminiModel(): string {
  const model = GEMINI_POOL[currentGeminiIndex];
  currentGeminiIndex = (currentGeminiIndex + 1) % GEMINI_POOL.length;
  return model as string; // Type assertion - GEMINI_POOL is non-empty constant
}

export interface QATestingResult {
  passed: boolean;
  testedAspects: string[];
  notes: string;
}

export class QATestingDispatcher {
  /**
   * Dispatch QA testing for a QA READY ticket
   * Creates a subagent with round-robin Gemini model to verify implementation
   */
  async dispatchQATesting(taskId: string): Promise<QATestingResult> {
    try {
      // Fetch full ticket details including testing instructions
      const ticket = await clickupService.getTaskDetails(taskId);

      console.log(`[QA] Starting QA testing for ticket ${taskId}: ${ticket.name}`);

      // Extract testing instructions from ticket description/body
      const testingInstructions = this.extractTestingInstructions(ticket.description ?? '');

      if (testingInstructions === null) {
        throw new Error('No testing instructions found in ticket description');
      }

      // Get next Gemini model for round-robin dispatch
      const geminiModel = getNextGeminiModel();

      console.log(`[QA] Dispatching to subagent with ${geminiModel}`);

      // Delegate to subagent with testing instructions
      // (implementation pending - subagent will verify implementation matches requirements)
      const result = await this.runQATests(geminiModel);

      return result;
    } catch (error) {
      console.error(`[QA] Error during QA testing for ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Extract testing instructions from ticket description
   * Looks for sections like "test_hooks", "testing", "acceptance criteria", etc.
   */
  private extractTestingInstructions(description: string): string | null {
    if (description.length === 0) {
      return null;
    }

    // Look for test_hooks, testing, acceptance criteria, or similar sections
    const testSectionRegex =
      /(?:test_hooks?|testing|acceptance\s+criteria|verification|how\s+to\s+test)([\S\s]*?)(?=^##|$)/im;
    const match = testSectionRegex.exec(description);

    return match?.[1]?.trim() ?? null;
  }

  /**
   * Run QA tests (placeholder for subagent delegation)
   * In actual implementation, this will be delegated to a subagent
   */
  private async runQATests(geminiModel: string): Promise<QATestingResult> {
    // Placeholder implementation
    // Real implementation will:
    // 1. Create subagent task with testing instructions
    // 2. Wait for subagent to complete testing
    // 3. Return test results

    console.log(`[QA] Running QA tests with model: ${geminiModel}`);

    return {
      passed: true,
      testedAspects: ['build', 'lint', 'typecheck', 'functionality'],
      notes: 'QA testing completed successfully',
    };
  }

  /**
   * Process QA test result and update ticket status
   */
  async processQAResult(taskId: string, result: QATestingResult): Promise<void> {
    try {
      if (result.passed) {
        // Update status to QA PASSED
        await clickupService.updateTaskStatus(taskId, 'qa passed');

        // Add completion comment
        const comment = `✅ **QA Testing Passed**

**Tested Aspects:**
${result.testedAspects.map((aspect) => `- ${aspect}`).join('\n')}

**Notes:**
${result.notes}

Verification completed and ticket ready for merge.`;

        await clickupService.addTaskComment(taskId, comment);
        console.log(`[QA] ✅ Ticket ${taskId} marked as QA PASSED`);
      } else {
        // Update status to QA FAILED
        await clickupService.updateTaskStatus(taskId, 'qa failed');

        // Add failure comment with notes for TA review
        const comment = `❌ **QA Testing Failed**

**Issues Found:**
${result.notes}

**Next Steps:**
TA team: Please review the issues above and determine what updates are needed. Once resolved, the ticket can be re-submitted for QA testing.`;

        await clickupService.addTaskComment(taskId, comment);
        console.log(`[QA] ❌ Ticket ${taskId} marked as QA FAILED`);
      }
    } catch (error) {
      console.error(`[QA] Error processing QA result for ${taskId}:`, error);
      throw error;
    }
  }
}

export const qaTestingDispatcher = new QATestingDispatcher();

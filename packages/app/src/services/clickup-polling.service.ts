/**
 * ClickUp Polling Automation
 *
 * Monitors ClickUp for tickets in two states:
 * 1. READY - Tickets awaiting implementation
 *    → Spawns subagent to implement the feature
 *
 * 2. QA READY - Tickets awaiting QA testing/verification
 *    → Spawns QA testing subagent with round-robin Gemini models
 *    → Verifies implementation matches testing instructions
 *    → Updates ticket to QA PASSED or QA FAILED with notes
 */

import { clickupService, type ClickUpTask } from '../services/clickup.service.js';
import { qaTestingDispatcher } from '../services/qa-testing-dispatcher.js';

const POLL_INTERVAL_MS = 60000; // 1 minute
const READY_STATUS = 'ready';
const QA_READY_STATUS = 'qa ready';

interface PollState {
  lastPollTime: number;
  processedTickets: Set<string>;
}

const pollState: PollState = {
  lastPollTime: 0,
  processedTickets: new Set(),
};

/**
 * Main polling function - checks for READY and QA READY tickets
 */
export async function pollClickUpTickets(): Promise<void> {
  try {
    console.log('[CLICKUP] Starting ClickUp ticket polling...');

    // Fetch all open tickets
    const allTasks = await clickupService.getAllTasks();

    // Process READY tickets (implementation)
    const readyTickets = allTasks.filter(
      (task: ClickUpTask) => task.status.status.toLowerCase() === READY_STATUS
    );

    console.log(`[CLICKUP] Found ${readyTickets.length} READY tickets`);

    for (const ticket of readyTickets) {
      if (!pollState.processedTickets.has(ticket.id)) {
        console.log(`[CLICKUP] Processing READY ticket: ${ticket.id} - ${ticket.name}`);
        await handleReadyTicket(ticket.id);
        pollState.processedTickets.add(ticket.id);
      }
    }

    // Process QA READY tickets (testing/verification)
    const qaReadyTickets = allTasks.filter(
      (task: ClickUpTask) => task.status.status.toLowerCase() === QA_READY_STATUS
    );

    console.log(`[CLICKUP] Found ${qaReadyTickets.length} QA READY tickets`);

    for (const ticket of qaReadyTickets) {
      if (!pollState.processedTickets.has(ticket.id)) {
        console.log(`[CLICKUP] Processing QA READY ticket: ${ticket.id} - ${ticket.name}`);
        await handleQAReadyTicket(ticket.id);
        pollState.processedTickets.add(ticket.id);
      }
    }

    pollState.lastPollTime = Date.now();
    console.log('[CLICKUP] Polling cycle complete');
  } catch (error) {
    console.error('[CLICKUP] Error during polling:', error);
  }
}

/**
 * Handle READY tickets - spawn implementation subagent
 *
 * Integration point: Triggers /clickup-mhc-workflow handler
 */
async function handleReadyTicket(taskId: string): Promise<void> {
  try {
    console.log(`[CLICKUP:READY] Dispatching implementation for ${taskId}`);

    // Wire up to MHC workflow dispatcher (pending separate integration task)
    console.log(
      `[CLICKUP:READY] Implementation dispatch queued for ${taskId} (MHC workflow integration pending)`
    );
  } catch (error) {
    console.error(`[CLICKUP:READY] Error handling READY ticket ${taskId}:`, error);
  }
}

/**
 * Handle QA READY tickets - dispatch QA testing with round-robin Gemini
 */
async function handleQAReadyTicket(taskId: string): Promise<void> {
  try {
    console.log(`[CLICKUP:QA] Dispatching QA testing for ${taskId}`);

    // Dispatch QA testing to subagent
    const result = await qaTestingDispatcher.dispatchQATesting(taskId);

    // Process the result and update ticket status
    await qaTestingDispatcher.processQAResult(taskId, result);

    console.log(`[CLICKUP:QA] QA testing completed for ${taskId}`);
  } catch (error) {
    console.error(`[CLICKUP:QA] Error handling QA READY ticket ${taskId}:`, error);

    // Mark as QA FAILED with error details
    try {
      await clickupService.updateTaskStatus(taskId, 'qa failed');
      await clickupService.addTaskComment(
        taskId,
        `❌ **QA Testing Error**

An error occurred during QA testing:
\`\`\`
${error instanceof Error ? error.message : String(error)}
\`\`\`

Please review the issue and resubmit for QA testing.`
      );
    } catch (updateError) {
      console.error(`[CLICKUP:QA] Failed to update ticket status: ${updateError}`);
    }
  }
}

/**
 * Start the polling service
 * Call this from your cron/periodic task handler
 */
export function startClickUpPolling(): ReturnType<typeof setInterval> {
  console.log('[CLICKUP] Starting ClickUp polling service');

  // Initial poll immediately
  pollClickUpTickets().catch((error) => console.error('[CLICKUP] Initial poll failed:', error));

  // Then poll every POLL_INTERVAL_MS
  const timer = setInterval(() => {
    pollClickUpTickets().catch((error) => console.error('[CLICKUP] Polling error:', error));
  }, POLL_INTERVAL_MS);

  return timer;
}

/**
 * Stop the polling service
 */
export function stopClickUpPolling(timer: ReturnType<typeof setInterval>): void {
  console.log('[CLICKUP] Stopping ClickUp polling service');
  clearInterval(timer);
}

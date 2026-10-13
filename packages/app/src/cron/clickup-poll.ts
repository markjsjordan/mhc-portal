/**
 * ClickUp Polling Cronjob
 * 
 * Runs at 6am ET and 12pm ET to poll for READY/QA FAILURE tickets
 * Triggers the MHC workflow via Hermes delegation
 */

import { ClickUpService } from '../services/clickup.service.js';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function pollAndProcessTickets(): Promise<void> {
  try {
    console.log(`[ClickUp Cron] Starting poll at ${new Date().toISOString()}`);

    const clickupService = new ClickUpService();
    const tickets = await clickupService.pollForTickets();

    if (tickets.length === 0) {
      console.log('[ClickUp Cron] No tickets to process');
      return;
    }

    // Process each ticket that's READY or QA FAILURE
    for (const ticket of tickets) {
      if (
        ticket.status.status === 'READY' ||
        ticket.status.status === 'QA FAILURE'
      ) {
        console.log(
          `[ClickUp Cron] Processing ticket: ${ticket.custom_id} - ${ticket.name}`
        );

        // Trigger Hermes workflow for this ticket
        await triggerHermesWorkflow(ticket.id, ticket.custom_id, ticket.name);
      }
    }

    console.log('[ClickUp Cron] Poll complete');
  } catch (error) {
    console.error('[ClickUp Cron] Error during polling:', error);
  }
}

/**
 * Trigger Hermes MHC workflow via CLI
 */
async function triggerHermesWorkflow(
  ticketId: string,
  customId: string,
  ticketName: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `hermes /clickup-mhc-workflow ${ticketId}`;

    console.log(`[ClickUp Cron] Triggering: ${command}`);

    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const child = spawn('bash', ['-c', command], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(
          `[ClickUp Cron] Workflow completed for ${customId}: ${ticketName}`
        );
        resolve();
      } else {
        console.error(
          `[ClickUp Cron] Workflow failed for ${customId} with exit code ${code}`
        );
        reject(new Error(`Workflow failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error(`[ClickUp Cron] Failed to trigger workflow:`, err);
      reject(err);
    });
  });
}

// Run if called directly
if (process.argv[1] === __filename) {
  pollAndProcessTickets()
    .then(() => {
      console.log('[ClickUp Cron] All done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[ClickUp Cron] Fatal error:', error);
      process.exit(1);
    });
}

export { pollAndProcessTickets, triggerHermesWorkflow };

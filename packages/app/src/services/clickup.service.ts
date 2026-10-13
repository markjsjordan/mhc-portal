/**
 * ClickUp Service
 * 
 * Polls ClickUp API for ticket status changes and triggers workflows
 */

/* global fetch */

export interface ClickUpTask {
  id: string;
  custom_id: string;
  name: string;
  status: {
    status: string;
    color: string;
    type: string;
  };
  url: string;
  date_updated: number;
  date_created: number;
  comment_count: number;
  list: {
    id: string;
    name: string;
  };
}

export interface ClickUpTaskUpdate {
  taskId: string;
  taskName: string;
  status: string;
  url: string;
  dateUpdated: number;
}

export class ClickUpService {
  private apiToken: string;
  private baseUrl = 'https://api.clickup.com/api/v2';
  private listId: string;

  constructor(apiToken?: string, _workspaceId?: string, listId?: string) {
    this.apiToken = apiToken ?? process.env.CLICKUP_API_TOKEN ?? '';
    this.listId = listId ?? process.env.CLICKUP_LIST_ID ?? '';

    if (this.apiToken === '') {
      throw new Error('CLICKUP_API_TOKEN environment variable not set');
    }
    if (this.listId === '') {
      throw new Error('CLICKUP_LIST_ID environment variable not set');
    }
  }

  /**
   * Get all tasks in the list with specific statuses
   */
  async getTasksByStatus(statuses: string[]): Promise<ClickUpTask[]> {
    try {
      // Fetch all tasks and filter client-side since ClickUp API where clause has issues
      const url = `${this.baseUrl}/list/${this.listId}/task`;

      const response = await fetch(url, {
        headers: {
          Authorization: this.apiToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `ClickUp API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { tasks: ClickUpTask[] };
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const allTasks = data.tasks ?? [];
      
      // Filter by status (case-insensitive)
      const statusSet = new Set(statuses.map((s) => s.toLowerCase()));
      return allTasks.filter((task) =>
        statusSet.has(task.status.status.toLowerCase())
      );
    } catch (error) {
      console.error('[ClickUp] Error fetching tasks:', error);
      throw error;
    }
  }

  /**
   * Get recently updated tasks (last N hours)
   */
  async getRecentlyUpdatedTasks(hoursAgo = 6): Promise<ClickUpTask[]> {
    try {
      const cutoffTime = Date.now() - hoursAgo * 60 * 60 * 1000;
      const url = `${this.baseUrl}/list/${this.listId}/task?date_updated_gt=${cutoffTime}`;

      const response = await fetch(url, {
        headers: {
          Authorization: this.apiToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `ClickUp API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { tasks: ClickUpTask[] };
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return data.tasks ?? [];
    } catch (error) {
      console.error('[ClickUp] Error fetching recently updated tasks:', error);
      throw error;
    }
  }

  /**
   * Get task details with comments
   */
  async getTaskWithComments(taskId: string): Promise<ClickUpTask | null> {
    try {
      const url = `${this.baseUrl}/task/${taskId}?include_subtasks=false`;

      const response = await fetch(url, {
        headers: {
          Authorization: this.apiToken,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[ClickUp] Task not found: ${taskId}`);
        return null;
      }

      const task = (await response.json()) as ClickUpTask;
      return task;
    } catch (error) {
      console.error('[ClickUp] Error fetching task:', error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/task/${taskId}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: this.apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `ClickUp API error: ${response.status} ${response.statusText}`
        );
      }

      console.log(`[ClickUp] Task ${taskId} status updated to ${status}`);
    } catch (error) {
      console.error('[ClickUp] Error updating task status:', error);
      throw error;
    }
  }

  /**
   * Add comment to task
   */
  async addTaskComment(taskId: string, comment: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/task/${taskId}/comment`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: this.apiToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment_text: comment,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `ClickUp API error: ${response.status} ${response.statusText}`
        );
      }

      console.log(`[ClickUp] Comment added to task ${taskId}`);
    } catch (error) {
      console.error('[ClickUp] Error adding comment:', error);
      throw error;
    }
  }

  /**
   * Get all tasks in the list (no status filter)
   */
  async getAllTasks(): Promise<ClickUpTask[]> {
    try {
      const url = `${this.baseUrl}/list/${this.listId}/task`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `ClickUp API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as { tasks: ClickUpTask[] };
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      return data.tasks ?? [];
    } catch (error) {
      console.error('[ClickUp] Error fetching all tasks:', error);
      throw error;
    }
  }

  /**
   * Get task details
   */
  async getTaskDetails(taskId: string): Promise<ClickUpTask & { description?: string }> {
    try {
      const url = `${this.baseUrl}/task/${taskId}?include_subtasks=false`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`[ClickUp] Task not found: ${taskId}`);
        throw new Error(`Task not found: ${taskId}`);
      }

      const task = (await response.json()) as ClickUpTask & { description?: string };
      return task;
    } catch (error) {
      console.error('[ClickUp] Error fetching task details:', error);
      throw error;
    }
  }

  /**
   * Poll for tickets in READY or QA FAILURE status
   */
  async pollForTickets(): Promise<ClickUpTask[]> {
    try {
      console.log('[ClickUp] Polling for READY and QA FAILURE tickets...');
      // Note: Status names in your ClickUp workspace: 'ready', 'qa ready', 'qa passed', etc.
      const tasks = await this.getTasksByStatus(['ready', 'qa failure']);

      console.log(`[ClickUp] Found ${tasks.length} tickets to process`);

      for (const task of tasks) {
        console.log(`  - ${task.custom_id}: ${task.name} (${task.status.status})`);
      }

      return tasks;
    } catch (error) {
      console.error('[ClickUp] Error polling for tickets:', error);
      return [];
    }
  }
}

/**
 * Singleton instance of ClickUpService
 * Used by polling and testing services
 */
export const clickupService = new ClickUpService();

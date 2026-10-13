export interface ClickUpTask {
  id: string;
  custom_id: string | null;
  name: string;
  description: string;
  status: {
    id: string;
    status: string;
    color: string;
    type: string;
  };
  url: string;
}

export interface TaskComment {
  body: string;
}

const CLICKUP_API_BASE = 'https://api.clickup.com/api/v2';
const CLICKUP_TOKEN = process.env['CLICKUP_API_TOKEN'] ?? '';
const CLICKUP_LIST_ID = process.env['CLICKUP_LIST_ID'] ?? '';

export class ClickUpService {
  private token: string;
  private listId: string;

  constructor(token: string = CLICKUP_TOKEN, listId: string = CLICKUP_LIST_ID) {
    this.token = token;
    this.listId = listId;
  }

  /**
   * Fetch all tasks from the configured list
   */
  async getAllTasks(): Promise<ClickUpTask[]> {
    const url = `${CLICKUP_API_BASE}/list/${this.listId}/task?include_closed=false&limit=100`;
    const response = await global.fetch(url, {
      headers: { Authorization: this.token },
    });

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { tasks: ClickUpTask[] };
    return data.tasks;
  }

  /**
   * Get tasks filtered by status
   */
  async getTasksByStatus(statuses: string[]): Promise<ClickUpTask[]> {
    const allTasks = await this.getAllTasks();
    return allTasks.filter((task) =>
      statuses.some((status) => task.status.status.toLowerCase() === status.toLowerCase())
    );
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, newStatus: string): Promise<ClickUpTask> {
    const url = `${CLICKUP_API_BASE}/task/${taskId}`;
    const response = await global.fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ClickUpTask;
  }

  /**
   * Add comment to task
   */
  async addTaskComment(taskId: string, comment: string): Promise<void> {
    const url = `${CLICKUP_API_BASE}/task/${taskId}/comment`;
    const response = await global.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: this.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment_text: comment }),
    });

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Get full task details including description (for testing instructions)
   */
  async getTaskDetails(taskId: string): Promise<ClickUpTask> {
    const url = `${CLICKUP_API_BASE}/task/${taskId}`;
    const response = await global.fetch(url, {
      headers: { Authorization: this.token },
    });

    if (!response.ok) {
      throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as ClickUpTask;
  }
}

export const clickupService = new ClickUpService();

import { TaskItem, TaskStatus } from '../types/index.js';

export class TaskPlanner {
  private tasks: TaskItem[] = [];

  public createPlan(
    taskList: { id?: string; title: string; description?: string; subtasks?: string[] }[]
  ): TaskItem[] {
    this.tasks = taskList.map((t, idx) => ({
      id: t.id || `task_${idx + 1}`,
      title: t.title,
      description: t.description,
      status: 'pending',
      subtasks: t.subtasks,
    }));
    return this.getPlan();
  }

  private static readonly VALID_STATUSES: TaskStatus[] = ['pending', 'in_progress', 'completed', 'failed'];

  public updateTask(
    taskId: string,
    status: TaskStatus,
    note?: string
  ): { success: boolean; task?: TaskItem; plan: TaskItem[]; error?: string } {
    // Model-supplied arguments aren't guaranteed to respect the declared JSON-schema
    // enum (providers vary in how strictly they enforce it) — validate explicitly
    // rather than silently writing an unrecognized status string onto the task,
    // which would then just render as "not started" forever in formatMarkdown().
    if (!TaskPlanner.VALID_STATUSES.includes(status)) {
      return {
        success: false,
        plan: this.getPlan(),
        error: `Invalid status "${status}". Must be one of: ${TaskPlanner.VALID_STATUSES.join(', ')}.`,
      };
    }

    // Prefer an exact id match. Only fall back to a fuzzy title match when the
    // fuzzy match is unambiguous — otherwise we risk silently updating the wrong
    // task when two titles share a common substring (e.g. "Add tests" vs "Add tests for auth").
    let task = this.tasks.find((t) => t.id === taskId);
    if (!task) {
      const needle = taskId.toLowerCase();
      const fuzzyMatches = this.tasks.filter((t) => t.title.toLowerCase().includes(needle));
      if (fuzzyMatches.length === 1) {
        task = fuzzyMatches[0];
      }
    }
    if (!task) {
      return { success: false, plan: this.getPlan(), error: `No task found matching "${taskId}".` };
    }

    task.status = status;
    if (note && task.description) {
      task.description += `\n[Update]: ${note}`;
    } else if (note) {
      task.description = `[Update]: ${note}`;
    }

    return { success: true, task, plan: this.getPlan() };
  }

  public getPlan(): TaskItem[] {
    return [...this.tasks];
  }

  public clearPlan(): void {
    this.tasks = [];
  }

  public getSummary(): {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    percent: number;
  } {
    const total = this.tasks.length;
    const completed = this.tasks.filter((t) => t.status === 'completed').length;
    const inProgress = this.tasks.filter((t) => t.status === 'in_progress').length;
    const pending = this.tasks.filter((t) => t.status === 'pending').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, pending, percent };
  }

  public formatMarkdown(): string {
    if (this.tasks.length === 0) return 'No active plan.';

    const lines: string[] = ['### Current Task Plan:'];
    for (const t of this.tasks) {
      let icon = '[ ]';
      if (t.status === 'completed') icon = '[x]';
      else if (t.status === 'in_progress') icon = '[~] (in-progress)';
      else if (t.status === 'failed') icon = '[!] (failed)';

      lines.push(`- ${icon} **${t.id}**: ${t.title}`);
      if (t.description) {
        lines.push(`    ${t.description}`);
      }
      if (t.subtasks && t.subtasks.length > 0) {
        for (const sub of t.subtasks) {
          lines.push(`    * ${sub}`);
        }
      }
    }
    return lines.join('\n');
  }
}

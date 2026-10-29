import type { Visit } from '../../verticals/scheduling-visits/types';

export interface VisitTaskItem {
  id: string;
  title: string;
  category?: string;
  completed: boolean;
  required?: boolean;
  completedAt?: string;
  notes?: string;
}

interface RawTask {
  id?: string;
  name?: string;
  title?: string;
  category?: string;
  status?: string;
  completed?: boolean;
  required?: boolean;
  isOptional?: boolean;
  completedAt?: string;
  notes?: string;
  completionNote?: string;
}

interface VisitWithTasks extends Visit {
  tasks?: RawTask[];
}

function isTaskRequired(required: unknown, isOptional: unknown): boolean {
  if (typeof required === 'boolean') return required;
  if (typeof isOptional === 'boolean') return !isOptional;
  return true;
}

export function formatTimeString(time?: Date | string | null): string | null {
  if (!time) return null;
  if (typeof time === 'string') {
    const trimmed = time.trim();
    if (/^\d{1,2}:\d{2}(\s*(am|pm))?$/i.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return trimmed;
  }
  if (time instanceof Date && !isNaN(time.getTime())) {
    return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  return null;
}

export function deriveVisitTasks(
  visit: Visit | null,
  externalTasks?: RawTask[]
): VisitTaskItem[] {
  if (!visit) return [];

  // 1. External task instances (e.g. from care plan task instances API)
  if (externalTasks && externalTasks.length > 0) {
    return externalTasks.map((t, idx: number) => ({
      id: t.id ?? `task-${idx + 1}`,
      title: t.name ?? t.title ?? 'Care Task',
      category: t.category,
      completed: t.status === 'COMPLETED' || Boolean(t.completed),
      required: isTaskRequired(t.required, t.isOptional),
      completedAt: t.completedAt ? (formatTimeString(t.completedAt) ?? undefined) : undefined,
      notes: t.notes ?? t.completionNote,
    }));
  }

  // 2. Embedded visit tasks
  const visitTasks = (visit as VisitWithTasks).tasks;
  if (Array.isArray(visitTasks) && visitTasks.length > 0) {
    return visitTasks.map((t, idx: number) => ({
      id: t.id ?? `task-${idx + 1}`,
      title: t.title ?? t.name ?? 'Care Task',
      category: t.category,
      completed: Boolean(t.completed),
      required: t.required ?? true,
      completedAt: t.completedAt ? (formatTimeString(t.completedAt) ?? undefined) : undefined,
      notes: t.notes,
    }));
  }

  // 3. Derive dynamically from service type / visit type
  const serviceName = (visit.serviceTypeName || '').toLowerCase();
  const serviceId = (visit.serviceTypeId || '').toLowerCase();
  const vType = visit.visitType;

  let baseTasks: Array<{ title: string; category: string; required: boolean }>;

  if (serviceName.includes('nurs') || serviceId.includes('nurs') || vType === 'SUPERVISION') {
    baseTasks = [
      { title: 'Clinical assessment of vital signs (BP, HR, SpO2, Temp)', category: 'Clinical', required: true },
      { title: 'Medication administration & reconciliation', category: 'Medication', required: true },
      { title: 'Inspect skin integrity & perform ordered wound care', category: 'Clinical', required: true },
      { title: 'Document skilled nursing progress notes & physician communication', category: 'Documentation', required: true },
    ];
  } else if (vType === 'INITIAL' || vType === 'ASSESSMENT' || serviceName.includes('assess') || serviceName.includes('intake')) {
    baseTasks = [
      { title: 'Comprehensive ADL & IADL functional independence evaluation', category: 'Assessment', required: true },
      { title: 'Verify emergency contact numbers, pharmacy, and physician orders', category: 'Administration', required: true },
      { title: 'Environmental home safety & fall risk hazard inspection', category: 'Safety', required: true },
      { title: 'Establish baseline vital signs and care plan orientation', category: 'Clinical', required: true },
    ];
  } else if (vType === 'RESPITE' || serviceName.includes('respite') || serviceName.includes('companion')) {
    baseTasks = [
      { title: 'Companionship & cognitive stimulation engagement', category: 'Companionship', required: true },
      { title: 'Nutritious meal preparation & hydration encouragement', category: 'Nutrition', required: true },
      { title: 'Assist with light housekeeping & clear pathways', category: 'Environment', required: false },
      { title: 'Ambulatory accompaniment & safety precaution monitoring', category: 'Mobility', required: true },
    ];
  } else if (vType === 'DISCHARGE') {
    baseTasks = [
      { title: 'Final client clinical status & vital signs evaluation', category: 'Clinical', required: true },
      { title: 'Review discharge orders and caregiver handoff instructions', category: 'Care Coordination', required: true },
      { title: 'Reconcile discharge medications & DME equipment transfer', category: 'Medication', required: true },
      { title: 'Complete formal discharge summary documentation', category: 'Administration', required: true },
    ];
  } else {
    // Personal care / default
    baseTasks = [
      { title: 'Assist with morning shower, hygiene, and dressing', category: 'Personal Care', required: true },
      { title: 'Prepare low-sodium breakfast & verify hydration intake', category: 'Nutrition', required: true },
      { title: 'Prompt and observe morning prescribed medications', category: 'Medication', required: true },
      { title: 'Assist with light ambulatory exercises in hallway', category: 'Mobility', required: false },
    ];
  }

  const isCompleted = visit.status === 'COMPLETED';
  const isInProgress = visit.status === 'IN_PROGRESS';
  const completedTimeStr = formatTimeString(visit.actualEndTime ?? visit.actualStartTime ?? visit.scheduledStartTime) ?? undefined;

  return baseTasks.map((t, idx) => {
    let completed = false;
    let completedAt: string | undefined;

    if (isCompleted) {
      completed = true;
      completedAt = completedTimeStr;
    } else if (isInProgress) {
      const tasksCompletedCount = visit.tasksCompleted ?? 2;
      completed = idx < tasksCompletedCount;
      completedAt = completed ? completedTimeStr : undefined;
    }

    return {
      id: `task-${idx + 1}`,
      title: t.title,
      category: t.category,
      completed,
      required: t.required,
      completedAt,
    };
  });
}

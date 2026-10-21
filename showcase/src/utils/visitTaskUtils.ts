import type { Visit, VisitTask } from '../types/showcase-types.js';

export function deriveShowcaseTasks(visit: Visit): VisitTask[] {
  if (visit.tasks && visit.tasks.length > 0) {
    return visit.tasks;
  }

  const services = visit.services || [];
  const serviceStr = services.join(' ').toLowerCase();
  const vType = visit.visitType;

  let baseTasks: Array<{ title: string; category: string; required: boolean }>;

  if (serviceStr.includes('nurs') || vType === 'SUPERVISION') {
    baseTasks = [
      { title: 'Clinical assessment of vital signs (BP, HR, SpO2, Temp)', category: 'Clinical', required: true },
      { title: 'Medication administration & reconciliation', category: 'Medication', required: true },
      { title: 'Inspect skin integrity & perform ordered wound care', category: 'Clinical', required: true },
      { title: 'Document skilled nursing progress notes & physician communication', category: 'Documentation', required: true },
    ];
  } else if (vType === 'INITIAL' || vType === 'ASSESSMENT' || serviceStr.includes('assess') || serviceStr.includes('intake')) {
    baseTasks = [
      { title: 'Complete client intake orientation checklist', category: 'Administration', required: true },
      { title: 'Verify emergency contact numbers and pharmacy', category: 'Administration', required: true },
      { title: 'Bathroom safety and grab-bar inspection', category: 'Safety', required: true },
      { title: 'Establish baseline vital signs', category: 'Vitals', required: true },
    ];
  } else if (vType === 'RESPITE' || serviceStr.includes('respite') || serviceStr.includes('companion')) {
    baseTasks = [
      { title: 'Companionship & cognitive stimulation engagement', category: 'Companionship', required: true },
      { title: 'Nutritious meal preparation & hydration encouragement', category: 'Nutrition', required: true },
      { title: 'Assist with light housekeeping & clear pathways', category: 'Environment', required: false },
      { title: 'Ambulatory accompaniment & safety monitoring', category: 'Mobility', required: true },
    ];
  } else {
    // Personal care / default
    baseTasks = [
      { title: 'Assist with morning shower and dressing', category: 'Personal Care', required: true },
      { title: 'Prepare low-sodium breakfast & hydration', category: 'Nutrition', required: true },
      { title: 'Prompt morning blood pressure medication', category: 'Medication', required: true },
      { title: 'Assist with light ambulatory exercises', category: 'Mobility', required: false },
    ];
  }

  const isCompleted = visit.status === 'COMPLETED';
  const isInProgress = visit.status === 'IN_PROGRESS';
  const timeStr = visit.actualEndTime || visit.actualStartTime || visit.scheduledStartTime;

  return baseTasks.map((t, idx) => ({
    id: `t-${visit.id}-${idx + 1}`,
    title: t.title,
    category: t.category,
    completed: isCompleted ? true : (isInProgress ? idx < 2 : false),
    required: t.required,
    completedAt: (isCompleted || (isInProgress && idx < 2)) ? timeStr : undefined,
  }));
}

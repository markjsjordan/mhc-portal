import type { TaskCategory } from '../types';

export const getTaskCategoryLabel = (category: TaskCategory): string => {
  const labels: Record<TaskCategory, string> = {
    PERSONAL_HYGIENE: 'Personal Hygiene',
    BATHING: 'Bathing',
    DRESSING: 'Dressing',
    GROOMING: 'Grooming',
    TOILETING: 'Toileting',
    MOBILITY: 'Mobility',
    TRANSFERRING: 'Transferring',
    AMBULATION: 'Ambulation',
    MEDICATION: 'Medication',
    MEAL_PREPARATION: 'Meal Preparation',
    FEEDING: 'Feeding',
    HOUSEKEEPING: 'Housekeeping',
    LAUNDRY: 'Laundry',
    SHOPPING: 'Shopping',
    TRANSPORTATION: 'Transportation',
    COMPANIONSHIP: 'Companionship',
    MONITORING: 'Monitoring',
    DOCUMENTATION: 'Documentation',
    OTHER: 'Other',
  };

  return labels[category];
};

export const getTaskCategoryColor = (category: TaskCategory): string => {
  const colors: Record<TaskCategory, string> = {
    PERSONAL_HYGIENE: 'text-blue-600',
    BATHING: 'text-cyan-600',
    DRESSING: 'text-purple-600',
    GROOMING: 'text-pink-600',
    TOILETING: 'text-indigo-600',
    MOBILITY: 'text-green-600',
    TRANSFERRING: 'text-teal-600',
    AMBULATION: 'text-lime-600',
    MEDICATION: 'text-red-600',
    MEAL_PREPARATION: 'text-orange-600',
    FEEDING: 'text-amber-600',
    HOUSEKEEPING: 'text-yellow-600',
    LAUNDRY: 'text-sky-600',
    SHOPPING: 'text-violet-600',
    TRANSPORTATION: 'text-fuchsia-600',
    COMPANIONSHIP: 'text-rose-600',
    MONITORING: 'text-emerald-600',
    DOCUMENTATION: 'text-slate-600',
    OTHER: 'text-gray-600',
  };

  return colors[category];
};

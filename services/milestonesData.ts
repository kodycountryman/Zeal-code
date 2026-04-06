export interface Milestone {
  id: string;
  name: string;
  description: string;
  target: number;
  type: 'workouts' | 'prs' | 'streak';
  icon: string;
}

export const MILESTONES: Milestone[] = [
  { id: 'first5',         name: 'First 5',        description: 'Complete 5 workouts',       target: 5,   type: 'workouts', icon: 'zap' },
  { id: 'pr_machine',     name: 'PR Machine',      description: 'Set 5 personal records',    target: 5,   type: 'prs',      icon: 'trophy' },
  { id: 'first10',        name: 'First 10',        description: 'Complete 10 workouts',      target: 10,  type: 'workouts', icon: 'flame' },
  { id: '7day_streak',    name: '7-Day Streak',    description: 'Keep a 7-day streak',       target: 7,   type: 'streak',   icon: 'flame' },
  { id: 'record_breaker', name: 'Record Breaker',  description: 'Set 15 personal records',   target: 15,  type: 'prs',      icon: 'award' },
  { id: 'quarter_century',name: 'Quarter Century', description: 'Complete 25 workouts',      target: 25,  type: 'workouts', icon: 'medal' },
  { id: 'half_century',   name: 'Half Century',    description: 'Complete 50 workouts',      target: 50,  type: 'workouts', icon: 'crown' },
  { id: '30day_streak',   name: '30-Day Streak',   description: 'Keep a 30-day streak',      target: 30,  type: 'streak',   icon: 'shield' },
  { id: 'century',        name: 'Century',         description: 'Complete 100 workouts',     target: 100, type: 'workouts', icon: 'medal' },
  { id: 'iron_will',      name: 'Iron Will',       description: 'Train 365 total days',      target: 365, type: 'workouts', icon: 'shield' },
];

export function computeMilestoneProgress(
  totalWorkouts: number,
  totalPRs: number,
  currentStreak: number,
) {
  return MILESTONES.map((m) => {
    let current = 0;
    if (m.type === 'workouts') current = totalWorkouts;
    else if (m.type === 'prs') current = totalPRs;
    else if (m.type === 'streak') current = currentStreak;
    const clamped = Math.min(current, m.target);
    return { ...m, current: clamped, completed: clamped >= m.target };
  });
}

export function calcCurrentStreak(workoutDates: string[]): number {
  const dates = new Set(workoutDates);
  if (dates.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (dates.has(ds)) { streak++; } else { if (i === 0) continue; break; }
  }
  return streak;
}

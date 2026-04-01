import type { MuscleReadinessItem } from '@/context/AppContext';

/**
 * Given current muscle readiness, returns which Push/Pull/Legs focus has the
 * highest average readiness (i.e. least fatigue) so the day's workout targets
 * the freshest muscle group.
 */
export function resolvePushPullLegs(muscleReadiness: MuscleReadinessItem[]): 'Push' | 'Pull' | 'Legs' {
  const readinessMap: Record<string, number> = {};
  for (const m of muscleReadiness) readinessMap[m.name] = m.value;

  const avg = (muscles: string[]) => {
    const vals = muscles.map(m => readinessMap[m] ?? 80);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const pushScore = avg(['Chest', 'Shoulders', 'Triceps']);
  const pullScore = avg(['Back', 'Biceps']);
  const legsScore = avg(['Quads', 'Hamstrings', 'Glutes', 'Calves']);

  if (pushScore >= pullScore && pushScore >= legsScore) return 'Push';
  if (pullScore > pushScore && pullScore >= legsScore) return 'Pull';
  return 'Legs';
}

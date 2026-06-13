export function normalizeExerciseName(name) {
  return name.trim().toLowerCase().replace(/[-_\s]+/g, ' ')
}

export const ALL_WORKOUT_TYPES = ['Push', 'Pull', 'Legs', 'Cardio']

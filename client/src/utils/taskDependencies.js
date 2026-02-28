/**
 * Compute dependency info from the tasks array.
 * Returns blockedTaskIds (Set) and reverseDepMap (Map).
 */
export function computeDependencyInfo(tasks) {
  const blockedTaskIds = new Set();
  const reverseDepMap = new Map();

  if (!tasks) return { blockedTaskIds, reverseDepMap };

  for (const task of tasks) {
    if (!task.dependencies || task.dependencies.length === 0) continue;

    const hasIncompleteDep = task.dependencies.some(d => d.status !== 'completed');
    if (hasIncompleteDep) {
      blockedTaskIds.add(task._id);
    }

    for (const dep of task.dependencies) {
      if (!reverseDepMap.has(dep._id)) {
        reverseDepMap.set(dep._id, []);
      }
      reverseDepMap.get(dep._id).push({
        _id: task._id,
        title: task.title,
        status: task.status,
      });
    }
  }

  return { blockedTaskIds, reverseDepMap };
}

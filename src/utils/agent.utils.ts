import { MarketingTaskMetadata } from "../types/agent/agent.types"

/**
 * Validate task dependencies
 */
export function validateTaskDependencies(tasks: MarketingTaskMetadata[]): { 
  valid: boolean, 
  errors: string[] 
} {

  const errors: string[] = [];
  const taskNames = new Set(tasks.map(task => task.taskName));

  // Check for duplicate task names
  const nameLookupTable = new Map<string, number>();
  for (const task of tasks) {
    nameLookupTable.set(task.taskName, (nameLookupTable.get(task.taskName) || 0) + 1);
  }
  for (const [name, count] of nameLookupTable.entries()) {
    if (count > 1) {
      errors.push(`Duplicate task name: "${name}" appears ${count} times`);
    }
  }

  // Verify that dependencies point to existing tasks
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskNames.has(dep)) {
        errors.push(`Task "${task.taskName}" depends on non-existent task "${dep}"`);
      }
    }
  }

  // Check for circular dependencies
  const visited = new Set<string>;
  const recursionStack = new Set<string>();

  function hasCycle(taskName: string): boolean {
    visited.add(taskName);
    recursionStack.add(taskName);

    const matchedTask = tasks.find(task => task.taskName === taskName);
    if (!matchedTask) return false;

    for (const dep of matchedTask.dependencies) {
      if (!visited.has(dep)) {
        if (hasCycle(dep)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        return true;
      }
    }
    
    recursionStack.delete(taskName);
    return false;
  }

  for (const task of tasks) {
    if (!visited.has(task.taskName) && hasCycle(task.taskName)) {
      errors.push(`Circular dependency detected: "${task.taskName}" is part of a cycle`);
    }
  }

  // Check dependency chain depth
  function getMaxDepth(taskName: string, visited = new Set<string>()): number {
    if (visited.has(taskName)) return 0;

    const newVisited = new Set(visited);
    newVisited.add(taskName);

    const task = tasks.find(t => t.taskName === taskName);
    if (!task || task.dependencies.length === 0) return 0;

    const depths = task.dependencies.map(dep => getMaxDepth(dep, newVisited));
    return 1 + Math.max(...depths, 0);

    }

  const maxDepth = tasks.length > 0
    ? Math.max(...tasks.map(t => getMaxDepth(t.taskName)))
    : 0;
  if (maxDepth > 3) {
    errors.push(`Warning: Dependency chain depth ${maxDepth} exceeds recommended max (3)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
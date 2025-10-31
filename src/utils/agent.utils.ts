import { MarketingTaskMetadata } from "../types/agent/agent.types"

/**
 * Validate task dependencies
 * 
 * Checks:
 * 1. No duplicate task names
 * 2. Dependencies point to existing tasks (by taskName)
 * 3. No circular dependencies
 * 4. Dependency chain depth within limits
 */
export function validateTaskDependencies(tasks: MarketingTaskMetadata[]): { 
  valid: boolean, 
  errors: string[] 
} {
  
  const errors: string[] = [];

  // Handle empty task list
  if (tasks.length === 0) {
    return { valid: true, errors: [] };
  }

  const taskNames = new Set(tasks.map(task => task.taskName));

  // Check for duplicate task names
  const taskNameMap = new Map<string, number>();
  for (const task of tasks) {
    taskNameMap.set(task.taskName, (taskNameMap.get(task.taskName) || 0) + 1);
  }
  for (const [name, count] of taskNameMap.entries()) {
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

/**
 * Topological sort using Kahn's algorithm
 * 
 */
export function topologicalSort(tasks: MarketingTaskMetadata[]): string[] {
  // Build task map for lookup
  const taskMap = new Map<string, MarketingTaskMetadata>();
  for (const task of tasks) {
    taskMap.set(task.taskId, task);
  }

  // Build taskName -> taskID mapping
  const name2IdMap = new Map<string, string>();
  for (const task of tasks) {
    name2IdMap.set(task.taskName, task.taskId);
  }

  // Calculate in-degree (number of dependencies) for each task
  // And adjacency list: taskId -> [dependent taskIds]
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  // Initialize
  for (const task of tasks) {
    inDegree.set(task.taskId, 0);
    adjacencyList.set(task.taskId, []);
  }

  // BUild graph
  for (const task of tasks) {
    for (const depName of task.dependencies) {
      const depId = name2IdMap.get(depName);
      if (depId) {
        // depId -> task.taskId
        inDegree.set(task.taskId, inDegree.get(task.taskId)! + 1);
        adjacencyList.get(depId)!.push(task.taskId);
      }
    }
  }

  // Find all tasks without dependencies (in-degree = 0)
  const taskQueueNoDep: string[] = [];
  for (const [taskId, degree] of inDegree.entries()) {
    if (degree === 0) {
      taskQueueNoDep.push(taskId);
    }
  }

  const sortedTasks: string[] = [];
  while (taskQueueNoDep.length > 0) {
    const currentTask = taskQueueNoDep.shift()!;
    sortedTasks.push(currentTask);

    // Reduce in-degree for dependent tasks
    const dependents = adjacencyList.get(currentTask) || [];
    for (const depTaskId of dependents) {
      const newDegree = inDegree.get(depTaskId)! - 1;
      inDegree.set(depTaskId, newDegree);

      if (newDegree === 0) {
        taskQueueNoDep.push(depTaskId);
      }
    }
  }

  // Check for circular dependencies
  if (sortedTasks.length !== tasks.length) {
    const unsortedTasks = tasks
      .filter(t => !sortedTasks.includes(t.taskId))
      .map(t => t.taskName);
    throw new Error(
      `Circular dependency detected. Unsorted tasks: ${unsortedTasks.join(", ")}`
    );
  }

  return sortedTasks;
}

/**
 * Group tasks into execution batches based on dependencies
 * Tasks in the same batch can be executed in parallel
 */
export function groupIntoBatches(
  tasks: MarketingTaskMetadata[],
  sortedTaskIds: string[]
): string[][] {
  // Build task map for lookup: taskId -> task
  const taskMap = new Map<string, MarketingTaskMetadata>();
  for (const task of tasks) {
    taskMap.set(task.taskId, task);
  }

  // Build taskName -> taskID mapping
  const name2IdMap = new Map<string, string>();
  for (const task of tasks) {
    name2IdMap.set(task.taskName, task.taskId);
  }

  const batches: string[][] = [];
  const completed = new Set<string>();

  let currentBatch: string[] = [];

  for (const taskId of sortedTaskIds) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    // Convert dependency names to IDs
    const depIds = task.dependencies
      .map(name => name2IdMap.get(name))
      .filter((id): id is string => id !== undefined);

    // Check if all dependencies are completed
    const allDepsCompleted = depIds.every(depId => completed.has(depId));

    if (allDepsCompleted) {
      // Can be added to current batch
      currentBatch.push(taskId);
    } else {
      // Need to start new batch
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch.forEach(id => completed.add(id));
      }
      currentBatch = [taskId];
    }
  }

  // Add last batch
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Sort tasks within a batch by priority
 * High priority tasks should be executed first
 */
export function sortByPriority(
  taskIds: string[],
  taskMap: Map<string, MarketingTaskMetadata>
): string[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  
  return taskIds.sort((a, b) => {
    const taskA = taskMap.get(a);
    const taskB = taskMap.get(b);

    if (!taskA || !taskB) return 0;

    const priorityA = priorityOrder[taskA.priority];
    const priorityB = priorityOrder[taskB.priority];

    return priorityA - priorityB;
  });
}


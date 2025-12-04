

import { validateTaskDependencies, topologicalSort } from "../../../src/utils/agent.utils"
import { MarketingTaskMetadata } from '../../../src/common/types/agent/agent.types';

describe('validateTaskDependencies', () => {
  test('should validate normal task dependencies successfully', () => {
    const normalTasks: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Market Analysis", 
        dependencies: [], 
        priority: "high" 
      },
      { 
        taskId: "task-2", 
        taskName: "Competitor Research", 
        dependencies: ["Market Analysis"], 
        priority: "medium" 
      },
    ];

    const result = validateTaskDependencies(normalTasks);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should handle empty task list', () => {
    const emptyTasks: MarketingTaskMetadata[] = [];

    const result = validateTaskDependencies(emptyTasks);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should detect duplicate task names', () => {
    const duplicateTasks: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Analysis", 
        dependencies: [], 
        priority: "high" 
      },
      { 
        taskId: "task-2", 
        taskName: "Analysis", 
        dependencies: [], 
        priority: "medium" 
      },
    ];

    const result = validateTaskDependencies(duplicateTasks);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate task name: "Analysis" appears 2 times');
  });

  test('should detect multiple duplicate task names', () => {
    const multipleDuplicates: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Analysis", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Analysis", dependencies: [], priority: "medium" },
      { taskId: "task-3", taskName: "Research", dependencies: [], priority: "high" },
      { taskId: "task-4", taskName: "Research", dependencies: [], priority: "low" },
      { taskId: "task-5", taskName: "Research", dependencies: [], priority: "medium" },
    ];

    const result = validateTaskDependencies(multipleDuplicates);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Duplicate task name: "Analysis" appears 2 times');
    expect(result.errors).toContain('Duplicate task name: "Research" appears 3 times');
  });

  test('should detect non-existent dependencies', () => {
    const invalidDepTasks: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Task A", 
        dependencies: ["Non-existent Task"], 
        priority: "high" 
      },
    ];

    const result = validateTaskDependencies(invalidDepTasks);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Task "Task A" depends on non-existent task "Non-existent Task"'
    );
  });

  test('should detect multiple non-existent dependencies', () => {
    const multipleMissingDeps: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Task A", 
        dependencies: ["Missing 1", "Missing 2"], 
        priority: "high" 
      },
      { 
        taskId: "task-2", 
        taskName: "Task B", 
        dependencies: ["Task A", "Missing 3"], 
        priority: "medium" 
      },
    ];

    const result = validateTaskDependencies(multipleMissingDeps);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Task "Task A" depends on non-existent task "Missing 1"');
    expect(result.errors).toContain('Task "Task A" depends on non-existent task "Missing 2"');
    expect(result.errors).toContain('Task "Task B" depends on non-existent task "Missing 3"');
  });

  test('should detect simple circular dependency', () => {
    const simpleCircular: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Task A", 
        dependencies: ["Task B"], 
        priority: "high" 
      },
      { 
        taskId: "task-2", 
        taskName: "Task B", 
        dependencies: ["Task A"], 
        priority: "medium" 
      },
    ];

    const result = validateTaskDependencies(simpleCircular);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes("Circular dependency detected"))).toBe(true);
  });

  test('should detect complex circular dependency', () => {
    const circularTasks: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Task A", 
        dependencies: ["Task B"], 
        priority: "high" 
      },
      { 
        taskId: "task-2", 
        taskName: "Task B", 
        dependencies: ["Task C"], 
        priority: "medium" 
      },
      { 
        taskId: "task-3", 
        taskName: "Task C", 
        dependencies: ["Task A"], 
        priority: "low" 
      },
    ];

    const result = validateTaskDependencies(circularTasks);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes("Circular dependency detected"))).toBe(true);
  });

  test('should detect self-referencing circular dependency', () => {
    const selfCircular: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Task A", 
        dependencies: ["Task A"], 
        priority: "high" 
      },
    ];

    const result = validateTaskDependencies(selfCircular);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should pass with dependency chain depth within limit', () => {
    const normalDepth: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task B"], priority: "medium" },
    ];

    const result = validateTaskDependencies(normalDepth);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should warn when dependency chain depth exceeds limit', () => {
    const deepTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task B"], priority: "medium" },
      { taskId: "task-4", taskName: "Task D", dependencies: ["Task C"], priority: "medium" },
      { taskId: "task-5", taskName: "Task E", dependencies: ["Task D"], priority: "low" },
    ];

    const result = validateTaskDependencies(deepTasks);

    // Note: Based on current implementation, warnings are treated as errors
    // If warnings array is separated, this test should be updated
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes("depth"))).toBe(true);
  });

  test('should validate complex valid dependency graph', () => {
    const complexValid: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Market Size", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Tech Trends", dependencies: [], priority: "medium" },
      { taskId: "task-3", taskName: "Policy Analysis", dependencies: [], priority: "medium" },
      { taskId: "task-4", taskName: "Regional Analysis", dependencies: ["Market Size"], priority: "high" },
      { taskId: "task-5", taskName: "Competition", dependencies: ["Market Size"], priority: "high" },
      { taskId: "task-6", taskName: "Supply Chain", dependencies: ["Tech Trends"], priority: "high" },
      { 
        taskId: "task-7", 
        taskName: "Investment", 
        dependencies: ["Competition", "Supply Chain", "Policy Analysis"], 
        priority: "high" 
      },
    ];

    const result = validateTaskDependencies(complexValid);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should validate multiple independent tasks', () => {
    const independentTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: [], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: [], priority: "medium" },
      { taskId: "task-4", taskName: "Task D", dependencies: [], priority: "low" },
    ];

    const result = validateTaskDependencies(independentTasks);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('should detect multiple types of errors', () => {
    const mixedErrors: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Analysis", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Analysis", dependencies: ["Missing Task"], priority: "medium" },
      { taskId: "task-3", taskName: "Research", dependencies: ["Analysis"], priority: "low" },
    ];

    const result = validateTaskDependencies(mixedErrors);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
    expect(result.errors.some(e => e.includes("Duplicate"))).toBe(true);
    expect(result.errors.some(e => e.includes("non-existent"))).toBe(true);
  });

  test('should validate diamond dependency structure', () => {
    const diamondDeps: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task A"], priority: "high" },
      { 
        taskId: "task-4", 
        taskName: "Task D", 
        dependencies: ["Task B", "Task C"], 
        priority: "medium" 
      },
    ];

    const result = validateTaskDependencies(diamondDeps);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('topologicalSort', () => {
  test('should handle empty task list', () => {
    const emptyTasks: MarketingTaskMetadata[] = [];
    const result = topologicalSort(emptyTasks);
    
    expect(result).toEqual([]);
  });

  test('should handle single task with no dependencies', () => {
    const singleTask: MarketingTaskMetadata[] = [
      { 
        taskId: "task-1", 
        taskName: "Market Analysis", 
        dependencies: [], 
        priority: "high" 
      },
    ];
    
    const result = topologicalSort(singleTask);
    
    expect(result).toEqual(["task-1"]);
  });

  test('should handle multiple independent tasks', () => {
    const independentTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Market Analysis", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Tech Research", dependencies: [], priority: "medium" },
      { taskId: "task-3", taskName: "Policy Study", dependencies: [], priority: "low" },
    ];
    
    const result = topologicalSort(independentTasks);
    expect(result.length).toBe(3);
    expect(result).toContain("task-1");
    expect(result).toContain("task-2");
    expect(result).toContain("task-3");
  });

  test('should sort linear dependency chain correctly', () => {
    const linearTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task B"], priority: "medium" },
      { taskId: "task-4", taskName: "Task D", dependencies: ["Task C"], priority: "low" },
    ];
    
    const result = topologicalSort(linearTasks);
    
    expect(result).toEqual(["task-1", "task-2", "task-3", "task-4"]);
  });

  test('should handle diamond dependency structure', () => {
    const diamondTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task A"], priority: "high" },
      { 
        taskId: "task-4", 
        taskName: "Task D", 
        dependencies: ["Task B", "Task C"], 
        priority: "medium" 
      },
    ];
    
    const result = topologicalSort(diamondTasks);
    
    expect(result.length).toBe(4);
    expect(result[0]).toBe("task-1");
    expect(result[3]).toBe("task-4");
    
    // task-2 and task-3 should be before of task-4
    const indexTask2 = result.indexOf("task-2");
    const indexTask3 = result.indexOf("task-3");
    const indexTask4 = result.indexOf("task-4");
    
    expect(indexTask2).toBeLessThan(indexTask4);
    expect(indexTask3).toBeLessThan(indexTask4);
  });

  test('should sort complex dependency graph correctly', () => {
    const complexTasks: MarketingTaskMetadata[] = [
      {
        taskId: "task-1",
        taskName: "Macro Market Size Assessment",
        priority: "high",
        dependencies: [],
      },
      {
        taskId: "task-2",
        taskName: "Regional Market Segmentation",
        priority: "high",
        dependencies: ["Macro Market Size Assessment"],
      },
      {
        taskId: "task-3",
        taskName: "Competitive Landscape Analysis",
        priority: "high",
        dependencies: ["Macro Market Size Assessment"],
      },
      {
        taskId: "task-4",
        taskName: "Technology Trends Research",
        priority: "medium",
        dependencies: [],
      },
      {
        taskId: "task-5",
        taskName: "Supply Chain Analysis",
        priority: "high",
        dependencies: ["Technology Trends Research"],
      },
      {
        taskId: "task-6",
        taskName: "Policy Environment Analysis",
        priority: "medium",
        dependencies: [],
      },
      {
        taskId: "task-7",
        taskName: "Investment Opportunity Assessment",
        priority: "high",
        dependencies: ["Competitive Landscape Analysis", "Supply Chain Analysis", "Policy Environment Analysis"],
      },
    ];
    
    const result = topologicalSort(complexTasks);
    
    // Verify result length
    expect(result.length).toBe(7);
    
    // Verify dependency relationships
    const indexOf = (taskId: string) => result.indexOf(taskId);
    
    // task-1 should be before task-2 and task-3
    expect(indexOf("task-1")).toBeLessThan(indexOf("task-2"));
    expect(indexOf("task-1")).toBeLessThan(indexOf("task-3"));
    
    // task-4 should be before task-5
    expect(indexOf("task-4")).toBeLessThan(indexOf("task-5"));
    
    // task-7 should be after all its dependencies
    expect(indexOf("task-3")).toBeLessThan(indexOf("task-7"));
    expect(indexOf("task-5")).toBeLessThan(indexOf("task-7"));
    expect(indexOf("task-6")).toBeLessThan(indexOf("task-7"));
    
    // Verify task-1, task-4, task-6 can be executed in first batch (no dependencies)
    const firstBatch = [indexOf("task-1"), indexOf("task-4"), indexOf("task-6")];
    const maxFirstBatchIndex = Math.max(...firstBatch);
    
    // task-2, task-3, task-5 should be after the first batch
    expect(maxFirstBatchIndex).toBeLessThan(indexOf("task-2"));
    expect(maxFirstBatchIndex).toBeLessThan(indexOf("task-3"));
    expect(maxFirstBatchIndex).toBeLessThan(indexOf("task-5"));
  });

  test('should handle multiple tasks depending on same task', () => {
    const fanOutTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Market Size", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Regional A", dependencies: ["Market Size"], priority: "high" },
      { taskId: "task-3", taskName: "Regional B", dependencies: ["Market Size"], priority: "high" },
      { taskId: "task-4", taskName: "Regional C", dependencies: ["Market Size"], priority: "medium" },
    ];
    
    const result = topologicalSort(fanOutTasks);
    
    expect(result.length).toBe(4);
    expect(result[0]).toBe("task-1");
    
    const indexTask1 = result.indexOf("task-1");
    expect(result.indexOf("task-2")).toBeGreaterThan(indexTask1);
    expect(result.indexOf("task-3")).toBeGreaterThan(indexTask1);
    expect(result.indexOf("task-4")).toBeGreaterThan(indexTask1);
  });

  test('should handle task with multiple dependencies', () => {
    const fanInTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: [], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: [], priority: "medium" },
      { 
        taskId: "task-4", 
        taskName: "Summary", 
        dependencies: ["Task A", "Task B", "Task C"], 
        priority: "high" 
      },
    ];
    
    const result = topologicalSort(fanInTasks);
    
    expect(result.length).toBe(4);
    expect(result[3]).toBe("task-4");
    
    // task-1, task-2, task-3 should be before of task-4
    expect(result.indexOf("task-1")).toBeLessThan(3);
    expect(result.indexOf("task-2")).toBeLessThan(3);
    expect(result.indexOf("task-3")).toBeLessThan(3);
  });

  test('should throw error on simple circular dependency', () => {
    const circularTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: ["Task B"], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "medium" },
    ];
    
    expect(() => topologicalSort(circularTasks)).toThrow("Circular dependency detected");
  });

  test('should throw error on complex circular dependency', () => {
    const circularTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: ["Task B"], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task C"], priority: "medium" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task A"], priority: "low" },
    ];
    
    expect(() => topologicalSort(circularTasks)).toThrow("Circular dependency detected");
  });

  test('should throw error on self-referencing circular dependency', () => {
    const selfCircular: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: ["Task A"], priority: "high" },
    ];
    
    expect(() => topologicalSort(selfCircular)).toThrow("Circular dependency detected");
  });

  test('should handle missing dependencies gracefully', () => {
    const missingDepTasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A", "Non-existent"], priority: "medium" },
    ];
    
    // Errors should not be thrown, non-existent dependencies should be ignored.
    const result = topologicalSort(missingDepTasks);
    
    expect(result.length).toBe(2);
    expect(result[0]).toBe("task-1");
    expect(result[1]).toBe("task-2");
  });

  test('should handle complex multi-level dependencies', () => {
    const multiLevel: MarketingTaskMetadata[] = [
      // Level 0
      { taskId: "task-1", taskName: "Data Collection", dependencies: [], priority: "high" },
      
      // Level 1
      { taskId: "task-2", taskName: "Data Cleaning", dependencies: ["Data Collection"], priority: "high" },
      
      // Level 2
      { taskId: "task-3", taskName: "Statistical Analysis", dependencies: ["Data Cleaning"], priority: "high" },
      { taskId: "task-4", taskName: "Trend Analysis", dependencies: ["Data Cleaning"], priority: "medium" },
      
      // Level 3
      { 
        taskId: "task-5", 
        taskName: "Report Generation", 
        dependencies: ["Statistical Analysis", "Trend Analysis"], 
        priority: "high" 
      },
      
      // Parallel track
      { taskId: "task-6", taskName: "Market Research", dependencies: [], priority: "medium" },
      { taskId: "task-7", taskName: "Competitor Analysis", dependencies: ["Market Research"], priority: "high" },
      
      // Final
      { 
        taskId: "task-8", 
        taskName: "Final Summary", 
        dependencies: ["Report Generation", "Competitor Analysis"], 
        priority: "high" 
      },
    ];
    
    const result = topologicalSort(multiLevel);
    
    expect(result.length).toBe(8);
    const indexOf = (taskId: string) => result.indexOf(taskId);
    
    // Level 0
    expect(indexOf("task-1")).toBeLessThan(indexOf("task-2"));
    expect(indexOf("task-6")).toBeLessThan(indexOf("task-7"));
    
    // Level 1
    expect(indexOf("task-2")).toBeLessThan(indexOf("task-3"));
    expect(indexOf("task-2")).toBeLessThan(indexOf("task-4"));
    
    // Level 2
    expect(indexOf("task-3")).toBeLessThan(indexOf("task-5"));
    expect(indexOf("task-4")).toBeLessThan(indexOf("task-5"));
    
    // Level 3
    expect(indexOf("task-7")).toBeLessThan(indexOf("task-8"));
    
    // Final
    expect(indexOf("task-5")).toBeLessThan(indexOf("task-8"));
    expect(indexOf("task-7")).toBeLessThan(indexOf("task-8"));
    
    // task-8
    expect(result[7]).toBe("task-8");
  });

  test('should produce consistent results for same input', () => {
    const tasks: MarketingTaskMetadata[] = [
      { taskId: "task-1", taskName: "Task A", dependencies: [], priority: "high" },
      { taskId: "task-2", taskName: "Task B", dependencies: ["Task A"], priority: "high" },
      { taskId: "task-3", taskName: "Task C", dependencies: ["Task A"], priority: "medium" },
    ];
    
    const result1 = topologicalSort(tasks);
    const result2 = topologicalSort(tasks);
    
    expect(result1).toEqual(result2);
  });

  test('should handle large number of tasks efficiently', () => {
    const largeTasks: MarketingTaskMetadata[] = [];
    
    for (let i = 1; i <= 100; i++) {
      largeTasks.push({
        taskId: `task-${i}`,
        taskName: `Task ${i}`,
        dependencies: i > 1 ? [`Task ${i - 1}`] : [],
        priority: i % 3 === 0 ? "low" : i % 2 === 0 ? "medium" : "high",
      });
    }
    
    const startTime = Date.now();
    const result = topologicalSort(largeTasks);
    const endTime = Date.now();
    
    expect(result.length).toBe(100);
    expect(result[0]).toBe("task-1");
    expect(result[99]).toBe("task-100");
    expect(endTime - startTime).toBeLessThan(100);
  });

});


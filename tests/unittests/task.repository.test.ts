import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import {TaskRepository } from "../../src/database/repositories/task.repository";
import {
  TaskNotFoundException,
  CampaignNotFoundException,
} from "../../src/common/exceptions/database.exceptions";
import { PrismaService } from "../../src/database/prisma/prisma.service";
import { 
  Task, 
  TaskStatus, 
  Campaign, 
  CampaignStatus,
  LLMInput,
  LLMResult 
} from "../../src/types/database/entities.types";
import { 
  CreateTaskData, 
  UpdateTaskData,
  ListTasksOptions 
} from "../../src/types/database/task.types";


describe("TaskRepository", () => {
  let taskRepository: TaskRepository;
  let mockPrismaService: any;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn; 

  // use complete mock data
  const mockCampaign: Campaign = {
    id: "campaign-1",
    userId: "user-1",
    name: "Summer Sale 2025",
    description: "A campaign for summer products.",
    status: CampaignStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLLMInput: LLMInput = {
    prompt: "Generate marketing content for summer sale",
    context: { targetAudience: "millennials" },
    modelParameters: { temperature: 0.7, maxTokens: 500 },
  };

  const mockLLMResult: LLMResult = {
    rawOutput: "Generated marketing content...",
    processedOutput: { headline: "Summer Sale!", body: "Get 50% off!" },
    metadata: { tokensUsed: 450, model: "gpt-4" },
  };

  const mockTaskWithoutCampaign: Task = {
    id: "task-1",
    campaignId: "campaign-1",
    status: TaskStatus.PENDING,
    priority: 1,
    input: mockLLMInput,
    result: null,
    error: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
  };

  const mockTaskWithCampaign: Task = {
    ...mockTaskWithoutCampaign,
    campaign: mockCampaign,
  };

  const mockCompletedTask: Task = {
    ...mockTaskWithoutCampaign,
    id: "task-2",
    status: TaskStatus.COMPLETED,
    result: mockLLMResult,
  };

  const mockFailedTask: Task = {
    ...mockTaskWithoutCampaign,
    id: "task-3",
    status: TaskStatus.FAILED,
    error: "API rate limit exceeded",
  };

  // ==================== Setup & Teardown ====================

  beforeAll(() => {
    originalConsoleError = console.error;
    originalConsoleWarn = console.warn;
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  beforeEach(() => {
    // create a PrismaService mock
    mockPrismaService = {
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      campaign: {
        findUnique: jest.fn(),
      },
      logger: {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
      },
      // handlePrismaError: jest.fn((error) => { throw error; }),
      handlePrismaError: (error: unknown, context: string) =>
        PrismaService.prototype.handlePrismaError.call(mockPrismaService, error, context),
    };

    // inject this mocked service into the TaskRepository constructor,
    taskRepository = new TaskRepository(mockPrismaService as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==================== createTask Tests ====================
  describe("createTask", () => {
    const validCreateData: CreateTaskData = {
      campaignId: "campaign-1",
      input: mockLLMInput,
      priority: 5,
      status: TaskStatus.PENDING,
    };

    it("should create a task without campaign (default behavior)", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue({ id: "campaign-1" });
      mockPrismaService.task.create.mockResolvedValue(mockTaskWithoutCampaign);

      const result = await taskRepository.createTask(validCreateData);

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        select: { id: true },
      });

      expect(mockPrismaService.task.create).toHaveBeenCalledWith({
        data: {
          campaignId: "campaign-1",
          input: mockLLMInput,
          priority: 5,
          status: TaskStatus.PENDING,
        },
        include: { campaign: false },
      });

      expect(result.id).toBe("task-1");
      expect(result.campaignId).toBe("campaign-1");
      expect(result.status).toBe(TaskStatus.PENDING);
      expect(result.campaign).toBeUndefined();
    });

    it("should create a task with campaign when includeCampaign is true", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue({ id: "campaign-1" });
      mockPrismaService.task.create.mockResolvedValue(mockTaskWithCampaign);

      const result = await taskRepository.createTask(validCreateData, true);

      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { campaign: true },
        })
      );

      expect(result.campaign).toBeDefined();
      expect(result.campaign?.id).toBe("campaign-1");
      expect(result.campaign?.status).toBe(CampaignStatus.ACTIVE);
    });

    it("should use default values when priority and status are not provided", async () => {
      const minimalData: CreateTaskData = {
        campaignId: "campaign-1",
        input: mockLLMInput,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue({ id: "campaign-1" });
      mockPrismaService.task.create.mockResolvedValue(mockTaskWithoutCampaign);

      await taskRepository.createTask(minimalData);

      expect(mockPrismaService.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: undefined,
            status: undefined,
          }),
        })
      );
    });

    it("should throw CampaignNotFoundException when campaign does not exist", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(null);

      await expect(
        taskRepository.createTask(validCreateData)
      ).rejects.toThrow(CampaignNotFoundException);

      expect(mockPrismaService.task.create).not.toHaveBeenCalled();
    });

    it("should handle Prisma errors correctly", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue({ id: "campaign-1" });
      
      const prismaError = new PrismaClientKnownRequestError(
        "Foreign key constraint failed",
        { code: "P2003", clientVersion: "5.0.0" }
      );
      mockPrismaService.task.create.mockRejectedValue(prismaError);

      await expect(
        taskRepository.createTask(validCreateData)
      ).rejects.toThrow();
    });
  });

  // ==================== findTaskById Tests ====================

  describe("findTaskById", () => {
    it("should find a task by ID without campaign (default)", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTaskWithoutCampaign);

      const result = await taskRepository.findTaskById("task-1");

      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { id: "task-1" },
        include: { campaign: false },
      });

      expect(result.id).toBe("task-1");
      expect(result.campaign).toBeUndefined();
    });

    it("should find a task by ID with campaign when requested", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTaskWithCampaign);

      const result = await taskRepository.findTaskById("task-1", true);

      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { id: "task-1" },
        include: { campaign: true },
      });

      expect(result.campaign).toBeDefined();
      expect(result.campaign?.name).toBe("Summer Sale 2025");
    });

    it("should throw TaskNotFoundException when task is not found", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      await expect(
        taskRepository.findTaskById("non-existent-id")
      ).rejects.toThrow(TaskNotFoundException);
    });

    it("should handle tasks with different statuses correctly", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockCompletedTask);

      const result = await taskRepository.findTaskById("task-2");

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.result).toBeDefined();
      expect(result.result?.rawOutput).toBe("Generated marketing content...");
    });

    it("should handle tasks with errors correctly", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockFailedTask);

      const result = await taskRepository.findTaskById("task-3");

      expect(result.status).toBe(TaskStatus.FAILED);
      expect(result.error).toBe("API rate limit exceeded");
    });
  });

  // ==================== updateTask Tests ====================

  describe("updateTask", () => {
    it("should update task status", async () => {
      const updateData: UpdateTaskData = { status: TaskStatus.COMPLETED };
      const updatedTask = { ...mockTaskWithoutCampaign, status: TaskStatus.COMPLETED };
      
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask("task-1", updateData);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { status: TaskStatus.COMPLETED },
        include: { campaign: false },
      });

      expect(result.status).toBe(TaskStatus.COMPLETED);
    });

    it("should update task priority", async () => {
      const updateData: UpdateTaskData = { priority: 10 };
      const updatedTask = { ...mockTaskWithoutCampaign, priority: 10 };
      
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask("task-1", updateData);

      expect(result.priority).toBe(10);
    });

    it("should update task result", async () => {
      const updateData: UpdateTaskData = { result: mockLLMResult };
      const updatedTask = { ...mockTaskWithoutCampaign, result: mockLLMResult };
      
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask("task-1", updateData);

      expect(result.result).toBeDefined();
      expect(result.result?.rawOutput).toBe("Generated marketing content...");
    });

    it("should update task error message", async () => {
      const updateData: UpdateTaskData = { error: "Connection timeout" };
      const updatedTask = { ...mockTaskWithoutCampaign, error: "Connection timeout" };
      
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask("task-1", updateData);

      expect(result.error).toBe("Connection timeout");
    });

    it("should clear task error with explicit null", async () => {
      const updateData: UpdateTaskData = { error: null };
      const updatedTask = { ...mockTaskWithoutCampaign, error: null };
      
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask("task-1", updateData);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ error: null }),
        })
      );

      expect(result.error).toBeNull();
    });

    it("should update multiple fields at once", async () => {
      const updateData: UpdateTaskData = {
        status: TaskStatus.COMPLETED,
        priority: 8,
        result: mockLLMResult,
        error: null,
      };
      
      const updatedTask = { 
        ...mockTaskWithoutCampaign, 
        ...updateData,
        error: null,
      };
      
      mockPrismaService.task.update.mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask("task-1", updateData);

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.priority).toBe(8);
      expect(result.result).toBeDefined();
      expect(result.error).toBeNull();
    });

    it("should return current state when update data is empty", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTaskWithoutCampaign);

      const result = await taskRepository.updateTask("task-1", {});

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Attempted to update task task-1 with empty data")
      );
      expect(mockPrismaService.task.update).not.toHaveBeenCalled();
      expect(mockPrismaService.task.findUnique).toHaveBeenCalled();
      expect(result.id).toBe("task-1");
    });

    it("should include campaign when requested", async () => {
      const updateData: UpdateTaskData = { status: TaskStatus.PROCESSING };
      
      mockPrismaService.task.update.mockResolvedValue(mockTaskWithCampaign);

      const result = await taskRepository.updateTask("task-1", updateData, true);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { campaign: true },
        })
      );

      expect(result.campaign).toBeDefined();
    });

    it("should throw TaskNotFoundException when task does not exist", async () => {
      const updateData: UpdateTaskData = { status: TaskStatus.PROCESSING };
      
      const prismaError = new PrismaClientKnownRequestError(
        "Record to update not found.",
        { code: "P2025", clientVersion: "5.0.0" }
      );
      mockPrismaService.task.update.mockRejectedValue(prismaError);

      await expect(
        taskRepository.updateTask("non-existent-id", updateData)
      ).rejects.toThrow(TaskNotFoundException);
    });
  });

  // ==================== deleteTask Tests ====================

  describe("deleteTask", () => {
    it("should delete a task without campaign (default)", async () => {
      mockPrismaService.task.delete.mockResolvedValue(mockTaskWithoutCampaign);

      const result = await taskRepository.deleteTask("task-1");

      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
        include: { campaign: false },
      });

      expect(result.id).toBe("task-1");
      expect(result.campaign).toBeUndefined();
    });

    it("should delete a task with campaign when requested", async () => {
      mockPrismaService.task.delete.mockResolvedValue(mockTaskWithCampaign);

      const result = await taskRepository.deleteTask("task-1", true);

      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
        include: { campaign: true },
      });

      expect(result.campaign).toBeDefined();
    });

    it("should throw TaskNotFoundException when task does not exist", async () => {
      const prismaError = new PrismaClientKnownRequestError(
        "Record to delete does not exist.",
        { code: "P2025", clientVersion: "5.0.0" }
      );
      mockPrismaService.task.delete.mockRejectedValue(prismaError);

      await expect(
        taskRepository.deleteTask("non-existent-id")
      ).rejects.toThrow(TaskNotFoundException);
    });

    it("should return the deleted task with all fields", async () => {
      mockPrismaService.task.delete.mockResolvedValue(mockCompletedTask);

      const result = await taskRepository.deleteTask("task-2");

      expect(result.status).toBe(TaskStatus.COMPLETED);
      expect(result.result).toBeDefined();
    });
  });

  // ==================== findManyTasksByOptions Tests ====================

  describe("findManyTasksByOptions", () => {
    const mockTasks = [
      mockTaskWithoutCampaign,
      mockCompletedTask,
      mockFailedTask,
    ];

    it("should return paginated tasks with default options", async () => {
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await taskRepository.findManyTasksByOptions();

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.skip).toBe(0);
      expect(result.pagination.take).toBe(20);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
    });

    it("should filter tasks by campaignId", async () => {
      const options: ListTasksOptions = {
        where: { campaignId: "campaign-1" },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockTaskWithoutCampaign]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].campaignId).toBe("campaign-1");
    });

    it("should filter tasks by status", async () => {
      const options: ListTasksOptions = {
        where: { status: TaskStatus.COMPLETED },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockCompletedTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);

      expect(result.data[0].status).toBe(TaskStatus.COMPLETED);
    });

    it("should filter tasks by priority", async () => {
      const options: ListTasksOptions = {
        where: { priority: 1 },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockTaskWithoutCampaign]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);

      // Verify that buildWhereClause was called with correct priority
      expect(result.data[0].priority).toBe(1);
    });

    it("should filter tasks by priority range", async () => {
      const options: ListTasksOptions = {
        where: { 
          priorityRange: { gte: 5, lte: 10 } 
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(result.data).toStrictEqual([]);
    });
    
    it("should filter tasks by date range", async () => {
      const options: ListTasksOptions = {
        where: {
          createdAt: {
            gte: new Date("2025-01-01"),
            lte: new Date("2025-12-31"),
          },
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockTasks]);
      mockPrismaService.task.count.mockResolvedValue(3);

      await taskRepository.findManyTasksByOptions(options);
      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
      expect(mockPrismaService.task.count).toHaveBeenCalled();
      // expect(result.data).toHaveLength(3);
    });

    it("should filter tasks with errors", async () => {
      const options: ListTasksOptions = {
        where: { hasError: true },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockFailedTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(result.data[0].error).toBeTruthy();
    });

    it("should filter tasks without errors", async () => {
      const options: ListTasksOptions = {
        where: { hasError: false },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockTaskWithoutCampaign]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(result.data[0].error).toBeNull();
    });

    it("should filter tasks with results", async () => {
      const options: ListTasksOptions = {
        where: { hasResult: true },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockCompletedTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(result.data[0].result).toBeTruthy();
    });

    it("should search tasks by error message", async () => {
      const options: ListTasksOptions = {
        where: { searchError: "rate limit" },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockFailedTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
      expect(result.data[0].error).toContain("rate limit");
    });

    it("should sort tasks by createdAt ascending", async () => {
      const options: ListTasksOptions = {
        orderBy: { field: "createdAt", direction: "asc" },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await taskRepository.findManyTasksByOptions(options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(3);
    });

    it("should sort tasks by priority descending", async () => {
      const options: ListTasksOptions = {
        orderBy: { field: "priority", direction: "desc" },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(3);
    });

    it("should handle pagination with skip and take", async () => {
      const options: ListTasksOptions = {
        skip: 10,
        take: 5,
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks.slice(0, 2));
      mockPrismaService.task.count.mockResolvedValue(25);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(result.pagination.skip).toBe(10);
      expect(result.pagination.take).toBe(5);
      expect(result.pagination.total).toBe(25);
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.currentPage).toBe(3);
    });

    it("should enforce maximum take limit", async () => {
      const options: ListTasksOptions = {
        take: 200, // Exceeds max of 100
      };

      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      const result = await taskRepository.findManyTasksByOptions(options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(0);
    });

    it("should include campaign when requested (boolean)", async () => {
      const options: ListTasksOptions = {
        include: { campaign: true },
      };

      const tasksWithCampaign = mockTasks.map(t => ({ ...t, campaign: mockCampaign }));
      mockPrismaService.task.findMany.mockResolvedValue(tasksWithCampaign);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await taskRepository.findManyTasksByOptions(options);
      expect(result.data[0].campaign).toBeDefined();
      expect(result.data[0].campaign?.id).toBe("campaign-1");
    });

    it("should include campaign with selected fields", async () => {
      const options: ListTasksOptions = {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      };

      const tasksWithCampaign = mockTasks.map(t => ({
        ...t,
        campaign: {
          id: mockCampaign.id,
          name: mockCampaign.name,
          status: mockCampaign.status,
        },
      }));

      mockPrismaService.task.findMany.mockResolvedValue(tasksWithCampaign);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await taskRepository.findManyTasksByOptions(options);

      expect(result.data[0].campaign).toBeDefined();
      expect(result.data[0].campaign?.id).toBe("campaign-1");
    });

    it("should handle empty results", async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      const result = await taskRepository.findManyTasksByOptions();

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it("should combine multiple filters", async () => {
      const options: ListTasksOptions = {
        where: {
          campaignId: "campaign-1",
          status: TaskStatus.COMPLETED,
          hasResult: true,
          priorityRange: { gte: 1, lte: 10 },
        },
        orderBy: { field: "updatedAt", direction: "desc" },
        skip: 0,
        take: 10,
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockCompletedTask]);
      mockPrismaService.task.count.mockResolvedValue(1);

      const result = await taskRepository.findManyTasksByOptions(options);

      expect(result.data).toHaveLength(1);
      expect(mockPrismaService.task.findMany).toHaveBeenCalled();
    });

    it("should handle Prisma errors", async () => {
      const prismaError = new Error("Database connection error");
      mockPrismaService.task.findMany.mockRejectedValue(prismaError);

      await expect(
        taskRepository.findManyTasksByOptions()
      ).rejects.toThrow();
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    it("should handle task with null result correctly", async () => {
      const taskWithNullResult = { ...mockTaskWithoutCampaign, result: null };
      mockPrismaService.task.findUnique.mockResolvedValue(taskWithNullResult);

      const result = await taskRepository.findTaskById("task-1");

      expect(result.result).toBeNull();
    });

    it("should handle task with null error correctly", async () => {
      const taskWithNullError = { ...mockTaskWithoutCampaign, error: null };
      mockPrismaService.task.findUnique.mockResolvedValue(taskWithNullError);

      const result = await taskRepository.findTaskById("task-1");

      expect(result.error).toBeNull();
    });

    it("should preserve LLM input structure", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTaskWithoutCampaign);

      const result = await taskRepository.findTaskById("task-1");

      expect(result.input.prompt).toBe("Generate marketing content for summer sale");
      expect(result.input.context).toEqual({ targetAudience: "millennials" });
      expect(result.input.modelParameters).toEqual({ temperature: 0.7, maxTokens: 500 });
    });

    it("should preserve LLM result structure", async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockCompletedTask);

      const result = await taskRepository.findTaskById("task-2");

      expect(result.result?.rawOutput).toBe("Generated marketing content...");
      expect(result.result?.processedOutput).toEqual({
        headline: "Summer Sale!",
        body: "Get 50% off!",
      });
      expect(result.result?.metadata).toEqual({ tokensUsed: 450, model: "gpt-4" });
    });
  });

});


  

  

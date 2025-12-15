import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { CampaignRepository } from "../../../src/modules/campaign/repositories/campaign.repository";
import { PrismaService } from "../../../src/core/database/prisma.service";
import {
  CampaignNotFoundException,
  UserNotFoundException,
  InvalidStatusTransitionException,
} from "../../../src/common/exceptions/database.exceptions";
import {
  CampaignStatus,
  Campaign,
  TaskStatus,
  SafeUser as User,
  Task,
} from "../../../src/common/types/database/entity.types";
import {
  CreateCampaignData,
  UpdateCampaignData,
  UpdateTaskData,
  ListCampaignsOptions,
  ListTasksOptions,
  AggregateCampaignResultData,
} from "../../../src/modules/campaign/types/campaign.types";
import { CampaignInput, CampaignResult, TaskResult } from "../../../src/common/types/database/llm.types";

// ==================== Mock Data ====================

const mockCampaignInput: CampaignInput = {
  userPrompt: "Generate a marketing report",
  userContext: { industry: "tech" },
};


const mockCampaignResult: CampaignResult = {
  reportTitle: "Marketing Report",
  reportObjective: "Analyze market trends",
  executiveSummary: {
    overview: "Overview content",
    keyHighlights: ["Highlight 1"],
    criticalInsights: ["Insight 1"],
    recommendations: ["Recommendation 1"],
  },
  sections: [],
  consolidatedData: {
    allDataPoints: {},
    keyMetrics: {},
    dataSources: [],
  },
  conclusion: {
    summary: "Summary",
    strategicRecommendations: [],
    futureOutlook: "Positive",
    limitations: [],
  },
  totalTasks: 1,
  successfulTasks: 1,
};

const mockTaskResult: TaskResult = {
  taskId: "task-1",
  taskName: "Market Analysis",
  status: "success",
  optimizedQueries: [],
  totalSearchResults: 10,
  structuredContent: {
    summary: "Task summary",
    keyFindings: ["Finding 1"],
    dataPoints: {},
    sources: [],
  },
};

const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  username: "testuser",
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockTask: Task = {
  id: "task-1",
  campaignId: "campaign-1",
  status: TaskStatus.SUCCESS,
  priority: 1,
  result: mockTaskResult,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockCampaign: Campaign = {
  id: "campaign-1",
  userId: "user-1",
  name: "Test Campaign",
  description: "A test campaign",
  status: CampaignStatus.DRAFT,
  input: mockCampaignInput,
  result: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockCampaignWithTasks: Campaign = {
  ...mockCampaign,
  tasks: [mockTask],
};

const mockCampaignWithUser: Campaign = {
  ...mockCampaign,
  user: mockUser,
};

const mockSUCCESSCampaign: Campaign = {
  ...mockCampaign,
  status: CampaignStatus.ARCHIVED,
  result: mockCampaignResult,
  tasks: [mockTask],
};

// ==================== Test Suite ====================

describe("CampaignRepository", () => {
  let campaignRepository: CampaignRepository;
  let mockPrismaService: any;
  let originalConsoleError: typeof console.error;

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = jest.fn(); // Suppress console.error during tests
  });

  afterAll(() => {
    console.error = originalConsoleError; // Restore console.error
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockPrismaService = {
      campaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
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
    
    campaignRepository = new CampaignRepository(
      mockPrismaService as PrismaService,
    );
  });

  // ==================== createCampaign Tests ====================

  describe("createCampaign", () => {
    it("should create a campaign successfully with minimal data", async () => {
      const createData: CreateCampaignData = {
        userId: "user-1",
        name: "Test Campaign",
        input: mockCampaignInput,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.campaign.create.mockResolvedValue(mockCampaign);

      const result = await campaignRepository.createCampaign(createData);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: createData.userId },
        select: { id: true },
      });
      expect(mockPrismaService.campaign.create).toHaveBeenCalledWith({
        data: {
          userId: createData.userId,
          name: createData.name,
          description: undefined,
          status: CampaignStatus.DRAFT,
          input: mockCampaignInput,
        },
      });
      expect(result).toEqual(mockCampaign);
    });

    it("should create a campaign with description and custom status", async () => {
      const createData: CreateCampaignData = {
        userId: "user-1",
        name: "Active Campaign",
        description: "Campaign description",
        status: CampaignStatus.ACTIVE,
        input: mockCampaignInput,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.campaign.create.mockResolvedValue({
        ...mockCampaign,
        description: "Campaign description",
        status: CampaignStatus.ACTIVE,
      });

      const result = await campaignRepository.createCampaign(createData);

      expect(mockPrismaService.campaign.create).toHaveBeenCalledWith({
        data: {
          userId: createData.userId,
          name: createData.name,
          description: createData.description,
          status: CampaignStatus.ACTIVE,
          input: mockCampaignInput,
        },
      });
      expect(result.description).toBe("Campaign description");
      expect(result.status).toBe(CampaignStatus.ACTIVE);
    });

    it("should throw UserNotFoundException when user does not exist", async () => {
      const createData: CreateCampaignData = {
        userId: "non-existent-user",
        name: "Test Campaign",
        input: mockCampaignInput,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        campaignRepository.createCampaign(createData)
      ).rejects.toThrow(UserNotFoundException);

      expect(mockPrismaService.campaign.create).not.toHaveBeenCalled();
    });

    it("should handle Prisma errors during creation", async () => {
      const createData: CreateCampaignData = {
        userId: "user-1",
        name: "Test Campaign",
        input: mockCampaignInput,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      const prismaError = new PrismaClientKnownRequestError(
        "Database connection error",
        { code: "P2024", clientVersion: "x.x.x" }
      );
      mockPrismaService.campaign.create.mockRejectedValue(prismaError);

      await expect(
        campaignRepository.createCampaign(createData)
      ).rejects.toThrow();
    });
  });

  // ==================== findCampaignById Tests ====================

  describe("findCampaignById", () => {
    it("should find a campaign by ID without relations", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);

      const result = await campaignRepository.findCampaignById("campaign-1");

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        include: {
          tasks: false,
          user: false,
        },
      });
      expect(result).toEqual(mockCampaign);
    });

    it("should find a campaign by ID with tasks included", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaignWithTasks);

      const result = await campaignRepository.findCampaignById("campaign-1", true, false);

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        include: {
          tasks: true,
          user: false,
        },
      });
      expect(result.tasks).toBeDefined();
      expect(result.tasks?.length).toBe(1);
    });

    it("should find a campaign by ID with user included", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaignWithUser);

      const result = await campaignRepository.findCampaignById("campaign-1", false, true);

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        include: {
          tasks: false,
          user: true,
        },
      });
      expect(result.user).toBeDefined();
      expect(result.user?.id).toBe("user-1");
    });

    it("should find a campaign by ID with both tasks and user included", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue({
        ...mockCampaignWithTasks,
        user: mockUser,
      });

      const result = await campaignRepository.findCampaignById("campaign-1", true, true);

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        include: {
          tasks: true,
          user: true,
        },
      });
      expect(result.tasks).toBeDefined();
      expect(result.user).toBeDefined();
    });

    it("should throw CampaignNotFoundException when campaign not found", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(null);

      await expect(
        campaignRepository.findCampaignById("non-existent")
      ).rejects.toThrow(CampaignNotFoundException);
    });
  });

  // ==================== updateCampaign Tests ====================

  describe("updateCampaign", () => {
    it("should update campaign name", async () => {
      const updateData: UpdateCampaignData = {
        name: "Updated Campaign Name",
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        name: "Updated Campaign Name",
      });

      const result = await campaignRepository.updateCampaign("campaign-1", updateData);

      expect(mockPrismaService.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: { name: "Updated Campaign Name" },
        include: {
          tasks: false,
          user: false,
        },
      });
      expect(result.name).toBe("Updated Campaign Name");
    });

    it("should update campaign input", async () => {
      const newInput: CampaignInput = {
        userPrompt: "Updated prompt",
        userContext: { updated: true },
      };
      const updateData: UpdateCampaignData = {
        input: newInput,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        input: newInput,
      });

      const result = await campaignRepository.updateCampaign("campaign-1", updateData);

      expect(mockPrismaService.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: { input: newInput },
        include: {
          tasks: false,
          user: false,
        },
      });
      expect(result.input).toEqual(newInput);
    });

    it("should update campaign result", async () => {
      const updateData: UpdateCampaignData = {
        result: mockCampaignResult,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        result: mockCampaignResult,
      });

      const result = await campaignRepository.updateCampaign("campaign-1", updateData);

      expect(result.result).toEqual(mockCampaignResult);
    });

    it("should update campaign description to null", async () => {
      const updateData: UpdateCampaignData = {
        description: null,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        description: null,
      });

      const result = await campaignRepository.updateCampaign("campaign-1", updateData);

      expect(mockPrismaService.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: { description: null },
        include: {
          tasks: false,
          user: false,
        },
      });
      expect(result.description).toBeNull();
    });

    it("should update campaign status with valid transition (DRAFT -> ACTIVE)", async () => {
      const updateData: UpdateCampaignData = {
        status: CampaignStatus.ACTIVE,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.ACTIVE,
      });

      const result = await campaignRepository.updateCampaign("campaign-1", updateData);

      expect(result.status).toBe(CampaignStatus.ACTIVE);
    });

    it("should throw InvalidStatusTransitionException for invalid transition (ARCHIVED -> ACTIVE)", async () => {
      const updateData: UpdateCampaignData = {
        status: CampaignStatus.ACTIVE,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.ARCHIVED,
      });

      await expect(
        campaignRepository.updateCampaign("campaign-1", updateData)
      ).rejects.toThrow(InvalidStatusTransitionException);

      expect(mockPrismaService.campaign.update).not.toHaveBeenCalled();
    });

    it("should allow same status update without validation", async () => {
      const updateData: UpdateCampaignData = {
        status: CampaignStatus.DRAFT,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue(mockCampaign);

      const result = await campaignRepository.updateCampaign("campaign-1", updateData);

      expect(result.status).toBe(CampaignStatus.DRAFT);
    });

    it("should throw CampaignNotFoundException when campaign does not exist", async () => {
      const updateData: UpdateCampaignData = {
        name: "Updated Name",
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(null);

      await expect(
        campaignRepository.updateCampaign("non-existent", updateData)
      ).rejects.toThrow(CampaignNotFoundException);

      expect(mockPrismaService.campaign.update).not.toHaveBeenCalled();
    });
  });

  // ==================== deleteCampaignWithTasks Tests ====================

  describe("deleteCampaignWithTasks", () => {
    it("should delete a campaign and its tasks using transaction", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaignWithTasks);
      mockPrismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          task: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
          campaign: { delete: jest.fn().mockResolvedValue(mockCampaign) },
        };
        return callback(tx);
      });

      const result = await campaignRepository.deleteCampaignWithTasks("campaign-1");

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        include: { tasks: true },
      });
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual(mockCampaignWithTasks);
    });

    it("should delete campaign with no tasks", async () => {
      const campaignWithNoTasks = { ...mockCampaign, tasks: [] };
      mockPrismaService.campaign.findUnique.mockResolvedValue(campaignWithNoTasks);
      mockPrismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          task: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
          campaign: { delete: jest.fn().mockResolvedValue(mockCampaign) },
        };
        return callback(tx);
      });

      const result = await campaignRepository.deleteCampaignWithTasks("campaign-1");

      expect(result.tasks).toHaveLength(0);
    });

    it("should throw CampaignNotFoundException when campaign does not exist", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(null);

      await expect(
        campaignRepository.deleteCampaignWithTasks("non-existent")
      ).rejects.toThrow(CampaignNotFoundException);

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  // ==================== softDeleteCampaign Tests ====================

    describe("softDeleteCampaign", () => {
    it("should soft delete a campaign by updating status to ARCHIVED", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        status: CampaignStatus.ARCHIVED,
      });

      const result = await campaignRepository.softDeleteCampaign("campaign-1");

      expect(mockPrismaService.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: { status: CampaignStatus.ARCHIVED },
        include: {
          tasks: false,
          user: false,
        },
      });
      expect(result.status).toBe(CampaignStatus.ARCHIVED);
    });
  });

  // ==================== updateTask Tests ====================
  describe("updateTask", () => {
    it("should update task status", async () => {
      const updateData: UpdateTaskData = {
        status: TaskStatus.SUCCESS,
      };

      mockPrismaService.task.update.mockResolvedValue({
        ...mockTask,
        status: TaskStatus.SUCCESS,
      });

      const result = await campaignRepository.updateTask("task-1", updateData);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: expect.objectContaining({ status: TaskStatus.SUCCESS }),
      });
      expect(result.status).toBe(TaskStatus.SUCCESS);
    });

    it("should update task priority", async () => {
      const updateData: UpdateTaskData = {
        priority: 5,
      };

      mockPrismaService.task.update.mockResolvedValue({
        ...mockTask,
        priority: 5,
      });

      const result = await campaignRepository.updateTask("task-1", updateData);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { id: "task-1" },
        data: { priority: 5 },
      });
      expect(result.priority).toBe(5);
    });

    it("should return existing task when update data is empty", async () => {
      const updateData: UpdateTaskData = {};

      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);

      const result = await campaignRepository.updateTask("task-1", updateData);

      expect(mockPrismaService.task.update).not.toHaveBeenCalled();
      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
      expect(result).toEqual(mockTask);
    });
  });

  // ==================== findManyTasksByCampaignWithOptions Tests ====================

  describe("findManyTasksByCampaignWithOptions", () => {
    const mockTasks = [mockTask, { ...mockTask, id: "task-2" }];

    it("should find tasks with default pagination", async () => {
      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      const result = await campaignRepository.findManyTasksByCampaignWithOptions("campaign-1", {});

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: { campaignId: "campaign-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it("should filter tasks by status", async () => {
      const options: Omit<ListTasksOptions, "campaignId"> = {
        where: { status: TaskStatus.SUCCESS },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByCampaignWithOptions("campaign-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { campaignId: "campaign-1", status: TaskStatus.SUCCESS },
        })
      );
    });

    it("should filter tasks by statusIn", async () => {
      const options: Omit<ListTasksOptions, "campaignId"> = {
        where: { statusIn: [TaskStatus.SUCCESS, TaskStatus.FAILED] },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByCampaignWithOptions("campaign-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: "campaign-1",
            status: { in: [TaskStatus.SUCCESS, TaskStatus.FAILED] },
          },
        })
      );
    });

    it("should filter tasks by priority range", async () => {
      const options: Omit<ListTasksOptions, "campaignId"> = {
        where: { priorityRange: { gte: 1, lte: 5 } },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByCampaignWithOptions("campaign-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: "campaign-1",
            priority: { gte: 1, lte: 5 },
          },
        })
      );
    });

    it("should filter tasks by hasResult", async () => {
      const options: Omit<ListTasksOptions, "campaignId"> = {
        where: { hasResult: true },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByCampaignWithOptions("campaign-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaignId: "campaign-1",
            result: { not: expect.anything() },
          },
        })
      );
    });

    it("should sort tasks by priority ascending", async () => {
      const options: Omit<ListTasksOptions, "campaignId"> = {
        orderBy: { field: "priority", direction: "asc" },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasks);
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByCampaignWithOptions("campaign-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priority: "asc" },
        })
      );
    });

  });

  // ==================== findManyTasksByUserWithOptions Tests ====================

  describe("findManyTasksByUserWithOptions", () => {
    // const mockTasksForUser = [
    //   mockTask,
    //   { ...mockTask, id: "task-2", priority: 2 },
    //   { ...mockTask, id: "task-3", priority: 3, status: TaskStatus.FAILED },
    // ];

    // const mockTaskWithCampaign = {
    //   ...mockTask,
    //   campaign: mockCampaign,
    // };

    const mockTasksWithCampaigns = [
      { ...mockTask, campaign: mockCampaign },
      { ...mockTask, id: "task-2", priority: 2, campaign: mockCampaign },
      {
        ...mockTask,
        id: "task-3",
        priority: 3,
        status: TaskStatus.FAILED,
        campaign: mockCampaign,
      },
    ];

    it("should find all tasks for a user with default pagination", async () => {
      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-1",
        {}
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: {
          campaign: { userId: "user-1" },
        },
        orderBy: { createdAt: "desc" },
        include: { campaign: true },
      });
      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it("should find tasks with custom pagination", async () => {
      const options: ListTasksOptions = {
        skip: 5,
        take: 10,
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(50);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-1",
        options
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        skip: 5,
        take: 10,
        where: {
          campaign: { userId: "user-1" },
        },
        orderBy: { createdAt: "desc" },
        include: { campaign: true },
      });
      expect(result.pagination.skip).toBe(5);
      expect(result.pagination.take).toBe(10);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should enforce maximum take limit of 100", async () => {
      const options: ListTasksOptions = {
        take: 150,
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it("should filter tasks by single status", async () => {
      const options: ListTasksOptions = {
        where: { status: TaskStatus.SUCCESS },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            status: TaskStatus.SUCCESS,
          },
        })
      );
    });

    it("should filter tasks by multiple statuses (statusIn)", async () => {
      const options: ListTasksOptions = {
        where: {
          statusIn: [TaskStatus.SUCCESS, TaskStatus.FAILED],
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            status: { in: [TaskStatus.SUCCESS, TaskStatus.FAILED] },
          },
        })
      );
    });

    it("should prioritize statusIn over status when both provided", async () => {
      const options: ListTasksOptions = {
        where: {
          status: TaskStatus.SUCCESS,
          statusIn: [TaskStatus.FAILED],
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockTasksWithCampaigns[2]]);
      mockPrismaService.task.count.mockResolvedValue(1);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            status: { in: [TaskStatus.FAILED] },
          },
        })
      );
    });

    it("should filter tasks by priority", async () => {
      const options: ListTasksOptions = {
        where: { priority: 2 },
      };

      mockPrismaService.task.findMany.mockResolvedValue([mockTasksWithCampaigns[1]]);
      mockPrismaService.task.count.mockResolvedValue(1);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            priority: 2,
          },
        })
      );
    });

    it("should filter tasks by priority range", async () => {
      const options: ListTasksOptions = {
        where: {
          priorityRange: { gte: 1, lte: 5 },
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            priority: { gte: 1, lte: 5 },
          },
        })
      );
    });

    it("should filter tasks by priority range with only gte", async () => {
      const options: ListTasksOptions = {
        where: {
          priorityRange: { gte: 2 },
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns.slice(1));
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            priority: { gte: 2 },
          },
        })
      );
    });

    it("should filter tasks by hasResult (true)", async () => {
      const options: ListTasksOptions = {
        where: { hasResult: true },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            result: { not: expect.anything() },
          },
        })
      );
    });

    it("should filter tasks by hasResult (false)", async () => {
      const options: ListTasksOptions = {
        where: { hasResult: false },
      };

      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            result: { equals: expect.anything() },
          },
        })
      );
    });

    it("should filter tasks by single campaignId (must belong to user)", async () => {
      const options: ListTasksOptions = {
        where: { campaignId: "campaign-1" },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            campaignId: "campaign-1",
          },
        })
      );
    });

    it("should filter tasks by multiple campaignIds (all must belong to user)", async () => {
      const options: ListTasksOptions = {
        where: {
          campaignIds: ["campaign-1", "campaign-2", "campaign-3"],
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            campaignId: { in: ["campaign-1", "campaign-2", "campaign-3"] },
          },
        })
      );
    });

    it("should ignore empty campaignIds array", async () => {
      const options: ListTasksOptions = {
        where: {
          campaignIds: [],
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
          },
        })
      );
    });

    it("should filter tasks by createdAt date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const options: ListTasksOptions = {
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it("should filter tasks by updatedAt date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const options: ListTasksOptions = {
        where: {
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            updatedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it("should sort tasks by priority ascending", async () => {
      const options: ListTasksOptions = {
        orderBy: { field: "priority", direction: "asc" },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priority: "asc" },
        })
      );
    });

    it("should sort tasks by status descending", async () => {
      const options: ListTasksOptions = {
        orderBy: { field: "status", direction: "desc" },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { status: "desc" },
        })
      );
    });

    it("should default to sorting by createdAt descending", async () => {
      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", {});

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("should include campaign relation in results", async () => {
      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-1",
        {}
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { campaign: true },
        })
      );
      
      // Verify campaign info is in the results
      result.data.forEach((task) => {
        expect(task).toHaveProperty("campaignId");
      });
    });

    it("should handle empty results for user with no tasks", async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);
      mockPrismaService.task.count.mockResolvedValue(0);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-with-no-tasks",
        {}
      );

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it("should handle pagination calculation correctly", async () => {
      const options: ListTasksOptions = {
        skip: 20,
        take: 10,
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(95);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-1",
        options
      );

      expect(result.pagination).toEqual({
        total: 95,
        skip: 20,
        take: 10,
        hasMore: true,
        totalPages: 10,
        currentPage: 3,
      });
    });

    it("should handle last page pagination correctly", async () => {
      const options: ListTasksOptions = {
        skip: 90,
        take: 10,
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(95);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-1",
        options
      );

      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.currentPage).toBe(10);
    });

    it("should handle complex query with multiple filters", async () => {
      const startDate = new Date("2024-01-01");
      const options: ListTasksOptions = {
        skip: 5,
        take: 15,
        where: {
          campaignIds: ["campaign-1", "campaign-2"],
          statusIn: [TaskStatus.SUCCESS, TaskStatus.FAILED],
          priorityRange: { gte: 1, lte: 3 },
          hasResult: true,
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: {
          field: "priority",
          direction: "asc",
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(50);

      const result = await campaignRepository.findManyTasksByUserWithOptions(
        "user-1",
        options
      );

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        skip: 5,
        take: 15,
        where: {
          campaign: { userId: "user-1" },
          campaignId: { in: ["campaign-1", "campaign-2"] },
          status: { in: [TaskStatus.SUCCESS, TaskStatus.FAILED] },
          priority: { gte: 1, lte: 3 },
          result: { not: expect.anything() },
          createdAt: {
            gte: startDate,
          },
        },
        orderBy: { priority: "asc" },
        include: { campaign: true },
      });

      expect(result.data).toHaveLength(3);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(4);
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should filter for specific user only (security)", async () => {
      const options: ListTasksOptions = {
        where: {
          campaignId: "campaign-1",
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      // Query for user-1
      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      const firstCall = mockPrismaService.task.findMany.mock.calls[0][0];
      expect(firstCall.where.campaign.userId).toBe("user-1");

      // Reset mock
      mockPrismaService.task.findMany.mockReset();
      mockPrismaService.task.count.mockReset();
      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(3);

      // Query for user-2 should have different userId filter
      await campaignRepository.findManyTasksByUserWithOptions("user-2", options);

      const secondCall = mockPrismaService.task.findMany.mock.calls[0][0];
      expect(secondCall.where.campaign.userId).toBe("user-2");
    });

    it("should handle date range with both gte and lte", async () => {
      const startDate = new Date("2024-06-01");
      const endDate = new Date("2024-12-31");

      const options: ListTasksOptions = {
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      };

      mockPrismaService.task.findMany.mockResolvedValue(mockTasksWithCampaigns);
      mockPrismaService.task.count.mockResolvedValue(2);

      await campaignRepository.findManyTasksByUserWithOptions("user-1", options);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            campaign: { userId: "user-1" },
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });
  });

  // ==================== findManyCampaignsByOptions Tests ====================

  describe("findManyCampaignsByOptions", () => {
    const mockCampaigns = [mockCampaign, { ...mockCampaign, id: "campaign-2" }];

    it("should find campaigns with default pagination", async () => {
      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      const result = await campaignRepository.findManyCampaignsByOptions();

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: {},
        include: undefined,
        orderBy: { createdAt: "desc" },
      });
      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it("should find campaigns with custom pagination", async () => {
      const options: ListCampaignsOptions = {
        skip: 10,
        take: 5,
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(50);

      const result = await campaignRepository.findManyCampaignsByOptions(
        options
      );

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 5,
        where: {},
        include: undefined,
        orderBy: { createdAt: "desc" },
      });
      expect(result.pagination.skip).toBe(10);
      expect(result.pagination.take).toBe(5);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(10);
      expect(result.pagination.currentPage).toBe(3);
      expect(result.pagination.hasMore).toBe(true);
    });

    it("should enforce maximum take limit of 100", async () => {
      const options: ListCampaignsOptions = {
        take: 200,
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
        })
      );
    });

    it("should filter campaigns by userId", async () => {
      const options: ListCampaignsOptions = {
        where: { userId: "user-1" },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-1" },
        })
      );
    });

    it("should filter campaigns by single status", async () => {
      const options: ListCampaignsOptions = {
        where: { status: CampaignStatus.ACTIVE },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: CampaignStatus.ACTIVE },
        })
      );
    });

    it("should filter campaigns by multiple statuses (statusIn)", async () => {
      const options: ListCampaignsOptions = {
        where: {
          statusIn: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT],
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT] },
          },
        })
      );
    });
  
    it("should prioritize statusIn over status when both provided", async () => {
      const options: ListCampaignsOptions = {
        where: {
          status: CampaignStatus.ARCHIVED,
          statusIn: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT],
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: { in: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT] },
          },
        })
      );
    });

    it("should filter campaigns by name (exact match)", async () => {
      const options: ListCampaignsOptions = {
        where: { name: "Test Campaign" },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { equals: "Test Campaign" } },
        })
      );
    });

    it("should filter campaigns by name (contains)", async () => {
      const options: ListCampaignsOptions = {
        where: { nameContains: "Test" },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: "Test" } },
        })
      );
    });

    it("should filter campaigns by both name and nameContains using AND logic", async () => {
      const options: ListCampaignsOptions = {
        where: {
          name: "Test Campaign",
          nameContains: "Test",
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { name: { equals: "Test Campaign" } },
              { name: { contains: "Test" } },
            ],
          },
        })
      );
    });

    it("should filter campaigns by descriptionContains", async () => {
      const options: ListCampaignsOptions = {
        where: { descriptionContains: "test" },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { description: { contains: "test" } },
        })
      );
    });

    it("should filter campaigns by hasDescription (true)", async () => {
      const options: ListCampaignsOptions = {
        where: { hasDescription: true },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { description: { not: null } },
        })
      );
    });

    it("should filter campaigns by hasDescription (false)", async () => {
      const options: ListCampaignsOptions = {
        where: { hasDescription: false },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { description: null },
        })
      );
    });

    it("should filter campaigns by createdAt date range", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-12-31");

      const options: ListCampaignsOptions = {
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        })
      );
    });

    it("should filter campaigns by hasResult (true)", async () => {
      const options: ListCampaignsOptions = {
        where: { hasResult: true },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { result: { not: expect.anything() } },
        })
      );
    });

    it("should filter campaigns by hasResult (false)", async () => {
      const options: ListCampaignsOptions = {
        where: { hasResult: false },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { result: { equals: expect.anything() } },
        })
      );
    });

    it("should include tasks with hasResult filter", async () => {
      const options: ListCampaignsOptions = {
        include: {
          tasks: {
            where: { hasResult: true },
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([mockCampaignWithTasks]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            tasks: {
              where: { result: { not: expect.anything() } },
            },
          },
        })
      );
    });

    it("should filter campaigns by hasTasks (true)", async () => {
      const options: ListCampaignsOptions = {
        where: { hasTasks: true },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tasks: { some: {} } },
        })
      );
    });

    it("should filter campaigns by hasTasks (false)", async () => {
      const options: ListCampaignsOptions = {
        where: { hasTasks: false },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tasks: { none: {} } },
        })
      );
    });

    it("should filter campaigns by isDeleted (true)", async () => {
      const options: ListCampaignsOptions = {
        where: { isDeleted: true },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: { not: null } },
        })
      );
    });

    it("should handle empty results correctly", async () => {
      mockPrismaService.campaign.findMany.mockResolvedValue([]);
      mockPrismaService.campaign.count.mockResolvedValue(0);

      const result = await campaignRepository.findManyCampaignsByOptions();

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it("should include user relation (boolean)", async () => {
      const options: ListCampaignsOptions = {
        include: { user: true },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithUser,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { user: true },
        })
      );
    });

    it("should include user relation with select fields", async () => {
      const options: ListCampaignsOptions = {
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithUser,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            user: {
              select: { id: true, username: true },
            },
          },
        })
      );
    });

    it("should include tasks relation (boolean)", async () => {
      const options: ListCampaignsOptions = {
        include: { tasks: true },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithTasks,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { tasks: true },
        })
      );
    });

    it("should include tasks with select fields only (no filtering)", async () => {
      const options: ListCampaignsOptions = {
        include: {
          tasks: {
            select: { id: true, status: true },
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithTasks,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            tasks: {
              select: { id: true, status: true },
            },
          },
        })
      );
    });

    it("should include tasks with where filter", async () => {
      const options: ListCampaignsOptions = {
        include: {
          tasks: {
            where: { status: TaskStatus.SUCCESS },
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithTasks,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            tasks: {
              where: { status: TaskStatus.SUCCESS },
            },
          },
        })
      );
    });
    it("should include tasks with orderBy and pagination", async () => {
      const options: ListCampaignsOptions = {
        include: {
          tasks: {
            orderBy: { field: "priority", direction: "asc" },
            skip: 0,
            take: 5,
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithTasks,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            tasks: {
              orderBy: { priority: "asc" },
              skip: 0,
              take: 5,
            },
          },
        })
      );
    });

    it("should handle empty results correctly", async () => {
      mockPrismaService.campaign.findMany.mockResolvedValue([]);
      mockPrismaService.campaign.count.mockResolvedValue(0);

      const result = await campaignRepository.findManyCampaignsByOptions();

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.currentPage).toBe(1);
      expect(result.pagination.hasMore).toBe(false);
    });

    it("should handle complex query with multiple filters and includes", async () => {
      const options: ListCampaignsOptions = {
        skip: 10,
        take: 20,
        where: {
          userId: "user-1",
          statusIn: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT],
          nameContains: "Marketing",
          hasDescription: true,
          hasTasks: true,
        },
        orderBy: {
          field: "updatedAt",
          direction: "desc",
        },
        include: {
          user: { select: { id: true, username: true } },
          tasks: {
            where: { status: TaskStatus.FAILED },
            orderBy: { field: "priority", direction: "asc" },
            take: 5,
          },
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue([
        mockCampaignWithTasks,
      ]);
      mockPrismaService.campaign.count.mockResolvedValue(1);

      const result = await campaignRepository.findManyCampaignsByOptions(
        options
      );

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 20,
        where: {
          userId: "user-1",
          status: { in: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT] },
          name: { contains: "Marketing" },
          description: { not: null },
          tasks: { some: {} },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { id: true, username: true } },
          tasks: {
            where: { status: TaskStatus.FAILED },
            orderBy: { priority: "asc" },
            take: 5,
          },
        },
      });
      expect(result.data).toHaveLength(1);
    });
  });

  // ==================== aggregateCampaignResult Tests ====================

  describe("aggregateCampaignResult", () => {
    it("should aggregate campaign result and create tasks in transaction", async () => {
      const aggregateData: AggregateCampaignResultData = {
        campaignId: "campaign-1",
        result: mockCampaignResult,
        tasks: [
          { priority: 1, result: mockTaskResult },
          { priority: 2, result: mockTaskResult },
        ],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          campaign: {
            findUnique: jest.fn().mockResolvedValue(mockCampaign),
            update: jest.fn().mockResolvedValue(mockSUCCESSCampaign),
          },
          task: {
            createMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
        };
        await callback(tx);
        return mockSUCCESSCampaign;
      });

      const result = await campaignRepository.aggregateCampaignResult(aggregateData);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.status).toBe(CampaignStatus.ARCHIVED);
      expect(result.result).toEqual(mockCampaignResult);
    });

    it("should handle aggregate with no tasks", async () => {
      const aggregateData: AggregateCampaignResultData = {
        campaignId: "campaign-1",
        result: mockCampaignResult,
        tasks: [],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          campaign: {
            findUnique: jest.fn().mockResolvedValue(mockCampaign),
            update: jest.fn().mockResolvedValue({ ...mockCampaign, result: mockCampaignResult, status: CampaignStatus.ARCHIVED }),
          },
          task: {
            createMany: jest.fn(),
          },
        };
        await callback(tx);
        return { ...mockCampaign, result: mockCampaignResult, status: CampaignStatus.ARCHIVED, tasks: [] };
      });

      const result = await campaignRepository.aggregateCampaignResult(aggregateData);

      expect(result.status).toBe(CampaignStatus.ARCHIVED);
    });

    it("should throw CampaignNotFoundException when campaign does not exist", async () => {
      const aggregateData: AggregateCampaignResultData = {
        campaignId: "non-existent",
        result: mockCampaignResult,
        tasks: [],
      };

      mockPrismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          campaign: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
        };
        return callback(tx);
      });

      await expect(
        campaignRepository.aggregateCampaignResult(aggregateData)
      ).rejects.toThrow(CampaignNotFoundException);
    });

    it("should assign default priority based on index when not provided", async () => {
      const aggregateData: AggregateCampaignResultData = {
        campaignId: "campaign-1",
        result: mockCampaignResult,
        tasks: [
          { result: mockTaskResult },
          { result: mockTaskResult },
        ],
      };

      let capturedCreateManyData: any;
      mockPrismaService.$transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          campaign: {
            findUnique: jest.fn().mockResolvedValue(mockCampaign),
            update: jest.fn().mockResolvedValue(mockSUCCESSCampaign),
          },
          task: {
            createMany: jest.fn().mockImplementation((args: any) => {
              capturedCreateManyData = args.data;
              return { count: 2 };
            }),
          },
        };
        await callback(tx);
        return mockSUCCESSCampaign;
      });

      await campaignRepository.aggregateCampaignResult(aggregateData);

      expect(capturedCreateManyData[0].priority).toBe(1);
      expect(capturedCreateManyData[1].priority).toBe(2);
    });
  });

});
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { MarketingCampaignRepository } from "../src/database/repositories/marketing-campaign.repository";
import { PrismaService } from "../src/database/prisma/prisma.service";
import {
  CampaignNotFoundException,
  UserNotFoundException,
} from "../src/common/exceptions";
import {
  CampaignStatus,
  MarketingCampaign,
  TaskStatus,
  User,
} from "../src/types/domain.types";

// Mock data for testing
const mockUser: User = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockCampaign: MarketingCampaign = {
  id: "campaign-1",
  userId: "user-1",
  name: "Test Campaign",
  description: "A test campaign",
  status: CampaignStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("MarketingCampaignRepository", () => {
  let campaignRepository: MarketingCampaignRepository;
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
      marketingCampaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
      },
      task: {
        create: jest.fn(), 
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
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
    
    campaignRepository = new MarketingCampaignRepository(
      mockPrismaService as PrismaService,
    );
  });

  describe("createCampaign", () => {
    it("should create a campaign with tasks successfully", async () => {
      const campaignWithTasks = { ...mockCampaign, tasks: [] };
      (
        mockPrismaService.marketingCampaign.create as jest.Mock
      ).mockResolvedValue(campaignWithTasks);

      const createData = {
        userId: "user-1",
        name: "Test Campaign",
        tasks: [{ input: { prompt: "test" }, priority: 1 }],
      };

      const result = await campaignRepository.createCampaign(createData);

      expect(mockPrismaService.marketingCampaign.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: createData.userId } },
          name: createData.name,
          description: "",
          status: CampaignStatus.DRAFT,
          tasks: {
            create: [
              {
                input: { prompt: "test" },
                result: Prisma.JsonNull,
                priority: 1,
                status: TaskStatus.PENDING,
              },
            ],
          },
        },
        include: { tasks: true, user: true },
      });
      expect(result.id).toEqual(mockCampaign.id);
    });

    it("should create a campaign and multiple tasks successfully", async () => {
      const campaignWithTasks = {
        ...mockCampaign,
        tasks: [
          {
            id: "task-1",
            input: { prompt: "test1" },
            result: null,
            priority: 1,
            status: TaskStatus.PENDING,
          },
          {
            id: "task-2",
            input: { prompt: "test2" },
            result: null,
            priority: 2,
            status: TaskStatus.PENDING,
          },
        ],
      };
      (mockPrismaService.marketingCampaign.create as jest.Mock).mockResolvedValue(campaignWithTasks);

      const createData = {
        userId: "user-1",
        name: "Test Campaign",
        tasks: [
          { input: { prompt: "test1" }, priority: 1 },
          { input: { prompt: "test2" }, priority: 2 },
        ],
      };

      const result = await campaignRepository.createCampaign(createData);

      expect(mockPrismaService.marketingCampaign.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: createData.userId } },
          name: createData.name,
          description: "",
          status: CampaignStatus.DRAFT,
          tasks: {
            create: [
              {
                input: { prompt: "test1" },
                result: Prisma.JsonNull,
                priority: 1,
                status: TaskStatus.PENDING,
              },
              {
                input: { prompt: "test2" },
                result: Prisma.JsonNull,
                priority: 2,
                status: TaskStatus.PENDING,
              },
            ],
          },
        },
        include: { tasks: true, user: true },
      });
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks!.length).toBe(2);
      expect(result.tasks![0].input).toEqual({ prompt: "test1" });
      expect(result.tasks![1].input).toEqual({ prompt: "test2" });
    });


    it("should throw UserNotFoundException if user does not exist", async () => {
      const prismaError = new PrismaClientKnownRequestError(
        "An operation failed because it depends on one or more records that were required but not found.",
        { code: "P2025", clientVersion: "x.x.x", meta: { modelName: "MarketingCampaign" } },
      );
      (
        mockPrismaService.marketingCampaign.create as jest.Mock
      ).mockRejectedValue(prismaError);

      const createData = {
        userId: "non-existent-user",
        name: "Test Campaign",
      };

      await expect(campaignRepository.createCampaign(createData)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });

  describe("findCampaignById", () => {
    it("should return campaign if found", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(mockCampaign);

      const result = await campaignRepository.findCampaignById(mockCampaign.id);

      expect(mockPrismaService.marketingCampaign.findUnique).toHaveBeenCalledWith({
        where: { id: mockCampaign.id },
        include: { tasks: false, user: false },
      });
      expect(result.id).toBe(mockCampaign.id);
    });

    it("should throw CampaignNotFoundException if not found", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(campaignRepository.findCampaignById("not-exist")).rejects.toThrow(
        CampaignNotFoundException,
      );
    });
  });

  describe("findCampaignWithTasksById", () => {
    it("should return campaign with tasks", async () => {
      const campaignWithTasks = { ...mockCampaign, tasks: [{ id: "task-1", input: {}, result: null, priority: 1, status: TaskStatus.PENDING }] };
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(campaignWithTasks);

      const result = await campaignRepository.findCampaignWithTasksById(mockCampaign.id);

      expect(mockPrismaService.marketingCampaign.findUnique).toHaveBeenCalledWith({
        where: { id: mockCampaign.id },
        include: {
          tasks: { orderBy: { createdAt: "asc" }, skip: 0, take: 100 },
          user: false,
        },
      });
      expect(result.tasks).toBeDefined();
      expect(result.tasks.length).toBe(1);
    });

    it("should throw CampaignNotFoundException if not found", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(campaignRepository.findCampaignWithTasksById("not-exist")).rejects.toThrow(
        CampaignNotFoundException,
      );
    });
  });

  describe("findManyCampaigsByUserId", () => {
    it("should return campaigns for user", async () => {
      (mockPrismaService.marketingCampaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);

      const result = await campaignRepository.findManyCampaigsByUserId(mockUser.id);

      expect(mockPrismaService.marketingCampaign.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "asc" },
        include: { user: false },
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(mockCampaign.id);
    });

    it("should support statusList filter", async () => {
      (mockPrismaService.marketingCampaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
      const statusList = [CampaignStatus.DRAFT];

      await campaignRepository.findManyCampaigsByUserId(mockUser.id, { statusList });

      expect(mockPrismaService.marketingCampaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: statusList },
          }),
        }),
      );
    });
  });

  describe("updateCampaign", () => {
    it("should update campaign fields", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue({
        status: CampaignStatus.DRAFT,
      });
      const updated = { ...mockCampaign, name: "Updated", status: CampaignStatus.ACTIVE };
      (mockPrismaService.marketingCampaign.update as jest.Mock).mockResolvedValue(updated);

      const result = await campaignRepository.updateCampaign(mockCampaign.id, { name: "Updated", status: CampaignStatus.ACTIVE });

      expect(mockPrismaService.marketingCampaign.update).toHaveBeenCalledWith({
        where: { id: mockCampaign.id },
        data: { name: "Updated", status: CampaignStatus.ACTIVE },
        include: { tasks: false },
      });
      expect(result.name).toBe("Updated");
      expect(result.status).toBe(CampaignStatus.ACTIVE);
    });

    it("should throw CampaignNotFoundException if campaign does not exist", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        campaignRepository.updateCampaign("not-exist", { status: CampaignStatus.ACTIVE }),
      ).rejects.toThrow(CampaignNotFoundException);
    });
  });

  describe("addTaskToCampaign", () => {
    it("should add a task to campaign", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue({ id: mockCampaign.id, status: CampaignStatus.DRAFT });
      const createdTask = { id: "task-1", campaignId: mockCampaign.id, input: {}, result: null, priority: 1, status: TaskStatus.PENDING };
      (mockPrismaService.task.create as jest.Mock).mockResolvedValue(createdTask);

      const result = await campaignRepository.addTaskToCampaign(mockCampaign.id, {
        campaignId: mockCampaign.id,
        input: { prompt: "test prompt" },
        priority: 1,
      });

      expect(mockPrismaService.task.create).toHaveBeenCalled();
      expect(result.id).toBe("task-1");
    });

    it("should throw CampaignNotFoundException if campaign does not exist", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        campaignRepository.addTaskToCampaign("not-exist", {
          campaignId: "not-exist",
          input: { prompt: "" },
        }),
      ).rejects.toThrow(CampaignNotFoundException);
    });
  });
  
  describe("deleteCampaignAndTasks", () => {
    it("should delete campaign and its tasks", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue({ id: mockCampaign.id });
      (mockPrismaService.task.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });
      (mockPrismaService.marketingCampaign.delete as jest.Mock).mockResolvedValue({ id: mockCampaign.id });

      const result = await campaignRepository.deleteCampaignAndTasks(mockCampaign.id);

      expect(mockPrismaService.task.deleteMany).toHaveBeenCalledWith({ where: { campaignId: mockCampaign.id } });
      expect(mockPrismaService.marketingCampaign.delete).toHaveBeenCalledWith({ where: { id: mockCampaign.id } });
      expect(result.deletedCampaignId).toBe(mockCampaign.id);
      expect(result.deletedTasksCount).toBe(2);
    });

    it("should throw CampaignNotFoundException if campaign does not exist", async () => {
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        campaignRepository.deleteCampaignAndTasks("not-exist"),
      ).rejects.toThrow(CampaignNotFoundException);
    });
  });


});
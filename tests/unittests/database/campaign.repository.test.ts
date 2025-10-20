import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { CampaignRepository } from "../../../src/database/repositories/campaign.repository";
import { PrismaService } from "../../../src/database/prisma/prisma.service";
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
} from "../../../src/types/database/entities.types";
import {
  CreateCampaignData,
  UpdateCampaignData,
  ListCampaignsOptions,
} from "../../../src/types/database/campaign.types";

// ==================== Mock Data ====================

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
  status: TaskStatus.PENDING,
  priority: 1,
  input: { prompt: "Test prompt" },
  result: null,
  error: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const mockCampaign: Campaign = {
  id: "campaign-1",
  userId: "user-1",
  name: "Test Campaign",
  description: "A test campaign",
  status: CampaignStatus.DRAFT,
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
        },
      });
      expect(result.description).toBe("Campaign description");
      expect(result.status).toBe(CampaignStatus.ACTIVE);
    });

    it("should throw UserNotFoundException when user does not exist", async () => {
      const createData: CreateCampaignData = {
        userId: "non-existent-user",
        name: "Test Campaign",
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
      mockPrismaService.campaign.findUnique.mockResolvedValue(
        mockCampaignWithTasks
      );

      const result = await campaignRepository.findCampaignById(
        "campaign-1",
        true,
        false
      );

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
      mockPrismaService.campaign.findUnique.mockResolvedValue(
        mockCampaignWithUser
      );

      const result = await campaignRepository.findCampaignById(
        "campaign-1",
        false,
        true
      );

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

      const result = await campaignRepository.findCampaignById(
        "campaign-1",
        true,
        true
      );

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

      const result = await campaignRepository.updateCampaign(
        "campaign-1",
        updateData
      );

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

    it("should update campaign description", async () => {
      const updateData: UpdateCampaignData = {
        description: "Updated description",
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        description: "Updated description",
      });

      const result = await campaignRepository.updateCampaign(
        "campaign-1",
        updateData
      );

      expect(result.description).toBe("Updated description");
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

      const result = await campaignRepository.updateCampaign(
        "campaign-1",
        updateData
      );

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

      const result = await campaignRepository.updateCampaign(
        "campaign-1",
        updateData
      );

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

      const result = await campaignRepository.updateCampaign(
        "campaign-1",
        updateData
      );

      expect(result.status).toBe(CampaignStatus.DRAFT);
    });

    it("should update multiple fields at once", async () => {
      const updateData: UpdateCampaignData = {
        name: "New Name",
        description: "New Description",
        status: CampaignStatus.ACTIVE,
      };

      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.update.mockResolvedValue({
        ...mockCampaign,
        ...updateData,
      });

      const result = await campaignRepository.updateCampaign(
        "campaign-1",
        updateData
      );

      expect(mockPrismaService.campaign.update).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        data: {
          name: "New Name",
          description: "New Description",
          status: CampaignStatus.ACTIVE,
        },
        include: {
          tasks: false,
          user: false,
        },
      });
      expect(result.name).toBe("New Name");
      expect(result.description).toBe("New Description");
      expect(result.status).toBe(CampaignStatus.ACTIVE);
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

  // ==================== deleteCampaign Tests ====================

  describe("deleteCampaign", () => {
    it("should delete a campaign successfully", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(mockCampaign);
      mockPrismaService.campaign.delete.mockResolvedValue(mockCampaign);

      const result = await campaignRepository.deleteCampaign("campaign-1");

      expect(mockPrismaService.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
        select: { id: true },
      });
      expect(mockPrismaService.campaign.delete).toHaveBeenCalledWith({
        where: { id: "campaign-1" },
      });
      expect(result).toEqual(mockCampaign);
    });

    it("should throw CampaignNotFoundException when campaign does not exist", async () => {
      mockPrismaService.campaign.findUnique.mockResolvedValue(null);

      await expect(
        campaignRepository.deleteCampaign("non-existent")
      ).rejects.toThrow(CampaignNotFoundException);

      expect(mockPrismaService.campaign.delete).not.toHaveBeenCalled();
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

    it("should sort campaigns by name ascending", async () => {
      const options: ListCampaignsOptions = {
        orderBy: {
          field: "name",
          direction: "asc",
        },
      };

      mockPrismaService.campaign.findMany.mockResolvedValue(mockCampaigns);
      mockPrismaService.campaign.count.mockResolvedValue(2);

      await campaignRepository.findManyCampaignsByOptions(options);

      expect(mockPrismaService.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: "asc" },
        })
      );
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
            where: { status: TaskStatus.COMPLETED },
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
              where: { status: TaskStatus.COMPLETED },
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
            where: { status: TaskStatus.PENDING },
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
            where: { status: TaskStatus.PENDING },
            orderBy: { priority: "asc" },
            take: 5,
          },
        },
      });
      expect(result.data).toHaveLength(1);
    });
  });
});
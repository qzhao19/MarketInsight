import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MarketingCampaignRepository } from '../src/database/repositories/marketing-campaign.repository';
import { PrismaService } from '../src/database/prisma/prisma.service';
import {
  CampaignNotFoundException,
  UserNotFoundException,
} from '../src/common/exceptions';
import {
  CampaignStatus,
  MarketingCampaign,
  Task,
  TaskStatus,
  User,
} from '../src/types/domain.types';

// Mock data for testing
const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockCampaign: MarketingCampaign = {
  id: 'campaign-1',
  userId: 'user-1',
  name: 'Test Campaign',
  description: 'A test campaign',
  status: CampaignStatus.DRAFT,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('MarketingCampaignRepository', () => {
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
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    campaignRepository = new MarketingCampaignRepository(
      mockPrismaService as PrismaService,
    );
  });

  describe('createCampaign', () => {
    it('should create a campaign with tasks successfully', async () => {
      const campaignWithTasks = { ...mockCampaign, tasks: [] };
      (
        mockPrismaService.marketingCampaign.create as jest.Mock
      ).mockResolvedValue(campaignWithTasks);

      const createData = {
        userId: 'user-1',
        name: 'Test Campaign',
        tasks: [{ input: { prompt: 'test' }, priority: 1 }],
      };

      const result = await campaignRepository.createCampaign(createData);

      expect(mockPrismaService.marketingCampaign.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: createData.userId } },
          name: createData.name,
          description: '',
          status: CampaignStatus.DRAFT,
          tasks: {
            create: [
              {
                input: { prompt: 'test' },
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

    it('should create a campaign and multiple tasks successfully', async () => {
    const campaignWithTasks = {
      ...mockCampaign,
      tasks: [
        {
          id: 'task-1',
          input: { prompt: 'test1' },
          result: null,
          priority: 1,
          status: TaskStatus.PENDING,
        },
        {
          id: 'task-2',
          input: { prompt: 'test2' },
          result: null,
          priority: 2,
          status: TaskStatus.PENDING,
        },
      ],
    };
    (mockPrismaService.marketingCampaign.create as jest.Mock).mockResolvedValue(campaignWithTasks);

    const createData = {
      userId: 'user-1',
      name: 'Test Campaign',
      tasks: [
        { input: { prompt: 'test1' }, priority: 1 },
        { input: { prompt: 'test2' }, priority: 2 },
      ],
    };

    const result = await campaignRepository.createCampaign(createData);

    expect(mockPrismaService.marketingCampaign.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: createData.userId } },
        name: createData.name,
        description: '',
        status: CampaignStatus.DRAFT,
        tasks: {
          create: [
            {
              input: { prompt: 'test1' },
              result: Prisma.JsonNull,
              priority: 1,
              status: TaskStatus.PENDING,
            },
            {
              input: { prompt: 'test2' },
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
    expect(result.tasks![0].input).toEqual({ prompt: 'test1' });
    expect(result.tasks![1].input).toEqual({ prompt: 'test2' });
  });


    it('should throw UserNotFoundException if user does not exist', async () => {
      const prismaError = new PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found.',
        { code: 'P2025', clientVersion: 'x.x.x' },
      );
      (
        mockPrismaService.marketingCampaign.create as jest.Mock
      ).mockRejectedValue(prismaError);

      const createData = {
        userId: 'non-existent-user',
        name: 'Test Campaign',
      };

      await expect(campaignRepository.createCampaign(createData)).rejects.toThrow(
        UserNotFoundException,
      );
    });
  });
});
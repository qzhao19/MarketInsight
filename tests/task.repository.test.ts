import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {TaskRepository } from '../src/database/repositories/task.repository';
import {
  TaskNotFoundException,
  CampaignNotFoundException,
} from '../src/common/exceptions';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { Task, TaskStatus, LLMInput, MarketingCampaign, CampaignStatus, User } from '../src/types/domain.types';

describe('TaskRepository', () => {
  let taskRepository: TaskRepository;
  let mockPrismaService: any;
  let originalConsoleError: typeof console.error;
  let originalConsoleWarn: typeof console.warn; 

  // use complete mock data
  const mockCampaign: MarketingCampaign = {
    id: 'campaign-1',
    userId: 'user-1',
    name: 'Summer Sale 2025',
    description: 'A campaign for summer products.',
    status: CampaignStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTask: Task = {
    id: 'task-1',
    campaignId: 'campaign-1',
    status: TaskStatus.PENDING,
    priority: 1,
    input: { prompt: 'test prompt' },
    result: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    campaign: mockCampaign, // full campaign object
  };

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
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
      marketingCampaign: {
        findUnique: jest.fn(),
      },
    };

    // inject this mocked service into the TaskRepository constructor,
    taskRepository = new TaskRepository(mockPrismaService as PrismaService);
  });

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const createTaskData = { campaignId: 'campaign-1', input: { prompt: 'new prompt' } };
      
      // mock its dependencies
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue({ id: 'campaign-1' });
      (mockPrismaService.task.create as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskRepository.createTask(createTaskData);

      expect(mockPrismaService.marketingCampaign.findUnique).toHaveBeenCalledWith({
        where: { id: createTaskData.campaignId },
        select: { id: true },
      });
      expect(mockPrismaService.task.create).toHaveBeenCalledWith({
        data: {
          campaignId: createTaskData.campaignId,
          input: createTaskData.input,
          priority: 1,
          status: TaskStatus.PENDING,
        },
      });
      expect(result.id).toEqual(mockTask.id);
      expect(result.status).toEqual(TaskStatus.PENDING);
    });

    it('should throw CampaignNotFoundException if campaign does not exist', async () => {
      const createTaskData = { campaignId: 'non-existent-campaign', input: { prompt: 'new prompt' } };
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(taskRepository.createTask(createTaskData)).rejects.toThrow(
        CampaignNotFoundException
      );

      expect(mockPrismaService.task.create).not.toHaveBeenCalled();
    });
  });

  describe('findTaskById', () => {
    it('should return a task with its campaign when found', async () => {
      (mockPrismaService.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskRepository.findTaskById('task-1', true);

      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: { campaign: true },
      });
      expect(result.id).toEqual(mockTask.id);
      expect(result.campaign?.id).toEqual(mockCampaign.id);
    });

    it('should throw TaskNotFoundException when task is not found', async () => {
      (mockPrismaService.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(taskRepository.findTaskById('non-existent-id')).rejects.toThrow(
        TaskNotFoundException
      );
    });
  });

  describe('updateTask', () => {
    it('should update a task successfully', async () => {
      const updateData = { status: TaskStatus.COMPLETED };
      const updatedTask = { ...mockTask, status: TaskStatus.COMPLETED };
      (mockPrismaService.task.update as jest.Mock).mockResolvedValue(updatedTask);

      const result = await taskRepository.updateTask('task-1', updateData);

      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: updateData,
        include: { campaign: true },
      });
      expect(result.status).toEqual(TaskStatus.COMPLETED);
    });

    it('should throw TaskNotFoundException if task to update does not exist', async () => {
      const updateData = { status: TaskStatus.PROCESSING };
      // 
      const prismaError = new PrismaClientKnownRequestError(
        'An operation failed because it depends on one or more records that were required but not found.',
        { code: 'P2025', clientVersion: 'x.x.x' }
      );
      (mockPrismaService.task.update as jest.Mock).mockRejectedValue(prismaError);

      await expect(taskRepository.updateTask('non-existent-id', updateData)).rejects.toThrow(
        TaskNotFoundException
      );
    });

    it('should not perform a database write if update data is empty', async () => {
      (mockPrismaService.task.findUnique as jest.Mock).mockResolvedValue(mockTask);
      
      const result = await taskRepository.updateTask('task-1', {});

      expect(mockPrismaService.task.update).not.toHaveBeenCalled();
      expect(result.id).toEqual(mockTask.id);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task successfully', async () => {
      (mockPrismaService.task.delete as jest.Mock).mockResolvedValue(mockTask as any);

      const result = await taskRepository.deleteTask('task-1', false);

      expect(mockPrismaService.task.delete).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: { campaign: false },
      });
      expect(result.id).toEqual(mockTask.id);
    });
  });


  describe('findManyTasksByOptions', () => {
    it('should return a find of tasks with default options', async () => {
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([mockTask]);

      const result = await taskRepository.findManyTasksByOptions();

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: [{ createdAt: 'desc' }],
        include: { campaign: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(mockTask.id);
    });

    it('should apply custom filtering, sorting, and pagination options', async () => {
      const customOptions = {
        where: { status: TaskStatus.COMPLETED },
        skip: 5,
        take: 10,
        orderBy: [{ field: 'priority' as 'priority', direction: 'asc' as 'asc' }],
        includeCampaign: false,
      };
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([]);

      await taskRepository.findManyTasksByOptions(customOptions);

      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: customOptions.where,
        skip: customOptions.skip,
        take: customOptions.take,
        orderBy: [{ priority: 'asc' }],
        include: { campaign: false },
      });
    });

    it('should handle database errors correctly', async () => {
        const dbError = new Error('Database connection failed');
        (mockPrismaService.task.findMany as jest.Mock).mockRejectedValue(dbError);
        
        await expect(taskRepository.findManyTasksByOptions()).rejects.toThrow();
      });

      it('should return an empty array when no tasks match the criteria', async () => {
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([]);
      
      const result = await taskRepository.findManyTasksByOptions({
        where: { status: TaskStatus.COMPLETED }
      });
      
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should correctly apply multiple sort criteria', async () => {
      const sortOptions = {
        orderBy: [
          { field: 'priority' as const, direction: 'desc' as const },
          { field: 'createdAt' as const, direction: 'asc' as const }
        ]
      };
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([]);
      
      await taskRepository.findManyTasksByOptions(sortOptions);
      
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { priority: 'desc' },
            { createdAt: 'asc' }
          ]
        })
      );
    });

    it('should handle complex filtering conditions', async () => {
      const complexWhere = {
        where: {
          status: TaskStatus.PENDING,
          priority: 3,
          campaignId: 'test-campaign'
        }
      };
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([]);
      
      await taskRepository.findManyTasksByOptions(complexWhere);
      
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: complexWhere.where
        })
      );
    });

    it('should respect includeCampaign=false option', async () => {
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([mockTask]);
      
      await taskRepository.findManyTasksByOptions({ includeCampaign: false });
      
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { campaign: false }
        })
      );
    });

    it('should correctly map prisma results to domain objects', async () => {
      const rawPrismaTasks = [{
        ...mockTask,
        status: 'COMPLETED',
        input: { prompt: 'mapped prompt' },
        result: null
      }];
      
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue(rawPrismaTasks);
      
      const result = await taskRepository.findManyTasksByOptions();
      
      expect(result[0]).toHaveProperty('status', TaskStatus.COMPLETED);
      expect(result[0].input).toEqual({ prompt: 'mapped prompt' });
    });
    
    it('should handle extreme pagination values', async () => {
      const extremeOptions = {
        skip: 1000,
        take: 100
      };
      (mockPrismaService.task.findMany as jest.Mock).mockResolvedValue([]);
      
      await taskRepository.findManyTasksByOptions(extremeOptions);
      
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 1000,
          take: 100
        })
      );
    });
  });
});
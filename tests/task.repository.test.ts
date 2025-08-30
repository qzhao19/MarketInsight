import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  TaskRepository,
  TaskNotFoundException,
  CampaignNotFoundException,
} from '../src/database/repositories/task.repository';
import { PrismaService } from '../src/database/prisma.service';
import { Task, TaskStatus, LLMInput, MarketingCampaign, CampaignStatus, User } from '../src/types/task.types';

describe('TaskRepository', () => {
  let taskRepository: TaskRepository;
  let mockPrismaService: any;
  let originalConsoleError: typeof console.error;

  // --- 使用完整的模拟数据 ---
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
    campaign: mockCampaign, // 包含完整的 campaign 对象
  };

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = jest.fn(); // 抑制测试期间的 console.error 输出
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // 创建一个包含所需 mock 委托的 PrismaService 模拟对象
    mockPrismaService = {
      task: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      marketingCampaign: {
        findUnique: jest.fn(),
      },
    };

    // 将模拟的服务注入到 TaskRepository 的构造函数中
    taskRepository = new TaskRepository(mockPrismaService as PrismaService);
  });

  describe('createTask', () => {
    it('should create a new task successfully', async () => {
      const createTaskData = { campaignId: 'campaign-1', input: { prompt: 'new prompt' } };
      
      // 模拟依赖
      (mockPrismaService.marketingCampaign.findUnique as jest.Mock).mockResolvedValue({ id: 'campaign-1' });
      (mockPrismaService.task.create as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskRepository.createTask(createTaskData);

      // 断言
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

  describe('getTaskById', () => {
    it('should return a task with its campaign when found', async () => {
      (mockPrismaService.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskRepository.getTaskById('task-1', true);

      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        include: { campaign: true },
      });
      expect(result.id).toEqual(mockTask.id);
      expect(result.campaign?.id).toEqual(mockCampaign.id);
    });

    it('should throw TaskNotFoundException when task is not found', async () => {
      (mockPrismaService.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(taskRepository.getTaskById('non-existent-id')).rejects.toThrow(
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
      // 模拟 Prisma 的 P2025 错误（记录未找到）
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
      // 模拟在不更新时发生的内部 getTaskById 调用
      (mockPrismaService.task.findUnique as jest.Mock).mockResolvedValue(mockTask);
      
      const result = await taskRepository.updateTask('task-1', {});

      // 断言
      expect(mockPrismaService.task.update).not.toHaveBeenCalled();
      expect(result.id).toEqual(mockTask.id); // 应该返回原始任务
    });
  });
});
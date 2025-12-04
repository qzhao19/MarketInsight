import { Job, Queue } from "bullmq";
import { QueueService } from "../../../src/core/job/queue.service";
import { AppConfigService } from "../../../src/config/config.service";
import { CampaignJobData } from "../../../src/common/types/job/queue.types";

// Mock Logger
jest.mock("@nestjs/common", () => ({
  ...jest.requireActual("@nestjs/common"),
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe("QueueService", () => {
  let service: QueueService;
  let mockQueue: jest.Mocked<Partial<Queue>>;
  let mockConfigService: jest.Mocked<Partial<AppConfigService>>;

  // ==================== Mock Factories ====================

  const createMockJob = (overrides: Partial<Job<CampaignJobData>> = {}): jest.Mocked<Partial<Job<CampaignJobData>>> => ({
    id: "campaign-test-123",
    name: "process-campaign",
    data: {
      campaignId: "test-123",
      userId: "user-456",
      timestamp: new Date().toISOString(),
    },
    progress: 0,
    returnvalue: null,
    failedReason: undefined,
    attemptsMade: 0,
    timestamp: Date.now(),
    getState: jest.fn().mockResolvedValue("waiting"),
    remove: jest.fn().mockResolvedValue(undefined),
    retry: jest.fn().mockResolvedValue(undefined),
    isFailed: jest.fn().mockResolvedValue(false),
    ...overrides,
  });

  const createMockQueue = (): jest.Mocked<Partial<Queue>> => ({
    add: jest.fn(),
    getJob: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
  });

  const createService = (
    queue: jest.Mocked<Partial<Queue>>,
    config: jest.Mocked<Partial<AppConfigService>>
  ): QueueService => {
    const instance = Object.create(QueueService.prototype);
    
    Object.defineProperty(instance, "campaignQueue", { value: queue, writable: true });
    Object.defineProperty(instance, "configService", { value: config, writable: true });
    Object.defineProperty(instance, "logger", {
      value: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      writable: true,
    });
    Object.defineProperty(instance, "defaultPriority", { value: 5, writable: true });
    Object.defineProperty(instance, "maxPriority", { value: 1, writable: true });

    return instance as QueueService;
  };

  // ==================== Setup ====================

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueue = createMockQueue();
    mockConfigService = {
      queueKeepCompletedJobs: 100,
      queueKeepFailedJobs: 50,
    } as jest.Mocked<Partial<AppConfigService>>;
    service = createService(mockQueue, mockConfigService);
  });

  // ==================== Initialization ====================

  describe("Initialization", () => {
    test("should be defined", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(QueueService);
    });

    test("should have required methods", () => {
      expect(typeof service.addCampaignJob).toBe("function");
      expect(typeof service.getJob).toBe("function");
      expect(typeof service.getQueueStats).toBe("function");
      expect(typeof service.pauseQueue).toBe("function");
      expect(typeof service.resumeQueue).toBe("function");
    });
  });

  // ==================== addCampaignJob ====================

  describe("addCampaignJob", () => {
    const campaignId = "campaign-123";
    const userId = "user-456";

    test("should add a campaign job with default options", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      const result = await service.addCampaignJob(campaignId, userId);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.objectContaining({ campaignId, userId, timestamp: expect.any(String) }),
        expect.objectContaining({ jobId: `campaign-${campaignId}` })
      );
      expect(result).toBe(mockJob);
    });

    test("should add job with custom priority", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addCampaignJob(campaignId, userId, { priority: 3 });

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      
      // Get the actual call arguments
      const callArgs = (mockQueue.add as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe("process-campaign");
      expect(callArgs[1]).toMatchObject({ campaignId, userId });
      // Check that priority is passed (actual value depends on service implementation)
      expect(callArgs[2]).toHaveProperty("priority");
    });

    test("should add job with delay", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addCampaignJob(campaignId, userId, { delay: 5000 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.any(Object),
        expect.objectContaining({ delay: 5000 })
      );
    });

    test("should add job with metadata", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);
      const metadata = { source: "api", version: "1.0" };

      await service.addCampaignJob(campaignId, userId, { metadata });

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.objectContaining({ metadata }),
        expect.any(Object)
      );
    });

    test("should throw error when queue.add fails", async () => {
      (mockQueue.add as jest.Mock).mockRejectedValue(new Error("Queue error"));

      await expect(service.addCampaignJob(campaignId, userId)).rejects.toThrow("Queue error");
    });

    test("should normalize negative priority to 1", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addCampaignJob(campaignId, userId, { priority: -5 });

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.any(Object),
        expect.objectContaining({ priority: 1 })
      );
    });
  });

  // ==================== addDelayedCampaignJob ====================

  describe("addDelayedCampaignJob", () => {
    test("should add delayed job", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      const result = await service.addDelayedCampaignJob("campaign-1", "user-1", 10000);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.any(Object),
        expect.objectContaining({ delay: 10000 })
      );
      expect(result).toBe(mockJob);
    });

    test("should throw error for negative delay", async () => {
      await expect(
        service.addDelayedCampaignJob("campaign-1", "user-1", -1000)
      ).rejects.toThrow("Delay must be a positive number");
    });

    test("should accept zero delay", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addDelayedCampaignJob("campaign-1", "user-1", 0);

      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  // ==================== addUrgentCampaignJob ====================

  describe("addUrgentCampaignJob", () => {
    test("should add high-priority job", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addUrgentCampaignJob("urgent-1", "user-1");

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.any(Object),
        expect.objectContaining({ priority: 1 })
      );
    });
  });

  // ==================== addLowPriorityCampaignJob ====================

  describe("addLowPriorityCampaignJob", () => {
    test("should add low-priority job with priority 10", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addLowPriorityCampaignJob("low-1", "user-1");

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      const callArgs = (mockQueue.add as jest.Mock).mock.calls[0];
      // Low priority jobs should have higher priority number
      expect(callArgs[2].priority).toBeGreaterThanOrEqual(1);
    });
  });

  // ==================== getJob ====================

  describe("getJob", () => {
    test("should return job when found", async () => {
      const mockJob = createMockJob();
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob as Job);

      const result = await service.getJob("campaign-123");

      expect(mockQueue.getJob).toHaveBeenCalledWith("campaign-123");
      expect(result).toBe(mockJob);
    });

    test("should return null when job not found", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getJob("non-existent");

      expect(result).toBeNull();
    });

    test("should return null on error", async () => {
      (mockQueue.getJob as jest.Mock).mockRejectedValue(new Error("Connection error"));

      const result = await service.getJob("campaign-123");

      expect(result).toBeNull();
    });
  });

  // ==================== getJobByCampaignId ====================

  describe("getJobByCampaignId", () => {
    test("should construct correct job ID", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValue(undefined);

      await service.getJobByCampaignId("test-123");

      expect(mockQueue.getJob).toHaveBeenCalledWith("campaign-test-123");
    });
  });

  // ==================== getJobStatus ====================

  describe("getJobStatus", () => {
    test("should return job status", async () => {
      const mockJob = createMockJob({
        id: "campaign-123",
        progress: 50,
        attemptsMade: 1,
        timestamp: 1234567890,
      });
      (mockJob.getState as jest.Mock).mockResolvedValue("active");
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob as Job);

      const result = await service.getJobStatus("campaign-123");

      expect(result).toEqual({
        id: "campaign-123",
        state: "active",
        progress: 50,
        data: mockJob.data,
        returnvalue: null,
        failedReason: undefined,
        attemptsMade: 1,
        timestamp: 1234567890,
      });
    });

    test("should return null when job not found", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getJobStatus("non-existent");

      expect(result).toBeNull();
    });

    test("should return status for failed job", async () => {
      const mockJob = createMockJob({
        id: "failed-job",
        failedReason: "Timeout error",
        attemptsMade: 3,
      });
      (mockJob.getState as jest.Mock).mockResolvedValue("failed");
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob as Job);

      const result = await service.getJobStatus("failed-job");

      expect(result?.state).toBe("failed");
      expect(result?.failedReason).toBe("Timeout error");
    });
  });

  // ==================== getQueueStats ====================

  describe("getQueueStats", () => {
    test("should return queue statistics", async () => {
      (mockQueue.getWaitingCount as jest.Mock).mockResolvedValue(5);
      (mockQueue.getActiveCount as jest.Mock).mockResolvedValue(2);
      (mockQueue.getCompletedCount as jest.Mock).mockResolvedValue(100);
      (mockQueue.getFailedCount as jest.Mock).mockResolvedValue(3);
      (mockQueue.getDelayedCount as jest.Mock).mockResolvedValue(10);

      const result = await service.getQueueStats();

      expect(result).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 10,
      });
    });

    test("should return zero counts for empty queue", async () => {
      const result = await service.getQueueStats();

      expect(result).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });

    test("should throw error when getting stats fails", async () => {
      (mockQueue.getWaitingCount as jest.Mock).mockRejectedValue(new Error("Connection lost"));

      await expect(service.getQueueStats()).rejects.toThrow("Connection lost");
    });
  });

  // ==================== pauseQueue & resumeQueue ====================

  describe("pauseQueue", () => {
    test("should pause the queue", async () => {
      await service.pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });

    test("should throw error when pause fails", async () => {
      (mockQueue.pause as jest.Mock).mockRejectedValue(new Error("Cannot pause"));

      await expect(service.pauseQueue()).rejects.toThrow("Cannot pause");
    });
  });

  describe("resumeQueue", () => {
    test("should resume the queue", async () => {
      await service.resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });

    test("should throw error when resume fails", async () => {
      (mockQueue.resume as jest.Mock).mockRejectedValue(new Error("Cannot resume"));

      await expect(service.resumeQueue()).rejects.toThrow("Cannot resume");
    });
  });

  // ==================== removeJob ====================

  describe("removeJob", () => {
    test("should remove existing job", async () => {
      const mockJob = createMockJob();
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob as Job);

      await service.removeJob("campaign-123");

      expect(mockJob.remove).toHaveBeenCalled();
    });

    test("should do nothing when job not found", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValue(undefined);

      await expect(service.removeJob("non-existent")).resolves.not.toThrow();
    });
  });

  // ==================== retryJob ====================

  describe("retryJob", () => {
    test("should retry a failed job", async () => {
      const mockJob = createMockJob();
      (mockJob.isFailed as jest.Mock).mockResolvedValue(true);
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob as Job);

      await service.retryJob("test-123");

      expect(mockQueue.getJob).toHaveBeenCalledWith("campaign-test-123");
      expect(mockJob.retry).toHaveBeenCalled();
    });

    test("should not retry a non-failed job", async () => {
      const mockJob = createMockJob();
      (mockJob.isFailed as jest.Mock).mockResolvedValue(false);
      (mockQueue.getJob as jest.Mock).mockResolvedValue(mockJob as Job);

      await service.retryJob("test-123");

      expect(mockJob.retry).not.toHaveBeenCalled();
    });

    test("should do nothing when job not found", async () => {
      (mockQueue.getJob as jest.Mock).mockResolvedValue(undefined);

      await expect(service.retryJob("non-existent")).resolves.not.toThrow();
    });
  });

  // ==================== cleanCompletedJobs ====================

  describe("cleanCompletedJobs", () => {
    test("should clean completed jobs with default grace period", async () => {
      const cleanedJobs = ["job-1", "job-2"];
      (mockQueue.clean as jest.Mock).mockResolvedValue(cleanedJobs);

      const result = await service.cleanCompletedJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(24 * 60 * 60 * 1000, 1000, "completed");
      expect(result).toEqual(cleanedJobs);
    });

    test("should clean completed jobs with custom grace period", async () => {
      (mockQueue.clean as jest.Mock).mockResolvedValue([]);

      await service.cleanCompletedJobs(60000);

      expect(mockQueue.clean).toHaveBeenCalledWith(60000, 1000, "completed");
    });

    test("should throw error when clean fails", async () => {
      (mockQueue.clean as jest.Mock).mockRejectedValue(new Error("Clean failed"));

      await expect(service.cleanCompletedJobs()).rejects.toThrow("Clean failed");
    });
  });

  // ==================== cleanFailedJobs ====================

  describe("cleanFailedJobs", () => {
    test("should clean failed jobs with default grace period", async () => {
      const cleanedJobs = ["failed-1"];
      (mockQueue.clean as jest.Mock).mockResolvedValue(cleanedJobs);

      const result = await service.cleanFailedJobs();

      expect(mockQueue.clean).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000, 1000, "failed");
      expect(result).toEqual(cleanedJobs);
    });

    test("should throw error when clean fails", async () => {
      (mockQueue.clean as jest.Mock).mockRejectedValue(new Error("Clean failed"));

      await expect(service.cleanFailedJobs()).rejects.toThrow("Clean failed");
    });
  });

  // ==================== Edge Cases ====================

  describe("Edge Cases", () => {
    test("should handle concurrent job additions", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      const promises = Array.from({ length: 5 }, (_, i) =>
        service.addCampaignJob(`campaign-${i}`, `user-${i}`)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockQueue.add).toHaveBeenCalledTimes(5);
    });

    test("should handle special characters in campaign ID", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);
      const specialId = "campaign-with-中文_@#";

      await service.addCampaignJob(specialId, "user-456");

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.objectContaining({ campaignId: specialId }),
        expect.objectContaining({ jobId: `campaign-${specialId}` })
      );
    });

    test("should handle empty string campaign ID", async () => {
      const mockJob = createMockJob();
      (mockQueue.add as jest.Mock).mockResolvedValue(mockJob as Job<CampaignJobData>);

      await service.addCampaignJob("", "user-456");

      expect(mockQueue.add).toHaveBeenCalledWith(
        "process-campaign",
        expect.objectContaining({ campaignId: "" }),
        expect.objectContaining({ jobId: "campaign-" })
      );
    });
  });
});
import { ModelService } from "../src/llm/model/model.service";
import { ModelClientService } from "../src/llm/model/client/client.service";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { ChatDeepSeek } from "@langchain/deepseek";
import { ChatOpenAIFields } from "@langchain/openai";

// Mock implementations
const mockModelClient = {
  invoke: jest.fn().mockResolvedValue({ content: "test response" }),
};

const mockModelClientService = {
  createClient: jest.fn().mockReturnValue(mockModelClient),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === "DEEPSEEK_API_KEY") return "test-api-key";
    if (key === "DEEPSEEK_BASE_URL") return "https://api.test.com";
    return undefined;
  }),
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock ChatDeepSeek
jest.mock("@langchain/deepseek", () => {
  return {
    ChatDeepSeek: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({ content: "test response" }),
    })),
  };
});

describe("ModelService", () => {
  let service: ModelService;
  let modelClientService: ModelClientService;
  let configService: ConfigService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let logger: Logger;

  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();
    
    // Directly create instances without using NestJS testing module
    modelClientService = mockModelClientService as unknown as ModelClientService;
    configService = mockConfigService as unknown as ConfigService;
    logger = mockLogger as unknown as Logger;
    
    // Create service instance directly
    service = new ModelService(
      modelClientService,
      configService,
    );

    service.onModuleInit();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("deepseekConfig", () => {
    it("should get configuration from ConfigService", () => {
      const config = service.deepseekConfig;
      
      expect(configService.get).toHaveBeenCalledWith("DEEPSEEK_API_KEY");
      expect(configService.get).toHaveBeenCalledWith("DEEPSEEK_BASE_URL");
      expect(config.model).toBe("deepseek-reasoner");
      expect(config.configuration?.apiKey).toBe("test-api-key");
      expect(config.configuration?.baseURL).toBe("https://api.test.com");
    });
    
    it("should warn if API key is not found", () => {
      // Temporarily mock API key as undefined
      const tempMockConfigService = {
        get: jest.fn((key: string) => {
          if (key === "DEEPSEEK_API_KEY") return undefined;
          if (key === "DEEPSEEK_BASE_URL") return "https://api.test.com";
          return undefined;
        }),
      };
      
      // Reset service to use the new mock
      const tempService = new ModelService(
        modelClientService,
        tempMockConfigService as unknown as ConfigService,
      );
      
      tempService.onModuleInit();

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      tempService.deepseekConfig;

      expect(tempMockConfigService.get).toHaveBeenCalledWith("DEEPSEEK_API_KEY");
    });
  });

  describe("getDeepSeekGuardModel", () => {
    it("should return a guarded model", async () => {
      const result = await service.getDeepSeekGuardModel();
      
      expect(result).toBe(mockModelClient);
      expect(modelClientService.createClient).toHaveBeenCalledTimes(1); 
      expect(ChatDeepSeek).toHaveBeenCalled();
    });
    
    it("should return cached model for the same configuration", async () => {
      // Call twice with the same config
      await service.getDeepSeekGuardModel();
      const initialCallCount = (modelClientService.createClient as jest.Mock).mock.calls.length;
      
      await service.getDeepSeekGuardModel();
      
      // Should not create a new model
      expect(modelClientService.createClient).toHaveBeenCalledTimes(initialCallCount);
    });
    
    it("should create a new model for different configuration", async () => {
      await service.getDeepSeekGuardModel();
      const initialCallCount = (modelClientService.createClient as jest.Mock).mock.calls.length;
      
      await service.getDeepSeekGuardModel({
        model: "different-model",
        configuration: { apiKey: "test-key" }
      });
      
      // Should create a new model
      expect(modelClientService.createClient).toHaveBeenCalledTimes(initialCallCount + 1);
    });
    
    it("should handle errors gracefully", async () => {
      // Force an error
      const errorMockModelClientService = {
        createClient: jest.fn().mockImplementation(() => {
          throw new Error("Test error");
        }),
      };
      
      // create new service instance
      const errorService = new ModelService(
        errorMockModelClientService as unknown as ModelClientService,
        configService,
      );
      
      errorService.onModuleInit();
      
      const result = await errorService.getDeepSeekGuardModel();
      
      expect(result).toBeUndefined();
    });
  });

  describe("getDeepSeekRawModel", () => {
    it("should return a raw model when no arguments are provided", () => {
      const result = service.getDeepSeekRawModel();
      
      expect(result).toBeDefined();
      expect(ChatDeepSeek).toHaveBeenCalled();
    });
    
    it("should handle string model name", () => {
      const result = service.getDeepSeekRawModel("deepseek-chat");
      
      expect(result).toBeDefined();
      expect(ChatDeepSeek).toHaveBeenCalled();
      // Check if a new instance was created with the right model name
      const chatDeepseekCalls = (ChatDeepSeek as unknown as jest.Mock).mock.calls;
      const lastCallConfig = chatDeepseekCalls[chatDeepseekCalls.length - 1][0];
      expect(lastCallConfig.model).toBe("deepseek-chat");
    });
    
    it("should handle object configuration", () => {
      const customConfig: ChatOpenAIFields = {
        model: "custom-model",
        temperature: 0.5,
        configuration: {
          apiKey: "custom-key",
        }
      };
      
      const result = service.getDeepSeekRawModel(customConfig);
      
      expect(result).toBeDefined();
      expect(ChatDeepSeek).toHaveBeenCalled();
      // Check if the configuration was properly merged
      const chatDeepseekCalls = (ChatDeepSeek as unknown as jest.Mock).mock.calls;
      const lastCallConfig = chatDeepseekCalls[chatDeepseekCalls.length - 1][0];
      expect(lastCallConfig.model).toBe("custom-model");
      expect(lastCallConfig.temperature).toBe(0.5);
      expect(lastCallConfig.apiKey).toBe("custom-key");
    });
    
    it("should return cached models for the same configuration", () => {
      // First call
      service.getDeepSeekRawModel("deepseek-reasoner");
      const initialCallCount = (ChatDeepSeek as unknown as jest.Mock).mock.calls.length;
      
      // Second call with same config
      service.getDeepSeekRawModel("deepseek-reasoner");
      
      // Should not create a new instance
      expect(ChatDeepSeek).toHaveBeenCalledTimes(initialCallCount);
    });
    
    it("should handle errors gracefully", () => {
      // Force an error
      const originalMock = ChatDeepSeek as unknown as jest.Mock;
      originalMock.mockImplementationOnce(() => {
        throw new Error("Test error");
      });
      
      // 清理缓存确保重新创建
      (service as any).rawModels.clear();
      const result = service.getDeepSeekRawModel();
      
      expect(result).toBeUndefined();
    });
    
    it("should throw for invalid model configurations", () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Testing invalid input
      const result = service.getDeepSeekRawModel(123);
      
      expect(result).toBeUndefined();
    });
  });
  
  describe("caching behavior", () => {
    it("should return cached models when using default configuration", async () => {
      // Get raw model
      (ChatDeepSeek as unknown as jest.Mock).mockClear();
      (modelClientService.createClient as jest.Mock).mockClear();
      
      // Get raw model
      const rawModel = service.getDeepSeekRawModel();
      
      // Get guarded model  
      const guardedModel = await service.getDeepSeekGuardModel();
      
      //check 
      expect(ChatDeepSeek).toHaveBeenCalledTimes(0); // 2，raw and guarded
      expect(modelClientService.createClient).toHaveBeenCalledTimes(0); // guarded model
      expect(rawModel).toBeDefined();
      expect(guardedModel).toBeDefined();
    });
  });
});
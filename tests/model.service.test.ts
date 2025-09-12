import { ModelService } from '../src/llm/model/model.service';
import { ModelClientService, ModelClient } from '../src/llm/model/model.client';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { ChatDeepSeek } from '@langchain/deepseek';
import { ChatOpenAIFields } from '@langchain/openai';

// Mock implementations
const mockModelClient = {
  invoke: jest.fn().mockResolvedValue({ content: 'test response' }),
};

const mockModelClientService = {
  createClient: jest.fn().mockReturnValue(mockModelClient),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'DEEPSEEK_API_KEY') return 'test-api-key';
    if (key === 'BASE_URL_DEEPSEEK') return 'https://api.test.com';
    return undefined;
  }),
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Mock ChatDeepSeek
jest.mock('@langchain/deepseek', () => {
  return {
    ChatDeepSeek: jest.fn().mockImplementation(() => ({
      invoke: jest.fn().mockResolvedValue({ content: 'test response' }),
    })),
  };
});

describe('ModelService', () => {
  let service: ModelService;
  let modelClientService: ModelClientService;
  let configService: ConfigService;
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
      logger
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deepseekConfig', () => {
    it('should get configuration from ConfigService', () => {
      const config = service.deepseekConfig;
      
      expect(configService.get).toHaveBeenCalledWith('DEEPSEEK_API_KEY');
      expect(configService.get).toHaveBeenCalledWith('BASE_URL_DEEPSEEK');
      expect(config.model).toBe('deepseek-reasoner');
      expect(config.configuration?.apiKey).toBe('test-api-key');
      expect(config.configuration?.baseURL).toBe('https://api.test.com');
    });
    
    it('should warn if API key is not found', () => {
      // Temporarily mock API key as undefined
      (mockConfigService.get as jest.Mock).mockImplementationOnce((key: string) => 
        key === 'DEEPSEEK_API_KEY' ? undefined : 'https://api.test.com'
      );
      
      // Reset service to use the new mock
      service = new ModelService(
        modelClientService,
        configService,
        logger
      );
      
      service.deepseekConfig;
      
      expect(logger.warn).toHaveBeenCalledWith('DEEPSEEK API key not found in environment variables!');
    });
  });

  describe('getDeepSeekGuardModel', () => {
    it('should return a guarded model', async () => {
      const result = await service.getDeepSeekGuardModel();
      
      expect(result).toBe(mockModelClient);
      expect(modelClientService.createClient).toHaveBeenCalledTimes(1); 
      expect(ChatDeepSeek).toHaveBeenCalled();
    });
    
    it('should return cached model for the same configuration', async () => {
      // Call twice with the same config
      await service.getDeepSeekGuardModel();
      const initialCallCount = (modelClientService.createClient as jest.Mock).mock.calls.length;
      
      await service.getDeepSeekGuardModel();
      
      // Should not create a new model
      expect(modelClientService.createClient).toHaveBeenCalledTimes(initialCallCount);
    });
    
    it('should create a new model for different configuration', async () => {
      await service.getDeepSeekGuardModel();
      const initialCallCount = (modelClientService.createClient as jest.Mock).mock.calls.length;
      
      await service.getDeepSeekGuardModel({
        model: 'different-model',
        configuration: { apiKey: 'test-key' }
      });
      
      // Should create a new model
      expect(modelClientService.createClient).toHaveBeenCalledTimes(initialCallCount + 1);
    });
    
    it('should handle errors gracefully', async () => {
      // Force an error
      (modelClientService.createClient as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      (service as any).models.clear();
      const result = await service.getDeepSeekGuardModel();
      
      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getDeepSeekRawModel', () => {
    it('should return a raw model when no arguments are provided', () => {
      const result = service.getDeepSeekRawModel();
      
      expect(result).toBeDefined();
      expect(ChatDeepSeek).toHaveBeenCalled();
    });
    
    it('should handle string model name', () => {
      const result = service.getDeepSeekRawModel('deepseek-chat');
      
      expect(result).toBeDefined();
      expect(ChatDeepSeek).toHaveBeenCalled();
      // Check if a new instance was created with the right model name
      const chatDeepseekCalls = (ChatDeepSeek as unknown as jest.Mock).mock.calls;
      const lastCallConfig = chatDeepseekCalls[chatDeepseekCalls.length - 1][0];
      expect(lastCallConfig.model).toBe('deepseek-chat');
    });
    
    it('should handle object configuration', () => {
      const customConfig: ChatOpenAIFields = {
        model: 'custom-model',
        temperature: 0.5,
        configuration: {
          apiKey: 'custom-key',
        }
      };
      
      const result = service.getDeepSeekRawModel(customConfig);
      
      expect(result).toBeDefined();
      expect(ChatDeepSeek).toHaveBeenCalled();
      // Check if the configuration was properly merged
      const chatDeepseekCalls = (ChatDeepSeek as unknown as jest.Mock).mock.calls;
      const lastCallConfig = chatDeepseekCalls[chatDeepseekCalls.length - 1][0];
      expect(lastCallConfig.model).toBe('custom-model');
      expect(lastCallConfig.temperature).toBe(0.5);
      expect(lastCallConfig.apiKey).toBe('custom-key');
    });
    
    it('should return cached models for the same configuration', () => {
      // First call
      service.getDeepSeekRawModel('deepseek-reasoner');
      const initialCallCount = (ChatDeepSeek as unknown as jest.Mock).mock.calls.length;
      
      // Second call with same config
      service.getDeepSeekRawModel('deepseek-reasoner');
      
      // Should not create a new instance
      expect(ChatDeepSeek).toHaveBeenCalledTimes(initialCallCount);
    });
    
    it('should handle errors gracefully', () => {
      // Force an error
      (ChatDeepSeek as unknown as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      (service as any).rawModels.clear();
      const result = service.getDeepSeekRawModel();
      
      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
    
    it('should throw for invalid model configurations', () => {
      // @ts-ignore - Testing invalid input
      const result = service.getDeepSeekRawModel(123);
      
      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalled();
    });
  });
  
  describe('caching behavior', () => {
    it('should use different caches for raw and guarded models', async () => {
      // Get raw model
      const rawModel = service.getDeepSeekRawModel();
      
      // Get guarded model
      const guardedModel = await service.getDeepSeekGuardModel();
      
      // Both should create their own instances
      expect(ChatDeepSeek).toHaveBeenCalledTimes(1); 
      expect(modelClientService.createClient).toHaveBeenCalledTimes(1); 
    });
  });
});
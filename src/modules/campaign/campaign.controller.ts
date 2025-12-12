import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { CampaignService } from "./services/campaign.service";
import { 
  CreateCampaignDto,
  ListCampaignsQueryDto,
  ListTasksQueryDto,
  CampaignResponseDto,
  CampaignListResponseDto,
  TaskResponseDto,
  TaskListResponseDto,
} from "./dto";
import { 
  CreateCampaignInput,
  ListCampaignsOptions,
  ListTasksByCampaignWithOptions,
  ListTasksOptions,
} from "./types/campaign.types";
import { AuthGuard } from "../../common/guards/api/auth.guard";
import { AgentInvokeOptions } from "../../common/types/agent/agent.types";

/**
 * Campaign Controller
 * Handles HTTP requests for campaign management
 * 
 * Base path: /campaigns
 * Full path: /api/v1/campaigns
 * 
 * Responsibilities:
 * - HTTP request/response handling
 * - Input validation
 * - Authentication/Authorization
 * - DTO transformation
 */
@ApiTags("Campaigns")
@Controller("campaigns")
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class CampaignController {
  private readonly logger = new Logger(CampaignController.name);

  constructor(private readonly campaignService: CampaignService) {
    this.logger.log("CampaignController initialized");
  }

  // ==================== Campaign Creation ====================

  /**
   * Create and start a new campaign
   * POST /api/v1/campaigns
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: "Create and start a new marketing campaign",
    description: `Creates a campaign record and immediately queues it for execution by the Agent.
    
**Workflow:**
1. Validates input (name, userPrompt, etc.)
2. Creates campaign record in database with ACTIVE status
3. Adds campaign job to queue for Agent processing
4. Returns campaign data immediately (does not wait for completion)

**Notes:**
- Campaign execution happens asynchronously in the background
- Use GET /campaigns/:id/progress to track execution status
- Use GET /campaigns/:id/results to retrieve final report when completed`,
  })
  @ApiBody({ type: CreateCampaignDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: "Campaign created and queued successfully",
    type: CampaignResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: "Invalid input data (validation failed)",
    schema: {
      example: {
        statusCode: 400,
        message: ["userPrompt must be at least 10 characters"],
        error: "Bad Request",
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Unauthorized - valid authentication token required",
  })
  public async createCampaign(
    @Body(ValidationPipe) createCampaignDto: CreateCampaignDto,
    @Request() req: any,
  ): Promise<CampaignResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`Creating campaign for user: ${userId}`);

    // Create agentInvokeOptions
    const agentInvokeOptions = {
      userContext: createCampaignDto.userContext,
      modelConfig: createCampaignDto.modelConfig,
      taskExecutionConfig: createCampaignDto.taskExecutionConfig,
    } as AgentInvokeOptions;

    const input: CreateCampaignInput = {
      userId,
      name: createCampaignDto.name,
      userPrompt: createCampaignDto.userPrompt,
      description: createCampaignDto.description,
      agentInvokeOptions: agentInvokeOptions,
    };

    const campaign = await this.campaignService.createAndStartCampaign(input);
    return CampaignResponseDto.fromEntity(campaign);
  }

  // ==================== Campaign Retrieval ====================

  /**
   * List campaigns with filters
   * GET /api/v1/campaigns
   */
  @Get()
  @ApiOperation({ 
    summary: "List user campaigns with filters and pagination",
    description: `Retrieves a paginated list of user"s campaigns with optional filtering and sorting.
    
**Features:**
- Pagination (skip/take)
- Filter by status, name, description
- Sort by multiple fields
- Optionally include related data (tasks, user)

**Default Behavior:**
- Only shows authenticated user"s campaigns
- Sorted by createdAt descending
- 20 items per page

**Example Queries:**
- \`GET /campaigns?status=ACTIVE&take=10\` - Active campaigns, 10 per page
- \`GET /campaigns?nameContains=Market&sortBy=name&sortOrder=asc\` - Search by name, sorted alphabetically
- \`GET /campaigns?includeTasks=true\` - Include all tasks in response`,
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Campaigns retrieved successfully",
    type: CampaignListResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: "Unauthorized - valid authentication token required",
  })
  public async getCampaignsByUser(
    @Query(ValidationPipe) query: ListCampaignsQueryDto,
    @Request() req: any,
  ): Promise<CampaignListResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`Listing campaigns for user ${userId}`);

    // Build options form query dto
    const options = {
      skip: query.skip,
      take: query.take,
      where: {
        status: query.status,
        statusIn: query.statusIn,
        name: query.name,
        nameContains: query.nameContains,
        descriptionContains: query.descriptionContains,
        hasDescription: query.hasDescription,
        hasTasks: query.hasTasks,
        hasResult: query.hasResult,
      },
      orderBy: {
        field: query.sortBy || "createdAt",
        direction: query.sortOrder || "desc",
      },
      include: {
        user: query.includeUser,
        tasks: query.includeTasks,
      }
    } as ListCampaignsOptions;
    const result = await this.campaignService.getCampaignsByOptions(userId, options);

    return {
      data: CampaignResponseDto.fromEntities(result.data),
      pagination: result.pagination,
    };
  }

  /**
   * Get campaign by ID
   * GET /api/v1/campaigns/:id
   */
  @Get(":id")
  @ApiOperation({ 
    summary: "Get a campaign by ID",
    description: `Retrieves detailed information about a specific campaign.
    
**Access Control:**
- Users can only access their own campaigns
- Returns 403 if trying to access another user"s campaign

**Optional Query Parameters:**
- includeTasks: Include associated tasks in response
- includeUser: Include user information in response`,
  })
  @ApiParam({ 
    name: "id", 
    description: "Campaign unique identifier (UUID)",
    example: "clx123abc456",
    type: String,
  })
  @ApiQuery({ 
    name: "includeTasks", 
    required: false, 
    type: Boolean,
    description: "Include campaign tasks in response",
    example: true,
  })
  @ApiQuery({ 
    name: "includeUser", 
    required: false, 
    type: Boolean,
    description: "Include user information in response",
    example: false,
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Campaign found and returned successfully",
    type: CampaignResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "Campaign not found",
    schema: {
      example: {
        statusCode: 404,
        message: "Campaign not found",
        error: "Not Found",
      },
    },
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - not the campaign owner",
  })
  public async getCampaignById(
    @Param("id") campaignId: string,
    @Query("includeTasks") includeTasks?: boolean,
    @Query("includeUser") includeUser?: boolean,
    @Request() req?: any,
  ): Promise<CampaignResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`Getting campaign ${campaignId} for user ${userId}`);

    const campaign = await this.campaignService.getCampaignById(
      campaignId, 
      userId,
      { 
        includeTasks: includeTasks === true, 
        includeUser: includeUser === true,
      }
    );

    return CampaignResponseDto.fromEntity(campaign);
  }

  /**
   * Get tasks for a campaign
   * GET /api/v1/campaigns/:id/tasks
   */
  @Get(":id/tasks")
  @ApiOperation({ 
    summary: "List tasks for a specific campaign",
    description: `Retrieves a paginated list of tasks associated with a campaign.
    
**Access Control:**
- Users can only access tasks from their own campaigns
- Returns 403 if trying to access another user"s campaign

**Features:**
- Filter by task status (single or multiple)
- Pagination support
- Sorting by priority, status, or date

**Example Queries:**
- \`GET /campaigns/:id/tasks?status=COMPLETED\` - Only completed tasks
- \`GET /campaigns/:id/tasks?statusIn=COMPLETED,FAILED\` - Completed or failed tasks
- \`GET /campaigns/:id/tasks?sortBy=priority&sortOrder=asc\` - Sort by priority`,
  })
  @ApiParam({ 
    name: "id", 
    description: "Campaign unique identifier",
    example: "clx123abc456",
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Tasks retrieved successfully",
    type: TaskListResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "Campaign not found",
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Access denied - not the campaign owner",
  })
  public async getTasksByCampaign(
    @Param("id") campaignId: string,
    @Query(ValidationPipe) query: ListTasksQueryDto,
    @Request() req: any,
  ): Promise<TaskListResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`Getting tasks for campaign ${campaignId}`);

    const options = {
      skip: query.skip,
      take: query.take,
      where: {
        status: query.status,
        statusIn: query.statusIn,
      },
      orderBy: {
        field: query.sortBy || "createdAt",
        direction: query.sortOrder || "desc",
      },
    } as ListTasksByCampaignWithOptions;
    // Call service method
    const result = await this.campaignService.getTasksByCampaignWithOptions(
      campaignId,
      userId,
      options
    );

    return {
      data: TaskResponseDto.fromEntities(result.data),
      pagination: result.pagination,
    };
  }

  /**
   * List all tasks across campaigns
   * GET /api/v1/campaigns/tasks/all
   */
  @Get('tasks/all')
  @ApiOperation({ 
    summary: 'List all tasks across campaigns for current user',
    description: `Retrieves a paginated list of all tasks for the authenticated user across all campaigns.
    
**Use Cases:**
- Global task management dashboard
- Task analytics and reporting
- Cross-campaign task overview

**Features:**
- Filter by status (single or multiple)
- Filter by specific campaign(s)
- Pagination support
- Sorting options
- Includes campaign context for each task

**Security:**
- Only returns tasks from campaigns owned by the current user
- Campaign context is always included for reference

**Example Queries:**
- \`GET /campaigns/tasks/all?status=FAILED\` - All failed tasks
- \`GET /campaigns/tasks/all?statusIn=COMPLETED,FAILED\` - Completed or failed
- \`GET /campaigns/tasks/all?sortBy=priority\` - Sort by priority`,
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Tasks retrieved successfully',
    type: TaskListResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Unauthorized - valid authentication token required',
  })
  public async getTasksByUser(
    @Query(ValidationPipe) query: ListTasksQueryDto,
    @Request() req: any,
  ): Promise<TaskListResponseDto> {
    const userId = req.user?.id;
    this.logger.log(`Listing all tasks for user ${userId}`);

    const options: ListTasksOptions = {
      skip: query.skip,
      take: query.take,
      where: {
        status: query.status,
        statusIn: query.statusIn,
      },
      orderBy: {
        field: query.sortBy || 'createdAt',
        direction: query.sortOrder || 'desc',
      },
    } as ListTasksOptions;

    // Call service method
    const result = await this.campaignService.getTasksByUserWithOptions(userId, options);

    return {
      data: TaskResponseDto.fromEntities(result.data),
      pagination: result.pagination,
    };
  }

  // ==================== Campaign Management ====================

  /**
   * Archive a campaign
   * POST /api/v1/campaigns/:id/archive
   */
  @Post(":id/archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "Archive a campaign",
    description: `Soft deletes a campaign by marking it as archived.
    
**Actions:**
1. Updates campaign status to ARCHIVED
2. Removes campaign from queue if still pending
3. Retains all campaign data and tasks

**Notes:**
- Archived campaigns can be retried if they failed
- Does not delete any data (use DELETE for permanent deletion)`,
  })
  @ApiParam({ 
    name: "id", 
    description: "Campaign ID",
    example: "clx123abc456",
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Campaign archived successfully",
    type: CampaignResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "Campaign not found",
  })
  public async archiveCampaign(
    @Param("id") campaignId: string,
    @Request() req: any,
  ): Promise<CampaignResponseDto> {
    const userId = req.user?.id || "temp-user-id";
    this.logger.log(`Archiving campaign ${campaignId}`);

    const campaign = await this.campaignService.archiveCampaign(
      campaignId, 
      userId
    );

    return CampaignResponseDto.fromEntity(campaign);
  }

  /**
   * Retry a failed campaign
   * POST /api/v1/campaigns/:id/retry
   */
  @Post(":id/retry")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "Retry a failed campaign",
    description: `Re-queues a failed campaign for execution.
    
**Requirements:**
- Campaign status must be ARCHIVED
- Campaign result must be null (indicating failure)

**Actions:**
1. Updates status to ACTIVE
2. Re-adds job to queue
3. Attempts execution again

**Use Cases:**
- Network errors during execution
- Temporary service unavailability
- SerpAPI quota exhaustion (will use LLM fallback)`,
  })
  @ApiParam({ 
    name: "id", 
    description: "Campaign ID",
    example: "clx123abc456",
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Campaign queued for retry successfully",
    type: CampaignResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: "Campaign cannot be retried (not failed or already has results)",
    schema: {
      example: {
        statusCode: 403,
        message: "Only failed campaigns can be retried",
        error: "Forbidden",
      },
    },
  })
  public async retryCampaign(
    @Param("id") campaignId: string,
    @Request() req: any,
  ): Promise<CampaignResponseDto> {
    const userId = req.user?.id || "temp-user-id";
    this.logger.log(`Retrying campaign ${campaignId}`);

    const campaign = await this.campaignService.retryCampaign(
      campaignId, 
      userId
    );

    return CampaignResponseDto.fromEntity(campaign);
  }

  /**
   * Permanently delete a campaign
   * DELETE /api/v1/campaigns/:id
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: "Permanently delete a campaign",
    description: `Permanently deletes a campaign and all associated tasks.
    
**Warning:** This action cannot be undone!

**Actions:**
1. Deletes campaign record from database
2. Deletes all associated tasks
3. Removes from queue if still pending

**Best Practice:**
- Use POST /campaigns/:id/archive for soft deletion
- Only use DELETE when absolutely necessary`,
  })
  @ApiParam({ 
    name: "id", 
    description: "Campaign ID",
    example: "clx123abc456",
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: "Campaign deleted successfully",
    type: CampaignResponseDto,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: "Campaign not found",
  })
  public async deleteCampaign(
    @Param("id") campaignId: string,
    @Request() req: any,
  ): Promise<CampaignResponseDto> {
    const userId = req.user?.id || "temp-user-id";
    this.logger.log(`Deleting campaign ${campaignId}`);

    const campaign = await this.campaignService.deleteCampaign(
      campaignId, 
      userId
    );

    return CampaignResponseDto.fromEntity(campaign);
  }
}
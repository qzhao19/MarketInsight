import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { 
  Campaign, 
  CampaignStatus, 
  VALID_TRANSITIONS,
} from "../../types/database/entities.types";
import { 
  CampaignNotFoundException, 
  InvalidStatusTransitionException,
  UserNotFoundException 
} from "../../common/exceptions/database.exceptions";
import {
  CreateCampaignData,
  UpdateCampaignData,
  ListCampaignsOptions,
  PaginatedCampaignsResponse,
} from "../../types/database/campaign.types";
import { EntityMapper } from "../mappers/entity.mapper";


@Injectable()
export class CampaignRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new marketing campaign and optionally creates 
   * its sub-tasks in a single transaction.
   */
  public async createCampaign(data: CreateCampaignData): Promise<Campaign> {
    try {
      // Valid user exists
      const userExists = await this.prisma.user.findUnique({
        where: {id: data.userId},
        select: {id: true},
      });

      if (!userExists) {
        throw new UserNotFoundException(data.userId);
      }

      // Simple creation without tasks
      const newCampaign = await this.prisma.campaign.create({
        data: {
          userId: data.userId,
          name: data.name,
          description: data.description,
          status: data.status ?? CampaignStatus.DRAFT,
        },
      });

      // Map to domain model
      const domainCampaign = EntityMapper.mapPrismaCampaignToDomainCampaign(
        newCampaign as any
      );

      if (!domainCampaign) {
        throw new Error("Failed to map campaign to domain model");
      }

      return domainCampaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to create campaign for user ${data.userId}`
      );
    }
  }

  /**
   * Retrieves a single campaign's basic information by its ID.
   */
  public async findCampaignById(
    campaignId: string,
    includeTasks: boolean = false,
    includeUser: boolean = false
  ): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          tasks: includeTasks, 
          user: includeUser
        }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      // call the mapping function directly without any type casting
      return EntityMapper.mapPrismaCampaignToDomainCampaign(campaign) as Campaign;

    } catch (error) {
      throw this.prisma.handlePrismaError(
        error, 
        `Failed to get campaign with ID: ${campaignId}`
      );
    }
  }

  /**
   * Updates a campaign with the provided data.
   */
  public async updateCampaign(
    campaignId: string,
    data: UpdateCampaignData,
    includeTasks: boolean = false,
    includeUser: boolean = false
  ): Promise<Campaign> {
    try {
      // Verify campaign exists before attempting to update
      const campaignExists = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id:true, status: true },
      });

      if (!campaignExists) {
        throw new CampaignNotFoundException(campaignId);
      }

      // Only validate if the status is actually different and being updated
      const currentStatus = campaignExists.status as CampaignStatus;
      if (
        data.status !== undefined &&
        data.status !== currentStatus &&
        !VALID_TRANSITIONS[currentStatus]?.includes(data.status)
      ) {
        throw new InvalidStatusTransitionException(currentStatus, data.status);
      }

      // Prepare update data
      const updateData: Prisma.CampaignUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) {
        updateData.description = data.description === null 
        ? null
        : data.description;
      }
      if (data.status !== undefined) updateData.status = data.status;

      // Update campaign with optional relations
      const updatedCampaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: updateData,
        include: {
          tasks: includeTasks,
          user: includeUser,
        },
      });

      // Map to domain model
      const domainCampaign = EntityMapper.mapPrismaCampaignToDomainCampaign(
        updatedCampaign as any
      );

      if (!domainCampaign) {
        throw new Error("Failed to map campaign to domain model");
      }

      return domainCampaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(
        error,
        `Failed to update campaign with ID: ${campaignId}`
      );
    }
  }

  /**
   * Deletes a campaign with the provided campaignId
   */
  public async deleteCampaign(campaignId: string): Promise<Campaign> {
    try {
      // Check if campaign exists
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { id: true }
      });

      if (!campaign) {
        throw new CampaignNotFoundException(campaignId);
      }

      const deletedCampaign = await this.prisma.campaign.delete({
        where: { id: campaignId }
      });

      const domainCampaign = EntityMapper.mapPrismaCampaignToDomainCampaign(
        deletedCampaign as any
      );
      if (!domainCampaign) {
        throw new Error("Failed to map campaign to domain model");
      }
      return domainCampaign;
    } catch (error) {
      throw this.prisma.handlePrismaError(error, `Failed to delete campaign: ${campaignId}`);
    }    
  }


};


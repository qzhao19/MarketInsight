import { CampaignStatus } from "../../types/database/entities.types";

// Custom exceptions
export class UserNotFoundException extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = "UserNotFoundException";
  }
}

export class UserAlreadyExistsException extends Error {
  constructor(
    message: string,
    public readonly field?: "email" | "username"
  ) {
    super(message);
    this.name = "UserAlreadyExistsException";
  }
}

export class TaskNotFoundException extends Error {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`);
    this.name = "TaskNotFoundException";
  }
}

export class CampaignNotFoundException extends Error {
  constructor(campaignId: string) {
    super(`Marketing campaign with ID ${campaignId} not found`);
    this.name = "CampaignNotFoundException";
  }
}

export class InvalidStatusTransitionException extends Error {
  constructor(
    from: CampaignStatus,
    to: CampaignStatus,
    message: string = `Invalid status transition from ${from} to ${to}`
  ) {
    super(message);
    this.name = "InvalidStatusTransitionException";
  }
}
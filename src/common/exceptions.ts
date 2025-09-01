// define exception 

// Custom exceptions
export class UserNotFoundException extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
    this.name = 'UserNotFoundException';
  }
}

export class UserAlreadyExistsException extends Error {
  constructor(email: string) {
    super(`User with email ${email} already exists`);
    this.name = 'UserAlreadyExistsException';
  }
}

export class TaskNotFoundException extends Error {
  constructor(taskId: string) {
    super(`Task with ID ${taskId} not found`);
    this.name = 'TaskNotFoundException';
  }
}

export class CampaignNotFoundException extends Error {
  constructor(campaignId: string) {
    super(`Marketing campaign with ID ${campaignId} not found`);
    this.name = 'CampaignNotFoundException';
  }
}


import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { TokenPayload } from "../../modules/user/types/user.types";

/**
 * Custom parameter decorator to extract the current authenticated user from the request
 * 
 * This decorator works in conjunction with AuthGuard, which validates the JWT token
 * and attaches the decoded token payload to request.user
 * 
 * @returns The current user"s token payload (userId, email, username)
 * 
 * @example
 * // Usage in a controller
 * @Get("profile")
 * @UseGuards(AuthGuard)
 * async getProfile(@CurrentUser() user: TokenPayload) {
 *   console.log(user.userId);    // UUID of the user
 *   console.log(user.email);     // User"s email
 *   console.log(user.username);  // User"s username
 *   return user;
 * }
 * 
 * @example
 * // Extract only specific fields
 * @Get("id")
 * @UseGuards(AuthGuard)
 * async getUserId(@CurrentUser("userId") userId: string) {
 *   return { userId };
 * }
 */
export const CurrentUser = createParamDecorator(
  <K extends keyof TokenPayload>(
    data: K | undefined,
    ctx: ExecutionContext,
  ): TokenPayload | TokenPayload[K] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as TokenPayload;

    // If no specific field is requested, return the entire user object
    if (!data) {
      return user;
    }

    // Return the specific field if requested
    return user[data];
  },
);
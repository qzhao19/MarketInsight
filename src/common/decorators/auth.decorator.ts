import { SetMetadata } from "@nestjs/common";
import { CustomDecorator } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Allows unauthenticated (anonymous) access to a route or controller.
 * When applied, the AuthGuard will not perform authentication checks.
 * 
 * @example
 * ```typescript
 * @Get("public")
 * @Public()
 * getPublicData() {
 *   return { message: "This is public" };
 * }
 * ```
 */
export const Public = (): CustomDecorator<string> => 
  SetMetadata(IS_PUBLIC_KEY, true);



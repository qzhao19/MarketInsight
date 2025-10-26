import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserService } from '../../services/user/user.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/auth.decorator';


@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly userService: UserService,
    private readonly reflector: Reflector, // Inject Reflector
  ) {}

  private extractTokenFromHeader(request: any): string | null {
    const authHeader = request.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    return token;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check router is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // Method level decorators
      context.getClass(),   // Class level decorators
    ]);

    // Skip authentication
    if (isPublic) {
      this.logger.log('Public route accessed, skipping authentication');
      return true;
    }

    // Protected route, do token check
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authorization token missing');
    }

    try {
      // Validate token
      const payload = await this.userService.validateToken(token);

      // Inject user info into request
      request.user = payload;

      this.logger.log(`User ${payload.username} authenticated successfully`);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Authentication failed: ${errorMsg}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
import { User as PrismaUser } from "@prisma/client";
import { SafeUser } from "../../../common/types/database/entity.types"

export class UserMapper {
  /**
   * Removes password field from user object.
   */
  static excludePasswordFromUser(user: PrismaUser): SafeUser {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword as unknown as SafeUser;
  }

   /**
   * Batch mapping for multiple users.
   */
  static excludePasswordFromUsers(users: PrismaUser[]): SafeUser[] {
    return users.map(user => UserMapper.excludePasswordFromUser(user));
  }
}

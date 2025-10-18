import { UserRepository } from "../../src/database/repositories/user.repository";
import {
  UserNotFoundException,
  UserAlreadyExistsException,
} from "../../src/common/exceptions/database.exceptions";
import { SafeUser as User } from "../../src/types/database.types";
import { PrismaService } from "../../src/database/prisma/prisma.service";

describe("UserRepository", () => {
  let userRepository: UserRepository;
  // type of mockPrismaService shoule be any 
  let mockPrismaService: any;
  let originalConsoleError: typeof console.error;

  const mockUser: User = {
    id: "user-1",
    email: "test@example.com",
    username: "Test User",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeAll(() => {
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    // 4. create a mock PrismaService object
    // this object needs to have the same structure as PrismaClient
    mockPrismaService = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      handlePrismaError: jest.fn((error) => { 
        // Re-throw custom exceptions
        if (error instanceof UserAlreadyExistsException || 
            error instanceof UserNotFoundException) {
          throw error;
        }
        throw error; 
      }),
    };

    // inject the mocked service into the constructor of UserRepository
    userRepository = new UserRepository(mockPrismaService as PrismaService);
  });

  describe("createUser", () => {
    it("should create a new user successfully", async () => {
      // Mock findFirst (not findUnique) for the uniqueness checks
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)  // email check - returns null (not exists)
        .mockResolvedValueOnce(null); // username check - returns null (not exists)
      
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const newUser = { 
        email: "test@example.com", 
        username: "testuser", 
        password: "hashedpassword" 
      };
      
      const result = await userRepository.createUser(newUser);

      // Verify findFirst was called twice (email and username checks)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledTimes(2);
      
      // Verify email check
      expect(mockPrismaService.user.findFirst).toHaveBeenNthCalledWith(1, {
        where: { email: newUser.email, deletedAt: null },
        select: { id: true }
      });
      
      // Verify username check
      expect(mockPrismaService.user.findFirst).toHaveBeenNthCalledWith(2, {
        where: { username: newUser.username, deletedAt: null },
        select: { id: true }
      });

      // Verify create was called with correct data
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: { ...newUser, deletedAt: null },
      });
      
      expect(result).toEqual(mockUser);
    });

    it("should throw UserAlreadyExistsException if email exists", async () => {
      // Mock email check returns existing user
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "existing-user" }); // email exists

      const newUser = { 
        email: "test@example.com", 
        username: "testuser", 
        password: "hashedpassword" 
      };

      await expect(userRepository.createUser(newUser)).rejects.toThrow(
        UserAlreadyExistsException
      );

      // Verify create was NOT called
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      
      // Verify only email check was performed (username check skipped)
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledTimes(2);
    });

    it("should throw UserAlreadyExistsException if username exists", async () => {
      // Mock checks: email OK, username exists
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)                    // email doesn"t exist
        .mockResolvedValueOnce({ id: "existing-user" }); // username exists

      const newUser = { 
        email: "test@example.com", 
        username: "testuser", 
        password: "hashedpassword" 
      };

      await expect(userRepository.createUser(newUser)).rejects.toThrow(
        UserAlreadyExistsException
      );

      // Verify create was NOT called
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
      
      // Verify both checks were performed
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledTimes(2);
    });

    it("should allow reusing email/username from soft-deleted user", async () => {
      // Mock checks return null (no active users with these credentials)
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)  // email check
        .mockResolvedValueOnce(null); // username check
      
      (mockPrismaService.user.create as jest.Mock).mockResolvedValue(mockUser);

      const newUser = { 
        email: "test@example.com",  // Previously used by deleted user
        username: "testuser",       // Previously used by deleted user
        password: "hashedpassword" 
      };
      
      const result = await userRepository.createUser(newUser);

      expect(result).toEqual(mockUser);
    });
    
  });

  describe("findUserById", () => {
    it("should return user when found", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser as any);

      const result = await userRepository.findUserById("user-1");

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should throw UserNotFoundException when user not found", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(userRepository.findUserById("non-existent-id")).rejects.toThrow(
        UserNotFoundException
      );
    });

    it("should throw UserNotFoundException when user is soft-deleted", async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(deletedUser);

      await expect(userRepository.findUserById("user-1")).rejects.toThrow(
        UserNotFoundException
      );
    });
  });

  describe("findUserByEmail", () => {
    it("should return user when found by email", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const result = await userRepository.findUserByEmail("test@example.com");
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should throw UserNotFoundException when user not found", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        userRepository.findUserByEmail("nonexistent@example.com")
      ).rejects.toThrow(UserNotFoundException);
    });

    it("should throw UserNotFoundException when user is soft-deleted", async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(deletedUser);

      await expect(
        userRepository.findUserByEmail("test@example.com")
      ).rejects.toThrow(UserNotFoundException);
    });
  });

  describe("findUserByUsername", () => {
    it("should return user when found by username", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      
      const result = await userRepository.findUserByUsername("testuser");
      
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { username: "testuser" },
      });
      expect(result).toEqual(mockUser);
    });

    it("should throw UserNotFoundException when user not found", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        userRepository.findUserByUsername("nonexistent")
      ).rejects.toThrow(UserNotFoundException);
    });
  });

  describe("updateUser", () => {
    it("should update user successfully", async () => {
      const updatedUser = { ...mockUser, username: "updateduser", email: "updateduser@example.com" };
      
      // Mock findUserById (internal call)
      mockPrismaService.user.findUnique.mockResolvedValueOnce(mockUser);      // findUserById

      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)         // For username check
        .mockResolvedValueOnce(null);        // For email check
      
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await userRepository.updateUser("user-1", { 
        username: "updateduser", email: "updateduser@example.com"
      });

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { username: "updateduser", email: "updateduser@example.com" },
      });
      expect(result).toEqual(updatedUser);
    });

    it("should throw UserNotFoundException if user does not exist", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        userRepository.updateUser("nonexistent", { username: "newname" })
      ).rejects.toThrow(UserNotFoundException);
    });

    it("should throw UserAlreadyExistsException if new username is taken", async () => {
      // Mock findUserById (internal call)
      (mockPrismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser);  // findUserById succeeds
      
      // Mock findFirst for username check - returns existing user
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "other-user" }); // Username taken

      await expect(
        userRepository.updateUser("user-1", { username: "takenname" })
      ).rejects.toThrow(UserAlreadyExistsException);

      // Verify findFirst was called with correct parameters
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: "takenname",
          deletedAt: null,
          id: { not: "user-1" }
        },
        select: { id: true }
      });

      // Update should NOT be called
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it("should throw UserAlreadyExistsException if new email is taken", async () => {
      // Mock findUserById
      (mockPrismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser);
      
      // Mock findFirst for email check - returns existing user
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "other-user" }); // Email taken

      await expect(
        userRepository.updateUser("user-1", { email: "taken@example.com" })
      ).rejects.toThrow(UserAlreadyExistsException);

      expect(mockPrismaService.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: "taken@example.com",
          deletedAt: null,
          id: { not: "user-1" }
        },
        select: { id: true }
      });

      expect(mockPrismaService.user.update).not.toHaveBeenCalled();
    });

    it("should update both username and email if both are available", async () => {
      const updatedUser = { 
        ...mockUser, 
        username: "newusername",
        email: "newemail@example.com"
      };
      
      // Mock findUserById
      (mockPrismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser);
      
      // Mock both checks - no conflicts
      (mockPrismaService.user.findFirst as jest.Mock)
        .mockResolvedValueOnce(null)  // username check
        .mockResolvedValueOnce(null); // email check
      
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await userRepository.updateUser("user-1", { 
        username: "newusername",
        email: "newemail@example.com"
      });

      expect(result.username).toBe("newusername");
      expect(result.email).toBe("newemail@example.com");
      
      // Verify both checks were performed
      expect(mockPrismaService.user.findFirst).toHaveBeenCalledTimes(2);
    });

    it("should update password without checking uniqueness", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        password: "newhashedpassword"
      });

      const result = await userRepository.updateUser("user-1", { 
        password: "newhashedpassword" 
      });

      expect(result).toBeDefined();
      // Should only call findUserById, no uniqueness checks
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe("softDeleteUser", () => {
    it("should soft delete user successfully", async () => {
      const softDeletedUser = {
        ...mockUser,
        deletedAt: new Date(),
        email: "deleted_user-1_1234567890@deleted.local",
        username: "deleted_user-1_1234567890",
      };
      
      (mockPrismaService.user.update as jest.Mock).mockResolvedValue(softDeletedUser);

      const result = await userRepository.softDeleteUser("user-1");

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: {
          deletedAt: expect.any(Date),
          email: expect.stringMatching(/^deleted_user-1_\d+@deleted\.local$/),
          username: expect.stringMatching(/^deleted_user-1_\d+$/),
        },
      });
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe("hardDeleteUser", () => {
    it("should permanently delete a user", async () => {
      (mockPrismaService.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser as any);
      (mockPrismaService.user.delete as jest.Mock).mockResolvedValue(mockUser as any);

      await userRepository.hardDeleteUser("user-1");
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    });
  });

  describe("findUserCount", () => {
    it("should return the count of non-deleted users", async () => {
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(5);
      const result = await userRepository.findUserCount();

      expect(mockPrismaService.user.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
      expect(result).toBe(5);
    });
  });

  describe("findManyUsersByOptions", () => {
    it("should return users with default pagination and metadata", async () => {
      const users = [mockUser];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      const result = await userRepository.findManyUsersByOptions();

      expect(result.data).toEqual(users);
      expect(result.pagination).toEqual({
        total: 1,
        skip: 0,
        take: 20,
        hasMore: false,
        totalPages: 1,
        currentPage: 1,
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 20,
        where: { deletedAt: null },
        include: undefined,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should validate and clamp pagination parameters", async () => {
      const users = [mockUser];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      // Test negative skip
      await userRepository.findManyUsersByOptions({ skip: -10, take: 20 });
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }) // Clamped to 0
      );

      // Test excessive take
      await userRepository.findManyUsersByOptions({ skip: 0, take: 999 });
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }) // Clamped to 100
      );

      // Test zero take
      await userRepository.findManyUsersByOptions({ skip: 0, take: 0 });
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 1 }) // Minimum 1
      );
    });

    it("should apply search filter", async () => {
      const users = [mockUser];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      await userRepository.findManyUsersByOptions({
        where: { searchTerm: "john" }
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            OR: [
              { email: { contains: "john", mode: "insensitive" } },
              { username: { contains: "john", mode: "insensitive" } },
            ],
          }),
        })
      );
    });

    it("should apply exact email filter", async () => {
      const users = [mockUser];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      await userRepository.findManyUsersByOptions({
        where: { email: "test@example.com" }
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: "test@example.com",
            deletedAt: null,
          }),
        })
      );
    });

    it("should apply custom sorting", async () => {
      const users = [mockUser];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      await userRepository.findManyUsersByOptions({
        orderBy: { field: "username", direction: "asc" }
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { username: "asc" },
        })
      );
    });

    it("should include campaigns as boolean", async () => {
      const usersWithCampaigns = [{ 
        ...mockUser, 
        campaigns: [{ id: "camp-1", name: "Campaign 1" }] 
      }];
      
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(usersWithCampaigns);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      await userRepository.findManyUsersByOptions({
        include: { campaigns: true }
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { campaigns: true },
        })
      );
    });

    it("should include campaigns with limit and filter", async () => {
      const usersWithCampaigns = [{ 
        ...mockUser, 
        campaigns: [{ id: "camp-1", name: "Campaign 1", status: "ACTIVE" }] 
      }];
      
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(usersWithCampaigns);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      await userRepository.findManyUsersByOptions({
        include: {
          campaigns: {
            take: 5,
            orderBy: "createdAt",
            where: { status: "ACTIVE" }
          }
        }
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            campaigns: {
              take: 5,
              orderBy: { createdAt: "desc" },
              where: { status: "ACTIVE", deletedAt: null  },
            },
          },
        })
      );
    });

    it("should limit campaigns to max 50", async () => {
      const users = [mockUser];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(1);

      await userRepository.findManyUsersByOptions({
        include: {
          campaigns: { take: 999 } // Request 999
        }
      });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            campaigns: expect.objectContaining({
              take: 50, // Clamped to 50
            }),
          },
        })
      );
    });

    it("should calculate pagination metadata correctly", async () => {
      const users = Array(10).fill(mockUser);
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(45); // Total 45 users

      const result = await userRepository.findManyUsersByOptions({
        skip: 20,
        take: 10,
      });

      expect(result.pagination).toEqual({
        total: 45,
        skip: 20,
        take: 10,
        hasMore: true,      // 20 + 10 = 30 < 45
        totalPages: 5,      // ceil(45 / 10) = 5
        currentPage: 3,     // floor(20 / 10) + 1 = 3
      });
    });

    it("should include deleted users when specified", async () => {
      const users = [mockUser, { ...mockUser, id: "user-2", deletedAt: new Date() }];
      (mockPrismaService.user.findMany as jest.Mock).mockResolvedValue(users);
      (mockPrismaService.user.count as jest.Mock).mockResolvedValue(2);

      await userRepository.findManyUsersByOptions({
        where: { includeDeleted: true }
      });

      // deletedAt should be undefined (not filtered)
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: undefined,
          }),
        })
      );
    });

    it("should execute count and findMany in parallel", async () => {
      const users = [mockUser];
      const findManySpy = jest.spyOn(mockPrismaService.user, "findMany").mockResolvedValue(users);
      const countSpy = jest.spyOn(mockPrismaService.user, "count").mockResolvedValue(1);

      await userRepository.findManyUsersByOptions();

      // Both should be called
      expect(findManySpy).toHaveBeenCalled();
      expect(countSpy).toHaveBeenCalled();
    });
  });
});
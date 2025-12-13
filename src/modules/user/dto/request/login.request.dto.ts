import { 
  IsString, 
  IsNotEmpty, 
  MinLength, 
  MaxLength, 
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Data Transfer Object for user login requests
 */
export class LoginRequestDto {
  @ApiProperty({
    description: "Email address or username",
    example: "john.doe@example.com",
    minLength: 3,
    maxLength: 100,
  })
  @IsString({ message: "Username or email must be a string" })
  @IsNotEmpty({ message: "Username or email cannot be empty" })
  @MinLength(3, { message: "Username or email must be at least 3 characters" })
  @MaxLength(100, { message: "Username or email must be no more than 100 characters" })
  @Matches(
    /^([a-zA-Z0-9_.-]{3,30}|[^\s@]+@[^\s@]+\.[^\s@]+)$/,
    { 
      message: "Please enter a valid email address or username (3-30 characters, letters, numbers, _, ., - allowed)" 
    }
  )
  emailOrUsername: string;

  @ApiProperty({
    description: "User password",
    example: "SecurePass123!",
    minLength: 8,
    maxLength: 128,
    format: "password",
  })
  @IsString({ message: "Password must be a string" })
  @IsNotEmpty({ message: "Password cannot be empty" })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(128, { message: "Password must be no more than 128 characters" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-[\]{}|;:'",.<>/\\`~])[A-Za-z\d@$!%*?&#^()_+=\-[\]{}|;:'",.<>/\\`~]{8,}$/,
    { 
      message: "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character"
    }
  )
  password: string;
}
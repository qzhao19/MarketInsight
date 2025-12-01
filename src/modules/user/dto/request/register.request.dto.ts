import { 
  IsString, 
  IsEmail, 
  IsNotEmpty, 
  MinLength, 
  MaxLength, 
  Matches,
} from "class-validator";

/**
 * Data Transfer Object for user registration requests
 */
export class RegisterRequestDto {
  @IsString({ message: "Username must be a string" })
  @IsNotEmpty({ message: "Username cannot be empty" })
  @MinLength(3, { message: "Username must be at least 3 characters" })
  @MaxLength(20, { message: "Username cannot exceed 20 characters" })
  @Matches(
    /^[a-zA-Z][a-zA-Z0-9_]*$/, 
    { 
      message: "Username must start with a letter and can only contain letters, numbers, and underscores" 
    }
  )
  username: string;

  @IsEmail({}, { message: "Please enter a valid email address" })
  @IsNotEmpty({ message: "Email cannot be empty" })
  @MaxLength(100, { message: "Email address cannot exceed 100 characters" })
  email: string;

  @IsString({ message: "Password must be a string" })
  @IsNotEmpty({ message: "Password cannot be empty" })
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @MaxLength(100, { message: "Password cannot exceed 100 characters" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+=\-[\]{}|;:'",.<>/\\`~])[A-Za-z\d@$!%*?&#^()_+=\-[\]{}|;:'",.<>/\\`~]{8,}$/,
    {
      message: "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 digit, and 1 special character",
    }
  )
  password: string;
}
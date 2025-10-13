import { 
  IsString, 
  IsNotEmpty, 
  MinLength, 
  MaxLength, 
  Matches,
} from 'class-validator';

/**
 * Data Transfer Object for user login requests.
 */
export class LoginDto {
  @IsString({ message: 'Username or email must be a string' })
  @IsNotEmpty({ message: 'Username or email cannot be empty' })
  @MinLength(3, { message: 'Username or email must be at least 3 characters' })
  @MaxLength(100, { message: 'Username or email must be no more than 100 characters' })
  @Matches(
    /^([a-zA-Z0-9_.-]{3,30}|[^\s@]+@[^\s@]+\.[^\s@]+)$/,
    { 
      message: 'Please enter a valid email address or username (3-30 characters, letters, numbers, _, ., - allowed)' 
    }
  )
  emailOrUsername: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password cannot be empty' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must be no more than 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d@$!%*?&#^()_+=\-[\]{}|;:'",.<>/\\`~]{8,}$/,
    { 
      message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
    }
  )
  password: string;
}
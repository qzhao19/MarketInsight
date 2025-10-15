/**
 * Token data structure
 */
export interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // in seconds
}
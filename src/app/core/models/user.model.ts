export type UserRole = 'User' | 'Admin';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResult {
  accessToken: string;
  user: User;
  mustChangePassword?: boolean;
}

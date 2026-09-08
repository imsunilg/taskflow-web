import { UserRole } from '../../core/models/user.model';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  deactivatedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
}

export interface AdminUserSummary {
  totalUsers: number;
  activeUsers: number;
  deactivatedUsers: number;
  newUsersLast7Days: number;
}

export type AdminStatusFilter = 'all' | 'active' | 'deactivated';
export type AdminUserSort = 'createdAt' | 'displayName' | 'email' | 'role' | 'lastLoginAt' | 'status';

export interface AdminUserQuery {
  search?: string;
  status?: AdminStatusFilter;
  sort?: AdminUserSort;
  desc?: boolean;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
}

export interface CreateUserPayload {
  displayName: string;
  email: string;
  role: UserRole;
  password: string;
  confirmPassword: string;
  isActive: boolean;
}

export interface UpdateUserPayload {
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface ResetPasswordPayload {
  newPassword: string;
  confirmPassword: string;
}

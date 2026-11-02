import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: UserRole;
}

export interface UserMembershipInfo {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    organizationId: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    memberships?: UserMembershipInfo[];
  };
}

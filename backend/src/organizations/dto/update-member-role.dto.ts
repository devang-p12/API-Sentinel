import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role: UserRole;
}

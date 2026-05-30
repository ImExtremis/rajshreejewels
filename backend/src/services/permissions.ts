import prisma from './db';
import {
  ALL_PERMISSIONS,
  OWNER_ONLY_PERMISSIONS,
  Permission,
  PermissionSet,
  emptyPermissions,
  fullPermissions
} from '../types/permissions';

// Resolves effective permissions for a user
// Order: Owner hardcoded > User overrides > Role union > defaults
export async function resolvePermissions(userId: string): Promise<PermissionSet> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      adminUser: true,
      userRoles: { include: { role: true } }
    }
  });

  if (!user) throw new Error('USER_NOT_FOUND');

  // Owner gets everything always
  if (user.isOwner) return fullPermissions();

  // Start with empty
  let effective = emptyPermissions();

  // Union all role permissions
  for (const userRole of user.userRoles) {
    const rolePerms = userRole.role.permissions as any as PermissionSet;
    if (rolePerms) {
      for (const perm of Object.values(ALL_PERMISSIONS)) {
        if (rolePerms[perm] === true) effective[perm] = true;
      }
    }
  }

  // Apply user-level overrides (can grant OR revoke)
  if (user.adminUser?.permissionOverrides) {
    const overrides = user.adminUser.permissionOverrides as any as Partial<PermissionSet>;
    for (const [perm, value] of Object.entries(overrides)) {
      if (perm in effective) {
        effective[perm as Permission] = value as boolean;
      }
    }
  }

  // Strip owner-only perms regardless
  for (const perm of OWNER_ONLY_PERMISSIONS) {
    effective[perm] = false;
  }

  return effective;
}

export async function hasPermission(userId: string, permission: Permission): Promise<boolean> {
  const perms = await resolvePermissions(userId);
  return perms[permission] === true;
}

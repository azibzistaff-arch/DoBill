import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { DataService } from './dataService';
import { safeSessionStorage, safeLocalStorage } from '@/utils/safeStorage';

const sessionStorage = safeSessionStorage;
const localStorage = safeLocalStorage;

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete';
// Subject strings mapping to features
export type Subjects = 'all' | 'ShopDetails' | 'Products' | 'Sales' | 'Reports' | 'AccessSharing' | 'UPISettings';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

export function defineAbilityFor(role: 'Admin' | 'Manager' | 'Cashier'): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Uniform security: Everyone gets full access to manage all elements of the software
  can('manage', 'all');

  return build();
}

/**
 * Returns the dynamically matches role of the logged in user
 */
export async function getCurrentUserRole(): Promise<'Admin' | 'Manager' | 'Cashier'> {
  const override = sessionStorage.getItem('retailpro_role_override');
  if (override === 'Admin' || override === 'Manager' || override === 'Cashier') {
    return override;
  }

  const email = sessionStorage.getItem('retailpro_auth_email') || localStorage.getItem('retailpro_auth_email');
  if (!email) {
    return 'Cashier'; // Generic 'casher' login
  }

  const normalized = email.trim().toLowerCase();
  
  // Dynamic Owner Check: Owner fetched from user profile config is always Admin
  try {
    const profile = await DataService.getUserProfile();
    const ownerEmail = (profile.email || '').trim().toLowerCase();
    if (ownerEmail && normalized === ownerEmail) {
      return 'Admin';
    }
  } catch (err) {
    console.error("Error reading owner profile inside ability check:", err);
  }

  try {
    const rolesMap = await DataService.getEmailRoles();
    const assignedRole = rolesMap[normalized];
    if (assignedRole === 'Admin' || assignedRole === 'Manager' || assignedRole === 'Cashier') {
      return assignedRole;
    }
  } catch (err) {
    console.error("Error reading role mappings:", err);
  }

  // Fallback to Manager if shared but not specifically assigned, or Cashier
  return 'Manager'; 
}

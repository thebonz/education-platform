/**
 * Ma trận phân quyền. Thay đổi ở đây phải qua review vì nó quyết định ai được làm gì.
 *
 * Ánh xạ với vai trò trong yêu cầu:
 *   Guest          = chưa đăng nhập (không có bản ghi)
 *   Free Member    = vai trò member, không có entitlement trả phí
 *   Premium Member = member + entitlement còn hiệu lực (giai đoạn 6)
 *   Teacher, School Admin, Super Admin = vai trò cùng tên
 */
export const PERMISSIONS = [
  'account.self',
  'admin.access',
  'stats.read',
  'users.read',
  'users.lock',
  'users.sessions.revoke',
  'roles.assign',
  'products.read',
  'products.update',
  'games.read_all',
  'games.play_premium_preview',
  'audit.read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = {
  member: { name: 'Thành viên', permissions: ['account.self'] },
  teacher: { name: 'Giáo viên', permissions: ['account.self'] },
  school_admin: { name: 'Quản trị trường', permissions: ['account.self'] },
  support: {
    name: 'Hỗ trợ khách hàng',
    permissions: ['account.self', 'admin.access', 'stats.read', 'users.read', 'users.lock', 'users.sessions.revoke'],
  },
  content_editor: {
    name: 'Biên tập nội dung',
    permissions: ['account.self', 'admin.access', 'games.read_all', 'games.play_premium_preview'],
  },
  content_reviewer: {
    name: 'Duyệt nội dung',
    permissions: ['account.self', 'admin.access', 'games.read_all', 'games.play_premium_preview'],
  },
  product_manager: {
    name: 'Quản lý sản phẩm',
    permissions: ['account.self', 'admin.access', 'stats.read', 'products.read', 'products.update', 'games.read_all', 'games.play_premium_preview'],
  },
  accountant: { name: 'Kế toán', permissions: ['account.self', 'admin.access', 'stats.read'] },
  super_admin: { name: 'Super Admin', permissions: [...PERMISSIONS] },
} satisfies Record<string, { name: string; permissions: readonly Permission[] }>;

export type RoleKey = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as RoleKey[];
export const DEFAULT_ROLE: RoleKey = 'member';

export function isRoleKey(value: string): value is RoleKey {
  return Object.prototype.hasOwnProperty.call(ROLES, value);
}

export function permissionsFor(roleKeys: readonly string[]): Permission[] {
  const set = new Set<Permission>();
  for (const key of roleKeys) {
    if (!isRoleKey(key)) continue;
    for (const p of ROLES[key].permissions) set.add(p);
  }
  return [...set].sort();
}

import type { Request } from 'express';
import type { Permission } from '../rbac/permissions';

export type AuthContext = {
  userId: string;
  sessionId: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  roles: string[];
  permissions: Permission[];
};

export type AppRequest = Request & { auth?: AuthContext | null };

export function clientInfo(req: Request) {
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, 300) : null,
  };
}

import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Permission } from '../rbac/permissions';
import type { AppRequest, AuthContext } from './request';

export const REQUIRE_AUTH = 'hc:require-auth';
export const REQUIRE_PERMISSIONS = 'hc:require-permissions';
export const SKIP_ORIGIN_CHECK = 'hc:skip-origin-check';

/** Bắt buộc đăng nhập. */
export const RequireAuth = () => SetMetadata(REQUIRE_AUTH, true);

/** Bắt buộc đăng nhập và có TẤT CẢ quyền liệt kê. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(REQUIRE_PERMISSIONS, permissions);

/** Chỉ dùng cho endpoint server-to-server có xác thực chữ ký riêng (webhook thanh toán). */
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext | null => {
  return ctx.switchToHttp().getRequest<AppRequest>().auth ?? null;
});

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountController } from './account/account.controller';
import { AdminSystemController } from './admin/admin-system.controller';
import { AdminUsersController } from './admin/admin-users.controller';
import { AuditModule } from './audit/audit.service';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { AccessService } from './catalog/access.service';
import { CatalogController } from './catalog/catalog.controller';
import { OriginGuard } from './common/origin.guard';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    // Giới hạn chung: 300 request/phút/IP. Endpoint đăng nhập có giới hạn riêng chặt hơn.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
  ],
  controllers: [CatalogController, AccountController, AdminUsersController, AdminSystemController],
  providers: [
    AccessService,
    // Thứ tự quan trọng: chặn origin lạ → giới hạn tần suất → xác thực/phân quyền.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}

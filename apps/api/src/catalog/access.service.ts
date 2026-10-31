import { Injectable } from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
import type { AuthContext } from '../common/request';

export type AccessDecision =
  | { allowed: true; reason: 'free' | 'staff_preview' }
  | { allowed: false; reason: 'login_required' | 'membership_required' };

/**
 * Điểm quyết định DUY NHẤT việc được chơi game hay không.
 * Giai đoạn 2: game FREE mở cho mọi người; game PREMIUM chỉ nhân sự nội dung xem trước.
 * Giai đoạn 6 bổ sung kiểm tra entitlement (membership đã thanh toán) tại đây.
 */
@Injectable()
export class AccessService {
  canPlay(auth: AuthContext | null, game: { accessLevel: AccessLevel }): AccessDecision {
    if (game.accessLevel === AccessLevel.FREE) return { allowed: true, reason: 'free' };
    if (!auth) return { allowed: false, reason: 'login_required' };
    if (auth.permissions.includes('games.play_premium_preview')) return { allowed: true, reason: 'staff_preview' };
    return { allowed: false, reason: 'membership_required' };
  }
}

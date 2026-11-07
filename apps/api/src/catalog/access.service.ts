import { Injectable } from '@nestjs/common';
import { AccessLevel } from '@prisma/client';
import type { AuthContext } from '../common/request';

export type AccessDecision =
  | { allowed: true; reason: 'free' | 'staff_preview' | 'membership' }
  | { allowed: false; reason: 'login_required' | 'membership_required' };

/**
 * Điểm quyết định DUY NHẤT việc được chơi game hay không.
 * - FREE: mọi người.
 * - PREMIUM: người có gói còn hạn của ĐÚNG sản phẩm đó (gói English không mở game Tiếng Việt),
 *   hoặc nhân sự nội dung xem trước.
 */
@Injectable()
export class AccessService {
  canPlay(auth: AuthContext | null, game: { accessLevel: AccessLevel; productId: string }): AccessDecision {
    if (game.accessLevel === AccessLevel.FREE) return { allowed: true, reason: 'free' };
    if (!auth) return { allowed: false, reason: 'login_required' };
    if (auth.premiumProductIds.includes(game.productId)) return { allowed: true, reason: 'membership' };
    if (auth.permissions.includes('games.play_premium_preview')) return { allowed: true, reason: 'staff_preview' };
    return { allowed: false, reason: 'membership_required' };
  }
}

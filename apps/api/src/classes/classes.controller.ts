import { randomInt } from 'node:crypto';
import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { validateGameData } from '@happyclass/game-core';
import { AccessLevel, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

/** Giới hạn để một tài khoản không tạo dữ liệu vô hạn. */
export const LIMITS = { classes: 20, studentsPerClass: 60, gamesPerClass: 50 };
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const newJoinCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
const joinCode = z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().regex(/^[2-9A-HJKMNP-Z]{6}$/));
const avatar = z.string().min(1).max(16).regex(/^\p{Extended_Pictographic}[\p{Extended_Pictographic}‍️\p{M}]*$/u, 'Biểu tượng phải là emoji');

const createClass = z.object({ product: z.enum(['english', 'vietnamese']), name: text(1, 60), gradeLabel: text(1, 30).optional() }).strict();
const patchClass = z.object({ name: text(1, 60).optional(), gradeLabel: text(1, 30).nullable().optional(), isArchived: z.boolean().optional() }).strict();
const addStudents = z.object({
  students: z.array(z.object({ nickname: text(1, 30), avatar: avatar.optional() })).min(1).max(LIMITS.studentsPerClass),
}).strict();
const patchStudent = z.object({ nickname: text(1, 30).optional(), avatar: avatar.optional() }).strict();
const addGame = z.object({ gameId: z.string().uuid() }).strict();
const patchGame = z.object({ title: text(1, 120).optional(), content: z.unknown().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10_000).optional() }).strict();
const playSchema = z.object({
  studentId: z.string().uuid().optional(),
  score: z.number().int().min(0).max(10_000),
  maxScore: z.number().int().min(0).max(10_000),
  mistakes: z.number().int().min(0).max(10_000).default(0),
  stars: z.number().int().min(1).max(3),
  durationMs: z.number().int().min(0).max(6 * 3_600_000),
}).strict().refine((s) => s.score <= s.maxScore, { path: ['score'], message: 'score vượt quá maxScore' });

type ClassRow = { id: string; ownerId: string; productId: string };

/**
 * Lớp học của giáo viên/phụ huynh. Nguyên tắc dữ liệu trẻ em:
 *  - học sinh không có tài khoản, không email, không ngày sinh; chỉ biệt danh do người lớn đặt;
 *  - trang của học sinh vào bằng mã lớp, chỉ thấy biệt danh trong lớp đó;
 *  - kết quả chơi chỉ chủ lớp xem được.
 */
@Controller()
export class ClassesController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async owned(id: string, auth: AuthContext): Promise<ClassRow> {
    const row = await this.prisma.classroom.findUnique({ where: { id }, select: { id: true, ownerId: true, productId: true } });
    if (!row || row.ownerId !== auth.userId) throw new NotFoundException();
    return row;
  }

  /** Game trả phí trong lớp chỉ dùng được khi chủ lớp còn gói của sản phẩm (hoặc là nhân sự xem trước). */
  private async ownerHasPremium(ownerId: string, productId: string) {
    const [ent, staff] = await Promise.all([
      this.prisma.entitlement.count({ where: { userId: ownerId, productId, endsAt: { gt: new Date() } } }),
      this.prisma.userRole.count({ where: { userId: ownerId, role: { key: { in: ['super_admin', 'content_editor', 'content_reviewer', 'product_manager'] } } } }),
    ]);
    return ent > 0 || staff > 0;
  }

  // ------------------------------------------------------------------ chủ lớp

  @Get('classes')
  @RequireAuth()
  async list(@CurrentAuth() auth: AuthContext) {
    const rows = await this.prisma.classroom.findMany({
      where: { ownerId: auth.userId },
      orderBy: [{ isArchived: 'asc' }, { createdAt: 'desc' }],
      include: { product: { select: { slug: true, name: true } }, _count: { select: { students: { where: { isActive: true } }, games: { where: { isActive: true } } } } },
    });
    return {
      limits: LIMITS,
      classes: rows.map((c) => ({
        id: c.id, name: c.name, gradeLabel: c.gradeLabel, joinCode: c.joinCode, isArchived: c.isArchived, product: c.product,
        students: c._count.students, games: c._count.games, createdAt: c.createdAt,
      })),
    };
  }

  @Post('classes')
  @HttpCode(201)
  @RequireAuth()
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(createClass, body);
    const count = await this.prisma.classroom.count({ where: { ownerId: auth.userId, isArchived: false } });
    if (count >= LIMITS.classes) throw new BadRequestException({ error: 'class_limit_reached' });
    const product = await this.prisma.product.findUniqueOrThrow({ where: { slug: input.product } });
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await this.prisma.classroom.create({
          data: { ownerId: auth.userId, productId: product.id, name: input.name, gradeLabel: input.gradeLabel ?? null, joinCode: newJoinCode() },
          select: { id: true, joinCode: true },
        });
        await this.audit.record({ actorId: auth.userId, action: 'class.created', entityType: 'classroom', entityId: row.id, ip: clientInfo(req).ip, metadata: { product: input.product } });
        return row;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new Error('Không tạo được mã lớp');
  }

  @Get('classes/:id')
  @RequireAuth()
  async detail(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) {
    await this.owned(id, auth);
    const c = await this.prisma.classroom.findUniqueOrThrow({
      where: { id },
      include: {
        product: { select: { slug: true, name: true } },
        students: { where: { isActive: true }, orderBy: { nickname: 'asc' }, select: { id: true, nickname: true, avatar: true } },
        games: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, title: true, templateKey: true, accessLevel: true, isActive: true, sortOrder: true, sourceGame: { select: { slug: true, title: true } }, updatedAt: true } },
      },
    });
    const premiumOk = await this.ownerHasPremium(auth.userId, c.productId);
    return {
      id: c.id, name: c.name, gradeLabel: c.gradeLabel, joinCode: c.joinCode, isArchived: c.isArchived, product: c.product, limits: LIMITS,
      students: c.students,
      games: c.games.map((g) => ({ ...g, locked: g.accessLevel === AccessLevel.PREMIUM && !premiumOk })),
    };
  }

  @Patch('classes/:id')
  @RequireAuth()
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const input = parse(patchClass, body);
    await this.owned(id, auth);
    return this.prisma.classroom.update({ where: { id }, data: input, select: { id: true, name: true, gradeLabel: true, isArchived: true } });
  }

  /** Đổi mã lớp khi mã cũ bị lộ ra ngoài lớp. */
  @Post('classes/:id/rotate-code')
  @HttpCode(200)
  @RequireAuth()
  async rotate(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) {
    await this.owned(id, auth);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.classroom.update({ where: { id }, data: { joinCode: newJoinCode() }, select: { joinCode: true } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new Error('Không tạo được mã lớp');
  }

  @Post('classes/:id/students')
  @HttpCode(201)
  @RequireAuth()
  async addStudents(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const { students } = parse(addStudents, body);
    await this.owned(id, auth);
    const current = await this.prisma.classStudent.count({ where: { classroomId: id, isActive: true } });
    if (current + students.length > LIMITS.studentsPerClass) throw new BadRequestException({ error: 'student_limit_reached', max: LIMITS.studentsPerClass });
    await this.prisma.classStudent.createMany({ data: students.map((s) => ({ classroomId: id, nickname: s.nickname.trim(), avatar: s.avatar ?? '🙂' })) });
    return { added: students.length };
  }

  @Patch('classes/:id/students/:sid')
  @RequireAuth()
  async updateStudent(@Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const input = parse(patchStudent, body);
    await this.owned(id, auth);
    const n = await this.prisma.classStudent.updateMany({ where: { id: sid, classroomId: id }, data: { ...input, ...(input.nickname ? { nickname: input.nickname.trim() } : {}) } });
    if (!n.count) throw new NotFoundException();
    return { ok: true };
  }

  /** Xoá học sinh: xoá luôn biệt danh và kết quả của em đó (không giữ dữ liệu trẻ em không cần thiết). */
  @Delete('classes/:id/students/:sid')
  @HttpCode(204)
  @RequireAuth()
  async removeStudent(@Param('id', ParseUUIDPipe) id: string, @Param('sid', ParseUUIDPipe) sid: string, @CurrentAuth() auth: AuthContext) {
    await this.owned(id, auth);
    await this.prisma.$transaction([
      this.prisma.classPlay.deleteMany({ where: { studentId: sid, classGame: { classroomId: id } } }),
      this.prisma.classStudent.deleteMany({ where: { id: sid, classroomId: id } }),
    ]);
  }

  /** Chép game từ thư viện vào lớp (bản sao nội dung đang phát hành). */
  @Post('classes/:id/games')
  @HttpCode(201)
  @RequireAuth()
  async addGame(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const { gameId } = parse(addGame, body);
    const cls = await this.owned(id, auth);
    const count = await this.prisma.classGame.count({ where: { classroomId: id } });
    if (count >= LIMITS.gamesPerClass) throw new BadRequestException({ error: 'game_limit_reached' });
    const game = await this.prisma.game.findFirst({
      where: { id: gameId, productId: cls.productId, isPublished: true },
      include: { versions: { where: { isPublished: true }, take: 1 } },
    });
    if (!game || !game.versions[0]) throw new BadRequestException({ error: 'game_not_found' });
    if (game.accessLevel === AccessLevel.PREMIUM && !(await this.ownerHasPremium(auth.userId, cls.productId))) {
      throw new ForbiddenException({ error: 'membership_required' });
    }
    const row = await this.prisma.classGame.create({
      data: {
        classroomId: id, sourceGameId: game.id, title: game.title, templateKey: game.templateKey, accessLevel: game.accessLevel,
        content: game.versions[0].content as Prisma.InputJsonValue, sortOrder: count + 1,
      },
      select: { id: true },
    });
    return row;
  }

  @Get('classes/:id/games/:gid')
  @RequireAuth()
  async classGame(@Param('id', ParseUUIDPipe) id: string, @Param('gid', ParseUUIDPipe) gid: string, @CurrentAuth() auth: AuthContext) {
    await this.owned(id, auth);
    const g = await this.prisma.classGame.findFirst({ where: { id: gid, classroomId: id } });
    if (!g) throw new NotFoundException();
    return { id: g.id, title: g.title, templateKey: g.templateKey, accessLevel: g.accessLevel, isActive: g.isActive, content: g.content };
  }

  /** Giáo viên sửa bản sao của lớp; nội dung luôn được kiểm tra bằng schema của template. */
  @Patch('classes/:id/games/:gid')
  @RequireAuth()
  async updateGame(@Param('id', ParseUUIDPipe) id: string, @Param('gid', ParseUUIDPipe) gid: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const input = parse(patchGame, body);
    await this.owned(id, auth);
    const g = await this.prisma.classGame.findFirst({ where: { id: gid, classroomId: id } });
    if (!g) throw new NotFoundException();
    let content: Prisma.InputJsonValue | undefined;
    if (input.content !== undefined) {
      const r = validateGameData(g.templateKey, input.content);
      if (!r.ok) throw new BadRequestException({ error: 'invalid_content', issues: r.issues.slice(0, 100) });
      content = r.data as Prisma.InputJsonValue;
    }
    const row = await this.prisma.classGame.update({
      where: { id: gid },
      data: { ...(input.title ? { title: input.title } : {}), ...(input.isActive !== undefined ? { isActive: input.isActive } : {}), ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}), ...(content ? { content } : {}) },
      select: { id: true, title: true, isActive: true, updatedAt: true },
    });
    return row;
  }

  @Delete('classes/:id/games/:gid')
  @HttpCode(204)
  @RequireAuth()
  async removeGame(@Param('id', ParseUUIDPipe) id: string, @Param('gid', ParseUUIDPipe) gid: string, @CurrentAuth() auth: AuthContext) {
    await this.owned(id, auth);
    await this.prisma.classGame.deleteMany({ where: { id: gid, classroomId: id } });
  }

  /** Bảng kết quả: mỗi học sinh × mỗi game (lượt chơi, sao cao nhất, lần cuối). */
  @Get('classes/:id/results')
  @RequireAuth()
  async results(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) {
    await this.owned(id, auth);
    const [cells, recent] = await Promise.all([
      this.prisma.classPlay.groupBy({
        by: ['studentId', 'classGameId'],
        where: { classGame: { classroomId: id } },
        _count: { _all: true }, _max: { stars: true, createdAt: true },
      }),
      this.prisma.classPlay.findMany({
        where: { classGame: { classroomId: id } }, orderBy: { createdAt: 'desc' }, take: 50,
        select: { id: true, score: true, maxScore: true, stars: true, mistakes: true, durationMs: true, createdAt: true, student: { select: { id: true, nickname: true, avatar: true } }, classGame: { select: { id: true, title: true } } },
      }),
    ]);
    return {
      cells: cells.map((c) => ({ studentId: c.studentId, classGameId: c.classGameId, plays: c._count._all, bestStars: c._max.stars ?? 0, lastPlayedAt: c._max.createdAt })),
      recent,
    };
  }

  // ------------------------------------------------------------------ học sinh (không đăng nhập, vào bằng mã lớp)

  private async byCode(codeRaw: string) {
    const code = parse(joinCode, codeRaw);
    const c = await this.prisma.classroom.findUnique({ where: { joinCode: code } });
    if (!c || c.isArchived) throw new NotFoundException({ error: 'class_not_found' });
    return c;
  }

  @Get('class-join/:code')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async join(@Param('code') code: string) {
    const c = await this.byCode(code);
    const [product, students, games, premiumOk] = await Promise.all([
      this.prisma.product.findUniqueOrThrow({ where: { id: c.productId }, select: { slug: true, name: true } }),
      this.prisma.classStudent.findMany({ where: { classroomId: c.id, isActive: true }, orderBy: { nickname: 'asc' }, select: { id: true, nickname: true, avatar: true } }),
      this.prisma.classGame.findMany({ where: { classroomId: c.id, isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, title: true, templateKey: true, accessLevel: true } }),
      this.ownerHasPremium(c.ownerId, c.productId),
    ]);
    return {
      name: c.name, gradeLabel: c.gradeLabel, product, students,
      games: games.map(({ accessLevel, ...g }) => ({ ...g, locked: accessLevel === AccessLevel.PREMIUM && !premiumOk })),
    };
  }

  @Get('class-join/:code/games/:gid')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async joinGame(@Param('code') code: string, @Param('gid', ParseUUIDPipe) gid: string) {
    const c = await this.byCode(code);
    const g = await this.prisma.classGame.findFirst({ where: { id: gid, classroomId: c.id, isActive: true } });
    if (!g) throw new NotFoundException();
    if (g.accessLevel === AccessLevel.PREMIUM && !(await this.ownerHasPremium(c.ownerId, c.productId))) throw new ForbiddenException({ error: 'membership_required' });
    const r = validateGameData(g.templateKey, g.content);
    if (!r.ok) throw new NotFoundException({ error: 'content_invalid' });
    return { id: g.id, title: g.title, templateKey: g.templateKey, data: r.data };
  }

  @Post('class-join/:code/games/:gid/plays')
  @HttpCode(201)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async play(@Param('code') code: string, @Param('gid', ParseUUIDPipe) gid: string, @Body() body: unknown) {
    const input = parse(playSchema, body);
    const c = await this.byCode(code);
    const g = await this.prisma.classGame.findFirst({ where: { id: gid, classroomId: c.id, isActive: true }, select: { id: true } });
    if (!g) throw new NotFoundException();
    if (input.studentId) {
      const s = await this.prisma.classStudent.count({ where: { id: input.studentId, classroomId: c.id, isActive: true } });
      if (!s) throw new BadRequestException({ error: 'student_not_in_class' });
    }
    const { studentId, ...rest } = input;
    await this.prisma.classPlay.create({ data: { classGameId: g.id, studentId: studentId ?? null, ...rest } });
    return { saved: true };
  }
}

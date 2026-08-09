import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { MailService } from '../mail/mail.service';
import { RbacService } from '../rbac/rbac.service';

import type { CreateInvitationDto } from './dto/create-invitation.dto';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';

const INVITATION_TTL_DAYS = 7;
const INVITATION_ISSUER = 'bc-invitation';
const INVITATION_AUDIENCE = 'bc-invitation-accept';

interface InviteTokenPayload {
  sub: string;
  purpose: 'invitation';
  org: string;
}

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
    private readonly mailService: MailService,
    private readonly auditService: AuditService,
    private readonly rbacService: RbacService,
  ) {}

  async create(
    orgId: string,
    inviterId: string,
    dto: CreateInvitationDto,
    ip?: string,
    userAgent?: string,
  ) {
    const email = dto.email.toLowerCase().trim();

    await this.assertInvitable(orgId, email);

    if (dto.managerId) {
      const manager = await this.prisma.user.findFirst({
        where: { id: dto.managerId, organizationId: orgId, deletedAt: null, isActive: true },
        select: { id: true },
      });
      if (!manager) {
        throw new BadRequestException('The selected manager was not found');
      }
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, OR: [{ organizationId: orgId }, { organizationId: null }] },
        select: { id: true },
      });
      if (!department) {
        throw new BadRequestException('The selected department was not found');
      }
    }

    if (dto.roleIds && dto.roleIds.length > 0) {
      await this.assertRolesBelongToOrg(orgId, dto.roleIds);
      await this.rbacService.assertCanGrantOwnerRole(orgId, inviterId, dto.roleIds);
    }

    const tokenExpiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: orgId,
        invitedById: inviterId,
        email,
        name: dto.name.trim(),
        departmentId: dto.departmentId ?? null,
        designation: dto.designation?.trim() || null,
        managerId: dto.managerId ?? null,
        roleIds: dto.roleIds ?? [],
        tokenExpiresAt,
      },
    });

    const token = this.signToken(invitation.id, orgId);
    const inviteUrl = `${this.configService.webUrl}/accept-invite?token=${encodeURIComponent(token)}`;

    const result = await this.mailService.sendOrgEmail(orgId, {
      to: email,
      type: 'invitation',
      data: { invitation: { inviteUrl } },
    });

    await this.auditService.record({
      userId: inviterId,
      organizationId: orgId,
      action: 'INVITE_CREATED',
      entity: 'Invitation',
      entityId: invitation.id,
      status: 'SUCCESS',
      metadata: { email, emailSent: result.sent, reason: result.reason },
      ipAddress: ip,
      userAgent,
    });

    if (!result.sent) {
      this.logger.warn(
        `Invitation ${invitation.id} created but email not delivered (${result.reason}); inviteUrl available to inviter.`,
      );
    }

    return {
      id: invitation.id,
      email: invitation.email,
      name: invitation.name,
      status: invitation.status,
      expiresAt: invitation.tokenExpiresAt,
      emailSent: result.sent,
      inviteUrl: result.sent ? undefined : inviteUrl,
      message: result.sent
        ? 'Invitation sent. The employee will set their password from the invitation link.'
        : 'Invitation created but SMTP is not configured. Use the invite link below to share it.',
    };
  }

  async findAll(orgId: string) {
    const invitations = await this.prisma.invitation.findMany({
      where: { organizationId: orgId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    const now = Date.now();
    return invitations.map((inv) => {
      const expired = inv.tokenExpiresAt.getTime() < now;
      return {
        id: inv.id,
        email: inv.email,
        name: inv.name,
        department: inv.department ? { id: inv.department.id, name: inv.department.name } : null,
        designation: inv.designation,
        manager: inv.manager ? { id: inv.manager.id, name: inv.manager.name } : null,
        roleIds: inv.roleIds,
        status: expired ? 'EXPIRED' : inv.status,
        expired,
        expiresAt: inv.tokenExpiresAt,
        createdAt: inv.createdAt,
        resendCount: inv.resendCount,
      };
    });
  }

  async revoke(orgId: string, invitationId: string, actorId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'REVOKED' },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'INVITE_REVOKED',
      entity: 'Invitation',
      entityId: invitationId,
      status: 'SUCCESS',
      metadata: { email: invitation.email },
    });

    return { id: updated.id, status: updated.status };
  }

  async resend(orgId: string, invitationId: string, actorId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Only pending invitations can be resent');
    }
    if (invitation.tokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This invitation has expired. Revoke it and create a new one.');
    }

    const token = this.signToken(invitation.id, orgId);
    const inviteUrl = `${this.configService.webUrl}/accept-invite?token=${encodeURIComponent(token)}`;

    const result = await this.mailService.sendOrgEmail(orgId, {
      to: invitation.email,
      type: 'invitation',
      data: { invitation: { inviteUrl } },
    });

    const updated = await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { resendCount: { increment: 1 } },
    });

    await this.auditService.record({
      userId: actorId,
      organizationId: orgId,
      action: 'INVITE_RESENT',
      entity: 'Invitation',
      entityId: invitationId,
      status: 'SUCCESS',
      metadata: { email: invitation.email, emailSent: result.sent },
    });

    return {
      id: updated.id,
      emailSent: result.sent,
      inviteUrl: result.sent ? undefined : inviteUrl,
    };
  }

  /** Validates an invite token and returns safe info for the branded accept page. */
  async verify(token: string) {
    const invitation = await this.verifyToken(token);
    const brand = await this.settingsService.buildEmailBrand(invitation.organizationId);
    return {
      valid: true,
      email: invitation.email,
      name: invitation.name,
      expiresAt: invitation.tokenExpiresAt,
      organization: { name: brand.companyName },
      brand: {
        companyName: brand.companyName,
        tagline: brand.tagline ?? '',
        logoUrl: brand.logoUrl ?? null,
        primaryColor: brand.primaryColor ?? '#3B82F6',
        secondaryColor: brand.secondaryColor ?? '#8B5CF6',
        accentColor: brand.accentColor ?? '#10B981',
        fontFamily: brand.fontFamily ?? '',
      },
    };
  }

  async accept(token: string, dto: AcceptInvitationDto, ip?: string, userAgent?: string) {
    const invitation = await this.verifyToken(token);
    const orgId = invitation.organizationId;
    const email = invitation.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('An account already exists for this email');
    }

    const name = dto.name?.trim() || invitation.name;

    const hashedPassword = await argon2.hash(dto.password);

    if (invitation.roleIds.length > 0) {
      await this.assertRolesBelongToOrg(orgId, invitation.roleIds);
    }

    let created: { id: string; email: string; name: string };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            role: UserRole.USER,
            isActive: true,
            organizationId: orgId,
            departmentId: invitation.departmentId,
            designation: invitation.designation,
            managerId: invitation.managerId,
          },
          select: { id: true, email: true, name: true },
        });

        await tx.organizationMember.upsert({
          where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
          update: {},
          create: { organizationId: orgId, userId: user.id, role: 'MEMBER' },
        });

        if (invitation.roleIds.length > 0) {
          await tx.userRoleAssignment.createMany({
            data: invitation.roleIds.map((roleId) => ({ userId: user.id, roleId })),
          });
        }

        await tx.invitation.update({
          where: { id: invitation.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            acceptedUserId: user.id,
          },
        });

        return user;
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account already exists for this email');
      }
      throw error;
    }

    await this.auditService.record({
      userId: created.id,
      organizationId: orgId,
      action: 'INVITE_ACCEPTED',
      entity: 'Invitation',
      entityId: invitation.id,
      status: 'SUCCESS',
      metadata: { email },
      ipAddress: ip,
      userAgent,
    });

    return {
      success: true,
      message: 'Your account has been created. You can now sign in.',
    };
  }

  private async assertInvitable(orgId: string, email: string): Promise<void> {
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException(
        existingUser.deletedAt
          ? 'A previously deleted user with this email exists. Contact support to restore.'
          : 'An account with this email already exists',
      );
    }

    const pending = await this.prisma.invitation.findFirst({
      where: { organizationId: orgId, email, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException('A pending invitation already exists for this email');
    }
  }

  private async assertRolesBelongToOrg(orgId: string, roleIds: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds }, organizationId: orgId },
      select: { id: true },
    });
    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles were not found');
    }
  }

  private signToken(invitationId: string, orgId: string): string {
    const payload: InviteTokenPayload = { sub: invitationId, purpose: 'invitation', org: orgId };
    return this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: `${INVITATION_TTL_DAYS}d`,
      issuer: INVITATION_ISSUER,
      audience: INVITATION_AUDIENCE,
    });
  }

  private async verifyToken(token: string) {
    let payload: InviteTokenPayload;
    try {
      payload = this.jwtService.verify<InviteTokenPayload>(token, {
        secret: this.configService.jwtSecret,
        issuer: INVITATION_ISSUER,
        audience: INVITATION_AUDIENCE,
      });
    } catch {
      throw new BadRequestException('This invitation link is invalid or has expired');
    }

    if (payload.purpose !== 'invitation' || !payload.sub || !payload.org) {
      throw new BadRequestException('This invitation link is invalid or has expired');
    }

    const invitation = await this.prisma.invitation.findUnique({
      where: { id: payload.sub },
    });

    if (!invitation || invitation.organizationId !== payload.org) {
      throw new BadRequestException('This invitation link is invalid or has expired');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        invitation.status === 'ACCEPTED'
          ? 'This invitation has already been accepted'
          : 'This invitation is no longer active',
      );
    }

    if (invitation.tokenExpiresAt.getTime() < Date.now()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('This invitation link has expired');
    }

    return invitation;
  }
}

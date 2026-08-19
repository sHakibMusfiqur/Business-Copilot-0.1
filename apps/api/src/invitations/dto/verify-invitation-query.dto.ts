import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Invitation tokens are signed JWTs: `header.payload.signature` in base64url. */
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export class VerifyInvitationQueryDto {
  @IsString()
  @MinLength(16)
  @MaxLength(2048)
  @Matches(JWT_SHAPE, { message: 'Invalid invitation token' })
  token!: string;
}
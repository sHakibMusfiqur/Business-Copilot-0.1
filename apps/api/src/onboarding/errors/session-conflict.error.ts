import { ConflictException } from '@nestjs/common';

export interface SessionConflictPayload {
  message: string;
  conflictVersion: number;
  incomingVersion: number;
  changedFields: string[];
  timestamp: string;
  sessionId: string;
}

export class SessionConflictError extends ConflictException {
  constructor(params: {
    sessionId: string;
    currentVersion: number;
    incomingVersion: number;
    requestedFields: string[];
  }) {
    const payload: SessionConflictPayload = {
      message: 'Session was modified by another device',
      conflictVersion: params.currentVersion,
      incomingVersion: params.incomingVersion,
      changedFields: params.requestedFields,
      timestamp: new Date().toISOString(),
      sessionId: params.sessionId,
    };
    super(payload);
  }
}

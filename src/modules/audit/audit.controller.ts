import type { Request, Response } from 'express';
import { queryString } from '../../shared/validation';
import { AUDIT_ACTIONS, type AuditEntry } from './audit.model';
import { auditRepository } from './audit.repository';

export const auditController = {
  /** GET /audit?action= */
  list(req: Request, res: Response<AuditEntry[]>): void {
    const requested = queryString(req.query['action']);
    const action = AUDIT_ACTIONS.find((option) => option === requested);
    res.json(auditRepository.findAll(action));
  },
};

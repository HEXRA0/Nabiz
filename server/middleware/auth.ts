import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.js';
import { db } from '../db/index.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
    email: string;
    role: string;
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Yetkilendirme belirteci (token) eksik veya geçersiz.' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as any;
    const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?').get(decoded.id) as any;
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz token.' });
  }
}

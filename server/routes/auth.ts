import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { CONFIG } from '../config.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Check if setup is needed
router.get('/status', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  res.json({
    needsSetup: userCount.count === 0,
    version: '1.0.0',
    title: 'Nabız'
  });
});

// Initial admin setup
router.post('/setup', async (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count > 0) {
    return res.status(400).json({ error: 'Sistem kurulumu daha önce tamamlanmış.' });
  }

  const { username, email, password } = req.body;
  if (!username || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Kullanıcı adı, geçerli bir e-posta ve en az 6 karakterli parola gereklidir.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, 'admin')
    `).run(username.trim(), email.trim().toLowerCase(), passwordHash);

    const token = jwt.sign({ id: result.lastInsertRowid, username, role: 'admin' }, CONFIG.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({
      success: true,
      token,
      user: { id: result.lastInsertRowid, username, email, role: 'admin' }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Kullanıcı oluşturulurken hata: ' + error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı/e-posta ve parola giriniz.' });
  }

  const user = db.prepare(`
    SELECT * FROM users WHERE username = ? OR email = ?
  `).get(usernameOrEmail.trim(), usernameOrEmail.trim().toLowerCase()) as any;

  if (!user) {
    return res.status(401).json({ error: 'Geçersiz kullanıcı bilgileri veya parola.' });
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Geçersiz kullanıcı bilgileri veya parola.' });
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, CONFIG.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, email: user.email, role: user.role }
  });
});

// Me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// Change password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Yeni parola en az 6 karakter olmalıdır.' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user?.id) as any;
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    return res.status(400).json({ error: 'Mevcut parola hatalı.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user?.id);

  res.json({ success: true, message: 'Parolanız başarıyla güncellendi.' });
});

export default router;

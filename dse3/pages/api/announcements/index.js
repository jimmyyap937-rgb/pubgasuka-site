import { getAllAnnouncements, saveAllAnnouncements, checkAdminPasscode } from '../../../lib/kv';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const announcements = await getAllAnnouncements();
      res.status(200).json({ announcements });
    } catch (err) {
      console.error('GET /api/announcements failed:', err);
      res.status(500).json({ error: '读取公告失败，请稍后重试。' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const passcode = req.headers['x-admin-passcode'] || '';
      if (!checkAdminPasscode(passcode)) {
        res.status(401).json({ error: '密码不对。' });
        return;
      }

      const { text } = req.body || {};
      const cleanText = typeof text === 'string' ? text.trim().slice(0, 300) : '';
      if (!cleanText) {
        res.status(400).json({ error: '公告内容不能为空。' });
        return;
      }

      const announcement = {
        id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        text: cleanText,
        ts: Date.now(),
      };

      const announcements = await getAllAnnouncements();
      announcements.unshift(announcement);
      await saveAllAnnouncements(announcements);

      res.status(201).json({ announcement });
    } catch (err) {
      console.error('POST /api/announcements failed:', err);
      res.status(500).json({ error: '发布公告失败，请稍后重试。' });
    }
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: `方法 ${req.method} 不支持` });
}

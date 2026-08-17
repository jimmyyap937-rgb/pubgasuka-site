import { getAllAnnouncements, saveAllAnnouncements, checkAdminPasscode } from '../../../lib/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      const passcode = req.headers['x-admin-passcode'] || '';
      if (!checkAdminPasscode(passcode)) {
        res.status(401).json({ error: '密码不对。' });
        return;
      }

      const announcements = await getAllAnnouncements();
      const idx = announcements.findIndex((a) => a.id === id);
      if (idx === -1) {
        res.status(404).json({ error: '这条公告已经不在了。' });
        return;
      }
      announcements.splice(idx, 1);
      await saveAllAnnouncements(announcements);

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/announcements/[id] failed:', err);
      res.status(500).json({ error: '删除失败，请稍后重试。' });
    }
    return;
  }

  res.setHeader('Allow', ['DELETE']);
  res.status(405).json({ error: `方法 ${req.method} 不支持` });
}

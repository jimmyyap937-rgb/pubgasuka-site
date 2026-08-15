import { getAllPosts, saveAllPosts, checkAdminPasscode } from '../../../lib/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'DELETE') {
    try {
      const passcode = req.headers['x-admin-passcode'] || '';
      if (!checkAdminPasscode(passcode)) {
        res.status(401).json({ error: '密码不对。' });
        return;
      }

      const posts = await getAllPosts();
      const idx = posts.findIndex((p) => p.id === id);
      if (idx === -1) {
        res.status(404).json({ error: '这张便条已经不在了。' });
        return;
      }
      posts.splice(idx, 1);
      await saveAllPosts(posts);

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/posts/[id] failed:', err);
      res.status(500).json({ error: '删除失败，请稍后重试。' });
    }
    return;
  }

  res.setHeader('Allow', ['DELETE']);
  res.status(405).json({ error: `方法 ${req.method} 不支持` });
}

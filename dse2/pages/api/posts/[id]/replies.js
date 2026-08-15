import { getAllPosts, saveAllPosts, checkAdminPasscode } from '../../../../lib/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'POST') {
    try {
      const { anonymous, name, text } = req.body || {};
      const cleanText = typeof text === 'string' ? text.trim().slice(0, 200) : '';
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 24) : '';
      const isAnon = anonymous !== false;

      if (!cleanText) {
        res.status(400).json({ error: '回复内容不能为空。' });
        return;
      }
      if (!isAnon && !cleanName) {
        res.status(400).json({ error: '选择了实名，请填写你的名字。' });
        return;
      }

      const posts = await getAllPosts();
      const post = posts.find((p) => p.id === id);
      if (!post) {
        res.status(404).json({ error: '这张便条已经不在了。' });
        return;
      }

      const reply = {
        id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        anonymous: isAnon,
        name: isAnon ? '' : cleanName,
        text: cleanText,
        ts: Date.now(),
      };
      if (!Array.isArray(post.replies)) post.replies = [];
      post.replies.push(reply);
      await saveAllPosts(posts);

      res.status(201).json({ reply });
    } catch (err) {
      console.error('POST /api/posts/[id]/replies failed:', err);
      res.status(500).json({ error: '回复失败，请稍后重试。' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    try {
      const passcode = req.headers['x-admin-passcode'] || '';
      if (!checkAdminPasscode(passcode)) {
        res.status(401).json({ error: '密码不对。' });
        return;
      }
      const { replyId } = req.query;

      const posts = await getAllPosts();
      const post = posts.find((p) => p.id === id);
      if (!post) {
        res.status(404).json({ error: '这张便条已经不在了。' });
        return;
      }
      const before = post.replies.length;
      post.replies = post.replies.filter((r) => r.id !== replyId);
      if (post.replies.length === before) {
        res.status(404).json({ error: '这条回复已经不在了。' });
        return;
      }
      await saveAllPosts(posts);

      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/posts/[id]/replies failed:', err);
      res.status(500).json({ error: '删除失败，请稍后重试。' });
    }
    return;
  }

  res.setHeader('Allow', ['POST', 'DELETE']);
  res.status(405).json({ error: `方法 ${req.method} 不支持` });
}

import { getAllPosts, saveAllPosts } from '../../../../lib/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method === 'POST') {
    try {
      const { action } = req.body || {};
      const delta = action === 'unlike' ? -1 : 1;

      const posts = await getAllPosts();
      const post = posts.find((p) => p.id === id);
      if (!post) {
        res.status(404).json({ error: '这张便条已经不在了。' });
        return;
      }
      post.likes = Math.max(0, (post.likes || 0) + delta);
      await saveAllPosts(posts);

      res.status(200).json({ likes: post.likes });
    } catch (err) {
      console.error('POST /api/posts/[id]/like failed:', err);
      res.status(500).json({ error: '操作失败，请稍后重试。' });
    }
    return;
  }

  res.setHeader('Allow', ['POST']);
  res.status(405).json({ error: `方法 ${req.method} 不支持` });
}

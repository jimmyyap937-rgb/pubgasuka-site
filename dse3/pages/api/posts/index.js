import { getAllPosts, saveAllPosts, checkAdminPasscode } from '../../../lib/kv';

// A submitted image, base64-encoded, must stay under this size so a single
// KV value doesn't grow unbounded as the wall fills up.
const MAX_IMAGE_BYTES = 900 * 1024; // ~900KB

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const posts = await getAllPosts();
      res.status(200).json({ posts });
    } catch (err) {
      console.error('GET /api/posts failed:', err);
      res.status(500).json({ error: '读取投稿失败，请稍后重试。' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { anonymous, name, text, image, isAdminPost } = req.body || {};

      const cleanText = typeof text === 'string' ? text.trim().slice(0, 600) : '';
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 24) : '';
      const isAnon = anonymous !== false;

      // The "admin post" gold badge can only be granted if the correct
      // admin passcode was actually sent — a client claiming isAdminPost
      // without the passcode is ignored, so this can't be spoofed.
      const passcode = req.headers['x-admin-passcode'] || '';
      const verifiedAdminPost = Boolean(isAdminPost) && checkAdminPasscode(passcode);

      if (!cleanText && !image) {
        res.status(400).json({ error: '请至少写点文字或上传一张图片。' });
        return;
      }
      if (!isAnon && !cleanName) {
        res.status(400).json({ error: '选择了实名，请填写你的名字。' });
        return;
      }
      if (image && typeof image === 'string') {
        const approxBytes = Math.ceil((image.length * 3) / 4);
        if (approxBytes > MAX_IMAGE_BYTES) {
          res.status(400).json({ error: '图片太大了，请换一张小一点的图片。' });
          return;
        }
        if (!image.startsWith('data:image/')) {
          res.status(400).json({ error: '图片格式不正确。' });
          return;
        }
      }

      const post = {
        id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        anonymous: isAnon,
        name: isAnon ? '' : cleanName,
        text: cleanText,
        image: image || null,
        ts: Date.now(),
        likes: 0,
        replies: [],
        isAdminPost: verifiedAdminPost,
      };

      const posts = await getAllPosts();
      posts.unshift(post);
      await saveAllPosts(posts);

      res.status(201).json({ post });
    } catch (err) {
      console.error('POST /api/posts failed:', err);
      res.status(500).json({ error: '保存失败，请稍后重试。' });
    }
    return;
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).json({ error: `方法 ${req.method} 不支持` });
}

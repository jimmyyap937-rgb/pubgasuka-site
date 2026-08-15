import { Redis } from '@upstash/redis';

// Vercel KV was sunset; the Vercel Marketplace "Upstash for Redis" integration
// is its replacement and still sets these same env var names for compatibility.
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const POSTS_KEY = 'wall-posts';
const MAX_POSTS_KEPT = 300;

export async function getAllPosts() {
  const posts = await redis.get(POSTS_KEY);
  if (!Array.isArray(posts)) return [];
  return posts;
}

export async function saveAllPosts(posts) {
  let toSave = posts;
  if (toSave.length > MAX_POSTS_KEPT) {
    toSave = toSave
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_POSTS_KEPT);
  }
  await redis.set(POSTS_KEY, toSave);
  return toSave;
}

export function checkAdminPasscode(passcode) {
  const expected = process.env.ADMIN_PASSCODE || '';
  return Boolean(expected) && passcode === expected;
}

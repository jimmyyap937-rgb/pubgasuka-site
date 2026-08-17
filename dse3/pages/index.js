import { useEffect, useRef, useState } from 'react';

const PAPER_COLORS = ['paper-yellow', 'paper-pink', 'paper-blue', 'paper-green', 'paper-purple'];
const PIN_COLORS = ['pin-red', 'pin-blue', 'pin-yellow', 'pin-teal'];
const LIKED_KEY = 'esa-wall-liked-ids';
const MAX_IMAGE_WIDTH = 900;

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Home() {
  const [posts, setPosts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [likedIds, setLikedIds] = useState([]);
  const [sortMode, setSortMode] = useState('new');

  const [showCompose, setShowCompose] = useState(false);
  const [isAnon, setIsAnon] = useState(true);
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [postAsAdmin, setPostAsAdmin] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(50);
  const PAGE_SIZE = 50;

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminPasscode, setAdminPasscode] = useState('');
  const isAdmin = Boolean(adminPasscode);

  const [showAnnCompose, setShowAnnCompose] = useState(false);
  const [annText, setAnnText] = useState('');
  const [annError, setAnnError] = useState('');
  const [annSubmitting, setAnnSubmitting] = useState(false);

  // Reply UI state, keyed by post id.
  const [openReplies, setOpenReplies] = useState({}); // { [postId]: bool }
  const [replyDrafts, setReplyDrafts] = useState({}); // { [postId]: {text, anon, name, submitting, error} }

  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIKED_KEY);
      setLikedIds(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setLikedIds([]);
    }
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setLoadError('');
    try {
      const [postsRes, annRes] = await Promise.all([fetch('/api/posts'), fetch('/api/announcements')]);
      const postsData = await postsRes.json();
      const annData = await annRes.json();
      if (!postsRes.ok) throw new Error(postsData.error || '读取失败');
      if (!annRes.ok) throw new Error(annData.error || '读取公告失败');
      setPosts(postsData.posts || []);
      setAnnouncements(annData.announcements || []);
    } catch (err) {
      setLoadError('加载投稿墙失败，请刷新页面重试。');
    } finally {
      setLoading(false);
    }
  }

  function persistLikedIds(ids) {
    setLikedIds(ids);
    try {
      window.localStorage.setItem(LIKED_KEY, JSON.stringify(ids));
    } catch (e) {
      /* non-critical */
    }
  }

  async function toggleLike(id) {
    const already = likedIds.includes(id);
    const action = already ? 'unlike' : 'like';

    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, likes: Math.max(0, (p.likes || 0) + (already ? -1 : 1)) } : p
      )
    );
    persistLikedIds(already ? likedIds.filter((x) => x !== id) : [...likedIds, id]);

    try {
      const res = await fetch(`/api/posts/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('like failed');
      const data = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: data.likes } : p)));
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, likes: Math.max(0, (p.likes || 0) + (already ? 1 : -1)) } : p
        )
      );
      persistLikedIds(likedIds);
    }
  }

  async function deletePost(id) {
    const removed = posts.find((p) => p.id === id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-passcode': adminPasscode },
      });
      if (res.status === 401) {
        setAdminPasscode('');
        alert('管理员密码已失效，请重新登入。');
        if (removed) setPosts((prev) => [...prev, removed]);
        return;
      }
      if (!res.ok) throw new Error('delete failed');
    } catch (err) {
      if (removed) setPosts((prev) => [...prev, removed]);
      alert('删除失败，请稍后重试。');
    }
  }

  function handleImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('请选择图片文件。');
      return;
    }
    setFormError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_WIDTH / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPendingImage(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => setFormError('图片读取失败，请换一张试试。');
      img.src = ev.target.result;
    };
    reader.onerror = () => setFormError('图片读取失败，请换一张试试。');
    reader.readAsDataURL(file);
  }

  function resetComposeForm() {
    setIsAnon(true);
    setName('');
    setText('');
    setPendingImage(null);
    setFormError('');
    setPostAsAdmin(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function closeCompose() {
    setShowCompose(false);
    resetComposeForm();
  }

  async function submitPost() {
    const cleanText = text.trim();
    const cleanName = name.trim();
    setFormError('');

    if (!cleanText && !pendingImage) {
      setFormError('请至少写点文字或上传一张图片。');
      return;
    }
    if (!isAnon && !cleanName) {
      setFormError('选择了实名，请填写你的名字。');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isAdmin && postAsAdmin ? { 'x-admin-passcode': adminPasscode } : {}),
        },
        body: JSON.stringify({
          anonymous: isAnon,
          name: cleanName,
          text: cleanText,
          image: pendingImage,
          isAdminPost: isAdmin && postAsAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setPosts((prev) => [{ ...data.post, replies: [] }, ...prev]);
      closeCompose();
    } catch (err) {
      setFormError(err.message || '保存失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  function tryAdminLogin() {
    setAdminError('');
    fetch('/api/posts/__check__', {
      method: 'DELETE',
      headers: { 'x-admin-passcode': adminPass },
    })
      .then((res) => {
        if (res.status === 401) {
          setAdminError('密码不对，请再试一次。');
          return;
        }
        setAdminPasscode(adminPass);
        setShowAdmin(false);
        setAdminPass('');
      })
      .catch(() => setAdminError('网络错误，请稍后重试。'));
  }

  function logoutAdmin() {
    setAdminPasscode('');
  }

  // ---------- Announcements ----------
  async function submitAnnouncement() {
    const cleanText = annText.trim();
    setAnnError('');
    if (!cleanText) {
      setAnnError('公告内容不能为空。');
      return;
    }
    setAnnSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-passcode': adminPasscode },
        body: JSON.stringify({ text: cleanText }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setAdminPasscode('');
        setAnnError('管理员登入已失效，请重新登入。');
        return;
      }
      if (!res.ok) throw new Error(data.error || '发布失败');
      setAnnouncements((prev) => [data.announcement, ...prev]);
      setAnnText('');
      setShowAnnCompose(false);
    } catch (err) {
      setAnnError(err.message || '发布失败，请稍后重试。');
    } finally {
      setAnnSubmitting(false);
    }
  }

  async function deleteAnnouncement(id) {
    const removed = announcements.find((a) => a.id === id);
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'x-admin-passcode': adminPasscode },
      });
      if (res.status === 401) {
        setAdminPasscode('');
        alert('管理员密码已失效，请重新登入。');
        if (removed) setAnnouncements((prev) => [...prev, removed]);
        return;
      }
      if (!res.ok) throw new Error('delete failed');
    } catch (err) {
      if (removed) setAnnouncements((prev) => [...prev, removed]);
      alert('删除失败，请稍后重试。');
    }
  }

  // ---------- Replies ----------
  function toggleReplies(postId) {
    setOpenReplies((prev) => ({ ...prev, [postId]: !prev[postId] }));
    setReplyDrafts((prev) => (prev[postId] ? prev : { ...prev, [postId]: { text: '', anon: true, name: '', submitting: false, error: '' } }));
  }

  function updateReplyDraft(postId, patch) {
    setReplyDrafts((prev) => ({
      ...prev,
      [postId]: { text: '', anon: true, name: '', submitting: false, error: '', ...prev[postId], ...patch },
    }));
  }

  async function submitReply(postId) {
    const draft = replyDrafts[postId] || { text: '', anon: true, name: '' };
    const cleanText = draft.text.trim();
    const cleanName = (draft.name || '').trim();

    if (!cleanText) {
      updateReplyDraft(postId, { error: '回复内容不能为空。' });
      return;
    }
    if (!draft.anon && !cleanName) {
      updateReplyDraft(postId, { error: '选择了实名，请填写你的名字。' });
      return;
    }

    updateReplyDraft(postId, { submitting: true, error: '' });
    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonymous: draft.anon, name: cleanName, text: cleanText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '回复失败');
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, replies: [...(p.replies || []), data.reply] } : p))
      );
      updateReplyDraft(postId, { text: '', submitting: false, error: '' });
    } catch (err) {
      updateReplyDraft(postId, { submitting: false, error: err.message || '回复失败，请稍后重试。' });
    }
  }

  async function deleteReply(postId, replyId) {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, replies: p.replies.filter((r) => r.id !== replyId) } : p))
    );
    try {
      const res = await fetch(`/api/posts/${postId}/replies?replyId=${replyId}`, {
        method: 'DELETE',
        headers: { 'x-admin-passcode': adminPasscode },
      });
      if (res.status === 401) {
        setAdminPasscode('');
        alert('管理员密码已失效，请重新登入。');
      }
      if (!res.ok) throw new Error('delete failed');
    } catch (err) {
      alert('删除回复失败，请刷新页面重试。');
    }
  }

  const sortedPosts = [...posts].sort((a, b) =>
    sortMode === 'hot' ? (b.likes || 0) - (a.likes || 0) || b.ts - a.ts : b.ts - a.ts
  );
  const q = searchQuery.trim().toLowerCase();
  const filteredPosts = q
    ? sortedPosts.filter(
        (p) =>
          (p.text && p.text.toLowerCase().includes(q)) ||
          (!p.anonymous && p.name && p.name.toLowerCase().includes(q))
      )
    : sortedPosts;
  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const hasMore = filteredPosts.length > visiblePosts.length;
  const sortedAnnouncements = [...announcements].sort((a, b) => b.ts - a.ts);

  return (
    <div className="page">
      <div className="top-bar">
        {isAdmin ? (
          <button className="admin-toggle on" onClick={logoutAdmin}>
            🔓 管理中（点击退出）
          </button>
        ) : (
          <button className="admin-toggle" onClick={() => setShowAdmin(true)}>
            🔒 管理员
          </button>
        )}
      </div>

      {loadError && <div className="env-banner">{loadError}</div>}

      <div className="board">
        <div className="banner-wrap">
          <div className="banner">
            <div className="sub">SMK Dato Syed Esa</div>
            <h1>投稿墙</h1>
            <div className="desc">写下想说的话，贴上这面墙 — 可以匿名，也可以留下你的名字。</div>
          </div>
        </div>

        {(sortedAnnouncements.length > 0 || isAdmin) && (
          <div className="ann-section">
            {sortedAnnouncements.map((a) => (
              <div className="ann-card" key={a.id}>
                <span className="ann-label">📢 公告</span>
                <div className="ann-text">{a.text}</div>
                <span className="ann-time">{formatTime(a.ts)}</span>
                {isAdmin && (
                  <button className="delete-btn" onClick={() => deleteAnnouncement(a.id)} aria-label="删除这条公告">
                    ✕
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              <div className="ann-compose-bar">
                <button className="ann-compose-btn" onClick={() => setShowAnnCompose(true)}>
                  + 发布公告
                </button>
              </div>
            )}
          </div>
        )}

        <div className="stats-row">
          <span>{loading ? '加载中…' : `目前 ${posts.length} 张便条`}</span>
          <span className="dot" />
          <span>大家都能看到这面墙</span>
        </div>

        <div className="sort-row">
          <button
            className={`sort-opt ${sortMode === 'new' ? 'active' : ''}`}
            onClick={() => {
              setSortMode('new');
              setVisibleCount(PAGE_SIZE);
            }}
          >
            🕓 最新
          </button>
          <button
            className={`sort-opt ${sortMode === 'hot' ? 'active' : ''}`}
            onClick={() => {
              setSortMode('hot');
              setVisibleCount(PAGE_SIZE);
            }}
          >
            🔥 最热
          </button>
        </div>

        <div className="search-row">
          <div className="search-input-wrap">
            <input
              className="search-input"
              type="text"
              placeholder="🔍 搜索便条内容或名字…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => {
                  setSearchQuery('');
                  setVisibleCount(PAGE_SIZE);
                }}
                aria-label="清除搜索"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        {q && !loading && (
          <div className="search-result-note">
            找到 {filteredPosts.length} 条包含「{searchQuery.trim()}」的便条
          </div>
        )}

        <div className="compose-bar">
          <button className="compose-btn" onClick={() => setShowCompose(true)}>
            ✎ 写一张便条
          </button>
        </div>

        <div className="wall">
          {loading ? (
            <div className="loading-msg">正在把墙上的便条找出来…</div>
          ) : filteredPosts.length === 0 ? (
            <div className="empty-state">
              {q ? (
                <>没有找到相关的便条 —<br />换个关键词试试。</>
              ) : (
                <>
                  这面墙还空空的 —<br />
                  做第一个贴便条的人吧。
                </>
              )}
            </div>
          ) : (
            visiblePosts.map((p) => {
              const h = hashStr(p.id);
              const rotation = ((h % 7) - 3) * 0.9;
              const paper = PAPER_COLORS[h % PAPER_COLORS.length];
              const pin = PIN_COLORS[(h >> 3) % PIN_COLORS.length];
              const liked = likedIds.includes(p.id);
              const replies = p.replies || [];
              const isOpen = Boolean(openReplies[p.id]);
              const draft = replyDrafts[p.id] || { text: '', anon: true, name: '', submitting: false, error: '' };

              return (
                <div
                  key={p.id}
                  className={`note ${p.isAdminPost ? 'admin-post' : ''}`}
                  style={{ background: `var(--${paper})`, transform: `rotate(${rotation.toFixed(2)}deg)` }}
                >
                  <div className="pin" style={{ background: `var(--${pin})` }} />
                  {isAdmin && (
                    <button className="delete-btn" onClick={() => deletePost(p.id)} aria-label="删除这张便条">
                      ✕
                    </button>
                  )}
                  <div className="note-head">
                    <span className={`note-author ${p.anonymous ? 'anon' : ''} ${p.isAdminPost ? 'gold' : ''}`}>
                      {p.isAdminPost && <span className="admin-crown">👑</span>}
                      {p.anonymous ? '匿名同学' : p.name || '匿名同学'}
                    </span>
                    <span className="note-time">{formatTime(p.ts)}</span>
                  </div>
                  {p.text && <div className="note-text">{p.text}</div>}
                  {p.image && (
                    <div className="note-img-wrap">
                      <div className="tape-corner" />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt="投稿图片" loading="lazy" />
                    </div>
                  )}
                  <div className="note-footer">
                    <button className={`like-btn ${liked ? 'liked' : ''}`} onClick={() => toggleLike(p.id)}>
                      <span className="heart">{liked ? '❤️' : '🤍'}</span>
                      <span className="like-count">{p.likes || 0}</span>
                    </button>
                    <button className="reply-toggle" onClick={() => toggleReplies(p.id)}>
                      💬 {replies.length > 0 ? `${replies.length} 条回复` : '回复'}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="reply-section">
                      {replies.length === 0 ? (
                        <div className="reply-empty">还没有人回复，来说第一句吧。</div>
                      ) : (
                        replies
                          .slice()
                          .sort((a, b) => a.ts - b.ts)
                          .map((r) => (
                            <div className="reply-item" key={r.id}>
                              <span className={`reply-author ${r.anonymous ? 'anon' : ''}`}>
                                {r.anonymous ? '匿名同学' : r.name || '匿名同学'}
                              </span>
                              <span>{r.text}</span>
                              <span className="reply-time">{formatTime(r.ts)}</span>
                              {isAdmin && (
                                <button
                                  className="reply-delete"
                                  onClick={() => deleteReply(p.id, r.id)}
                                  aria-label="删除这条回复"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          ))
                      )}

                      <div className="reply-form">
                        <div className="reply-form-row">
                          <div className="reply-mini-toggle">
                            <button
                              type="button"
                              className={`reply-mini-opt ${draft.anon ? 'active' : ''}`}
                              onClick={() => updateReplyDraft(p.id, { anon: true })}
                            >
                              匿名
                            </button>
                            <button
                              type="button"
                              className={`reply-mini-opt ${!draft.anon ? 'active' : ''}`}
                              onClick={() => updateReplyDraft(p.id, { anon: false })}
                            >
                              实名
                            </button>
                          </div>
                          {!draft.anon && (
                            <input
                              className="reply-name-input"
                              type="text"
                              maxLength={24}
                              placeholder="你的名字"
                              value={draft.name}
                              onChange={(e) => updateReplyDraft(p.id, { name: e.target.value })}
                            />
                          )}
                        </div>
                        <div className="reply-form-row">
                          <input
                            className="reply-text-input"
                            type="text"
                            maxLength={200}
                            placeholder="写句回复…"
                            value={draft.text}
                            onChange={(e) => updateReplyDraft(p.id, { text: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && submitReply(p.id)}
                          />
                          <button
                            className="reply-send-btn"
                            disabled={draft.submitting}
                            onClick={() => submitReply(p.id)}
                          >
                            {draft.submitting ? '发送中…' : '发送'}
                          </button>
                        </div>
                        {draft.error && <div className="reply-form-error">{draft.error}</div>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {!loading && hasMore && (
          <div className="load-more-bar">
            <button className="load-more-btn" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
              加载更多（还有 {filteredPosts.length - visiblePosts.length} 张）
            </button>
          </div>
        )}
      </div>

      {showCompose && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeCompose()}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="close-btn" onClick={closeCompose} aria-label="关闭">
              ✕
            </button>
            <h2 id="modal-title">写一张便条</h2>

            <div className="toggle-row" role="group" aria-label="署名方式">
              <button
                type="button"
                className={`toggle-opt ${isAnon ? 'active' : ''}`}
                onClick={() => setIsAnon(true)}
              >
                匿名
              </button>
              <button
                type="button"
                className={`toggle-opt ${!isAnon ? 'active' : ''}`}
                onClick={() => setIsAnon(false)}
              >
                实名
              </button>
            </div>

            {!isAnon && (
              <div>
                <label className="field-label" htmlFor="name-input">
                  你的名字
                </label>
                <input
                  id="name-input"
                  type="text"
                  maxLength={24}
                  placeholder="例如：5A 小明"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <label className="field-label" htmlFor="text-input">
              内容
            </label>
            <textarea
              id="text-input"
              maxLength={600}
              placeholder="想说什么就写下来吧…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <label className="field-label">图片（可选）</label>
            {pendingImage ? (
              <div className="img-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage} alt="预览图" />
                <button
                  type="button"
                  className="img-remove"
                  aria-label="移除图片"
                  onClick={() => {
                    setPendingImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="img-upload-btn">
                📎 选择图片
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />
              </label>
            )}

            <div className="form-error">{formError}</div>

            {isAdmin && (
              <div className="admin-post-toggle-row">
                <label htmlFor="post-as-admin">
                  <input
                    id="post-as-admin"
                    type="checkbox"
                    checked={postAsAdmin}
                    onChange={(e) => setPostAsAdmin(e.target.checked)}
                  />
                  👑 以管理员身份发布（金色边框标识）
                </label>
              </div>
            )}

            <button className="submit-btn" onClick={submitPost} disabled={submitting}>
              {submitting ? '贴上中…' : '贴上墙'}
            </button>
            <div className="form-note">
              内容会公开显示在这面墙上，请勿上传他人隐私信息或不当内容。恶意信息将会被删除。
            </div>
          </div>
        </div>
      )}

      {showAdmin && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowAdmin(false)}
        >
          <div className="modal narrow" role="dialog" aria-modal="true" aria-labelledby="admin-title">
            <button className="close-btn" onClick={() => setShowAdmin(false)} aria-label="关闭">
              ✕
            </button>
            <h2 id="admin-title">管理员登入</h2>
            <label className="field-label" htmlFor="admin-pass">
              密码
            </label>
            <input
              id="admin-pass"
              type="password"
              placeholder="输入管理密码"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && tryAdminLogin()}
            />
            <div className="form-error">{adminError}</div>
            <button className="submit-btn" onClick={tryAdminLogin}>
              登入
            </button>
          </div>
        </div>
      )}

      {showAnnCompose && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && setShowAnnCompose(false)}
        >
          <div className="modal narrow" role="dialog" aria-modal="true" aria-labelledby="ann-title">
            <button className="close-btn" onClick={() => setShowAnnCompose(false)} aria-label="关闭">
              ✕
            </button>
            <h2 id="ann-title">发布公告</h2>
            <label className="field-label" htmlFor="ann-text">
              公告内容
            </label>
            <textarea
              id="ann-text"
              maxLength={300}
              placeholder="写点大家都需要知道的事…"
              value={annText}
              onChange={(e) => setAnnText(e.target.value)}
            />
            <div className="form-error">{annError}</div>
            <button className="submit-btn" onClick={submitAnnouncement} disabled={annSubmitting}>
              {annSubmitting ? '发布中…' : '发布公告'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

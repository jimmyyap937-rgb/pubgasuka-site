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

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminPasscode, setAdminPasscode] = useState(''); // held client-side only after successful check
  const isAdmin = Boolean(adminPasscode);

  const fileInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LIKED_KEY);
      setLikedIds(raw ? JSON.parse(raw) : []);
    } catch (e) {
      setLikedIds([]);
    }
    loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '读取失败');
      setPosts(data.posts || []);
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
      // revert on failure
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonymous: isAnon,
          name: cleanName,
          text: cleanText,
          image: pendingImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setPosts((prev) => [data.post, ...prev]);
      closeCompose();
    } catch (err) {
      setFormError(err.message || '保存失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  }

  function tryAdminLogin() {
    // We don't have a dedicated "verify" endpoint; the passcode is checked
    // for real on the server the moment you actually delete something.
    // Do a lightweight self-test: attempt a DELETE on a fake id to confirm
    // the passcode itself before unlocking the UI.
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
        // 404 (not found) or 200 both mean the passcode was accepted.
        setAdminPasscode(adminPass);
        setShowAdmin(false);
        setAdminPass('');
      })
      .catch(() => setAdminError('网络错误，请稍后重试。'));
  }

  function logoutAdmin() {
    setAdminPasscode('');
  }

  const sortedPosts = [...posts].sort((a, b) =>
    sortMode === 'hot' ? (b.likes || 0) - (a.likes || 0) || b.ts - a.ts : b.ts - a.ts
  );

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
            <div className="desc">作者：asuka 管理员：johang。</div>
          </div>
        </div>

        <div className="stats-row">
          <span>{loading ? '加载中…' : `目前 ${posts.length} 张便条`}</span>
          <span className="dot" />
          <span>公益网站</span>
        </div>

        <div className="sort-row">
          <button
            className={`sort-opt ${sortMode === 'new' ? 'active' : ''}`}
            onClick={() => setSortMode('new')}
          >
            🕓 最新
          </button>
          <button
            className={`sort-opt ${sortMode === 'hot' ? 'active' : ''}`}
            onClick={() => setSortMode('hot')}
          >
            🔥 最热
          </button>
        </div>

        <div className="compose-bar">
          <button className="compose-btn" onClick={() => setShowCompose(true)}>
            ✎ 写一张便条
          </button>
        </div>

        <div className="wall">
          {loading ? (
            <div className="loading-msg">正在把墙上的便条找出来…</div>
          ) : sortedPosts.length === 0 ? (
            <div className="empty-state">
              这面墙还空空的 —<br />
              做第一个贴便条的人吧。
            </div>
          ) : (
            sortedPosts.map((p) => {
              const h = hashStr(p.id);
              const rotation = ((h % 7) - 3) * 0.9;
              const paper = PAPER_COLORS[h % PAPER_COLORS.length];
              const pin = PIN_COLORS[(h >> 3) % PIN_COLORS.length];
              const liked = likedIds.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="note"
                  style={{ background: `var(--${paper})`, transform: `rotate(${rotation.toFixed(2)}deg)` }}
                >
                  <div className="pin" style={{ background: `var(--${pin})` }} />
                  {isAdmin && (
                    <button className="delete-btn" onClick={() => deletePost(p.id)} aria-label="删除这张便条">
                      ✕
                    </button>
                  )}
                  <div className="note-head">
                    <span className={`note-author ${p.anonymous ? 'anon' : ''}`}>
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
                  </div>
                </div>
              );
            })
          )}
        </div>
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
    </div>
  );
}

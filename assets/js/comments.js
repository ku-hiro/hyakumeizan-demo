(function () {
  const TABLE_ID = "myTable";
  const SEARCH_ID = "mountainSearch"; // 既にある検索input
  const POSTS_WRAP_ID = "postsWrap";
  const POSTS_META_ID = "postsMeta";
  const POST_FORM_ID = "postForm";
  const MOUNTAIN_SELECT_ID = "postMountain";
  const TURNSTILE_CONTAINER_ID = "turnstileBox";

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function getRows() {
    const table = document.getElementById(TABLE_ID);
    if (!table || !table.tBodies[0]) return [];
    return Array.from(table.tBodies[0].rows);
  }

  // 各行から mountain_id / mountain_name を抽出（画像のパスからフォルダ名を取る）
  function extractMountainFromRow(tr) {
    const name = (tr.cells[0]?.textContent || "").trim();

    // 4列目(全景)の a[href="images/xx_山名/..."] を拾う
    const a = tr.cells[3]?.querySelector("a[href^='images/']");
    if (!a) return { id: "", name };

    // href 例: images/09_塩見岳/siomidake_001.jpg
    const href = a.getAttribute("href") || "";
    const parts = href.split("/");
    const folder = parts.length >= 2 ? parts[1] : "";
    // URLエンコードされてる可能性を考慮
    const id = safeDecode(folder);
    return { id, name };
  }

  function safeDecode(s) {
    try { return decodeURIComponent(s); } catch { return s; }
  }

  // 検索結果が「1件だけ」なら、その山に投稿一覧を自動追従（ハイブリッド）
  function getSingleVisibleMountain() {
    const rows = getRows();
    const visible = rows.filter(r => r.style.display !== "none");
    if (visible.length !== 1) return null;
    const m = extractMountainFromRow(visible[0]);
    if (!m.id) return null;
    return m;
  }

  async function fetchPosts(mountainIdOrNull) {
    const url = mountainIdOrNull
      ? `/api/posts?mountain_id=${encodeURIComponent(mountainIdOrNull)}&limit=50`
      : `/api/posts?limit=50`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "fetch failed");
    return data.results || [];
  }

  function renderPosts(list, mountainLabel) {
    const wrap = qs(`#${POSTS_WRAP_ID}`);
    const meta = qs(`#${POSTS_META_ID}`);
    if (!wrap || !meta) return;

    meta.textContent = mountainLabel
      ? `表示中：${mountainLabel} の投稿（${list.length}件）`
      : `表示中：みんなの投稿（最新${list.length}件）`;

    wrap.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "post-empty";
      empty.textContent = "まだ投稿がありません。最初の投稿をどうぞ。";
      wrap.appendChild(empty);
      return;
    }

    for (const p of list) {
      const card = document.createElement("div");
      card.className = "post-card";

      const head = document.createElement("div");
      head.className = "post-head";

      const tag = document.createElement("span");
      tag.className = "post-tag";
      tag.textContent = `#${p.mountain_name}`;

      const time = document.createElement("span");
      time.className = "post-time";
      time.textContent = p.created_at ? p.created_at.replace("T", " ").slice(0, 16) : "";

      head.appendChild(tag);
      head.appendChild(time);

      const body = document.createElement("div");
      body.className = "post-body";
      body.textContent = p.body || ""; // textContentでXSS対策

      const foot = document.createElement("div");
      foot.className = "post-foot";
      foot.textContent = p.author ? `by ${p.author}` : "";

      card.appendChild(head);
      card.appendChild(body);
      if (p.author) card.appendChild(foot);

      wrap.appendChild(card);
    }
  }

  function buildMountainOptions() {
    const select = qs(`#${MOUNTAIN_SELECT_ID}`);
    if (!select) return;

    const rows = getRows();
    const list = [];
    const seen = new Set();

    for (const tr of rows) {
      const m = extractMountainFromRow(tr);
      if (!m.id || seen.has(m.id)) continue;
      seen.add(m.id);
      list.push(m);
    }

    // 表示名で並べる（そのまま100座の順にしたいなら sortを外す）
    // list.sort((a,b)=>a.name.localeCompare(b.name, "ja"));

    select.innerHTML = `<option value="">（山を選択）</option>`;
    for (const m of list) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      select.appendChild(opt);
    }
  }

  function setSelectByMountain(m) {
    const select = qs(`#${MOUNTAIN_SELECT_ID}`);
    if (!select || !m) return;
    select.value = m.id;
  }

  async function refreshPostsByCurrentState() {
    const single = getSingleVisibleMountain();
    if (single) {
      const list = await fetchPosts(single.id);
      renderPosts(list, single.name);
      setSelectByMountain(single);
    } else {
      const list = await fetchPosts(null);
      renderPosts(list, "");
    }
  }

  // Turnstileの描画（明示レンダリング）
  function renderTurnstile() {
    const siteKey = document.documentElement.getAttribute("data-turnstile-sitekey") || "";
    const box = qs(`#${TURNSTILE_CONTAINER_ID}`);
    if (!siteKey || !box) return;

    // すでに描画済みなら何もしない
    if (box.dataset.rendered === "1") return;

    if (window.turnstile && typeof window.turnstile.render === "function") {
      window.turnstile.render(box, { sitekey: siteKey });
      box.dataset.rendered = "1";
    }
  }

  async function submitPost(e) {
    e.preventDefault();

    const select = qs(`#${MOUNTAIN_SELECT_ID}`);
    const author = qs(`#${POST_FORM_ID} input[name='author']`);
    const body = qs(`#${POST_FORM_ID} textarea[name='body']`);

    const mountainId = (select?.value || "").trim();
    const mountainName = (select?.selectedOptions?.[0]?.textContent || "").trim();

    if (!mountainId) return alert("山を選択してください");
    if (!body || !body.value.trim()) return alert("本文を入力してください");

    // Turnstile token取得
    let token = "";
    try {
      // turnstileはレンダー後に hidden input を自動生成する
      const hidden = qs("input[name='cf-turnstile-response']");
      token = hidden ? hidden.value : "";
    } catch {}

    if (!token) return alert("スパム対策チェック（Turnstile）が完了していないようです。少し待ってください。");

    const payload = {
      mountain_id: mountainId,
      mountain_name: mountainName,
      author: author?.value?.trim() || "",
      body: body.value.trim(),
      turnstileToken: token,
    };

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      alert(`投稿に失敗しました：${data.error || "unknown"}`);
      return;
    }

    body.value = "";
    if (author) author.value = author.value; // そのまま残す（好みで消してOK）

    // 投稿後、今の表示状態（全体 or 絞り込み）に合わせて再読み込み
    await refreshPostsByCurrentState();

    // tokenは使い捨てなので、再レンダー（簡易にリロード）
    location.reload();
  }

  window.addEventListener("DOMContentLoaded", async function () {
    buildMountainOptions();

    // Turnstile scriptロード後にrender
    renderTurnstile();
    // 念のため少し遅延でもう一回
    setTimeout(renderTurnstile, 300);

    // 初期表示
    await refreshPostsByCurrentState();

    // 検索入力が変わったら（テーブル側の絞り込み後に）投稿を追従
    const search = document.getElementById(SEARCH_ID);
    if (search) {
      search.addEventListener("input", async () => {
        // テーブルが絞られる処理とタイミングがズレるので、少し待つ
        setTimeout(() => refreshPostsByCurrentState(), 50);
      });
    }

    // 山選択を変えたら、その山に固定して投稿だけ絞る（検索と独立でも使える）
    const select = document.getElementById(MOUNTAIN_SELECT_ID);
    if (select) {
      select.addEventListener("change", async () => {
        const id = (select.value || "").trim();
        if (!id) return refreshPostsByCurrentState();
        const name = select.selectedOptions[0]?.textContent || "";
        const list = await fetchPosts(id);
        renderPosts(list, name);
      });
    }

    const form = document.getElementById(POST_FORM_ID);
    if (form) form.addEventListener("submit", submitPost);
  });
})();

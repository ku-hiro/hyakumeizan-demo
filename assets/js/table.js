        var dir = "asc";

        // ★都道府県の並び順（あなた指定の順番）
        var prefList = [
            "北海道",
            "青森", "秋田", "岩手", "山形", "宮城", "福島",
            "群馬", "栃木", "茨城", "埼玉", "東京", "千葉", "神奈川",
            "山梨", "長野", "新潟",
            "静岡", "愛知", "岐阜", "三重",
            "富山", "石川", "福井",
            "和歌山", "滋賀", "奈良", "京都", "大阪", "兵庫",
            "岡山", "広島", "鳥取", "島根", "山口",
            "徳島", "愛媛", "香川", "高知",
            "福岡", "佐賀", "長崎", "大分", "熊本", "宮崎", "鹿児島", "沖縄"
        ];

        // ★prefList から prefRank（県名→順位）を自動生成
        var prefRank = {};
        for (var i = 0; i < prefList.length; i++) {
            prefRank[prefList[i]] = i + 1;
        }

        // 表記ゆれ吸収：東京都/大阪府/静岡県 → 東京/大阪/静岡（北海道はそのまま）
        function normalizePrefName(s) {
            s = (s || "").trim();
            if (s.indexOf("北海道") !== -1) return "北海道";
            return s.replace(/[都府県]/g, "").trim();
        }

        // 地域セルの「最初に書かれた県」を取り出す（例：山梨/静岡 → 山梨）
        function getFirstPref(regionText) {
            var txt = (regionText || "").trim();
            if (!txt) return "";
            var parts = txt.split(/[\/、,・\s]+/).map(normalizePrefName).filter(Boolean);
            return parts.length ? parts[0] : "";
        }

        function getPrefRankKey(regionText) {
            var pref = getFirstPref(regionText);
            return prefRank[pref] || 999;
        }

        function sortTable(columnIndex) {
            var table = document.getElementById("myTable");
            var rows = Array.from(table.tBodies[0].rows);

            if (columnIndex === 1) {
                // 標高：数値ソート
                rows.sort(function(a, b) {
                    var x = parseFloat(a.cells[columnIndex].textContent);
                    var y = parseFloat(b.cells[columnIndex].textContent);
                    return dir === "asc" ? x - y : y - x;
                });
            } else if (columnIndex === 2) {
                // 地域：都道府県順位（最初の県）でソート
                rows.sort(function(a, b) {
                    var ax = a.cells[columnIndex].textContent.trim();
                    var bx = b.cells[columnIndex].textContent.trim();

                    var ra = getPrefRankKey(ax);
                    var rb = getPrefRankKey(bx);

                    if (ra !== rb) return dir === "asc" ? ra - rb : rb - ra;

                    return dir === "asc"
                        ? ax.localeCompare(bx, "ja")
                        : bx.localeCompare(ax, "ja");
                });
            }

            rows.forEach(function(r) {
                table.tBodies[0].appendChild(r);
            });

            // ▼▲ 表示（元の三角印制御の考え方）
            var th = document.querySelector('.sortable[data-column="' + columnIndex + '"]');
            th.classList.toggle("ascending", dir === "asc");
            th.classList.toggle("descending", dir === "desc");

            dir = dir === "asc" ? "desc" : "asc";
        }

// ===== 季節クラスを自動で付与（12-2冬 / 3-5春 / 6-8夏 / 9-11秋） =====
window.addEventListener("DOMContentLoaded", function() {
  var hero = document.getElementById("hero");
  if (!hero) return;

  var m = new Date().getMonth() + 1; // 1-12
  hero.classList.remove("season-winter","season-spring","season-summer","season-autumn");

  if (m === 12 || m === 1 || m === 2) hero.classList.add("season-winter");
  else if (m >= 3 && m <= 5) hero.classList.add("season-spring");
  else if (m >= 6 && m <= 8) hero.classList.add("season-summer");
  else hero.classList.add("season-autumn");
});

// ===== 山名検索（ライブ絞り込み + Enterで先頭へスクロール） =====
(function () {
  function norm(s) {
    return (s || "")
      .toString()
      .trim()
      .toLowerCase();
  }

  function getRows() {
    const tbody = document.querySelector("#myTable tbody");
    if (!tbody) return [];
    return Array.from(tbody.querySelectorAll("tr"));
  }

  function applyFilter(q) {
    const rows = getRows();
    const query = norm(q);

    let hit = 0;
    let firstHitRow = null;

    for (const tr of rows) {
      const nameCell = tr.cells && tr.cells[0] ? tr.cells[0].innerText : "";
      const nameText = norm(nameCell);

      const ok = !query || nameText.includes(query);
      tr.style.display = ok ? "" : "none";

      if (ok) {
        hit++;
        if (!firstHitRow) firstHitRow = tr;
      }
    }

    const meta = document.getElementById("searchMeta");
    if (meta) {
      const total = rows.length;
      meta.textContent = query ? `ヒット: ${hit}/${total}` : `全件: ${rows.length}`;
    }

    return { hit, firstHitRow };
  }

  function flashRow(tr) {
    if (!tr) return;
    tr.classList.remove("hit-flash");
    // 付け直しでアニメを確実に発火
    void tr.offsetWidth;
    tr.classList.add("hit-flash");
    setTimeout(() => tr.classList.remove("hit-flash"), 1200);
  }

  window.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("mountainSearch");
    const clearBtn = document.getElementById("searchClear");
    if (!input) return;

    // 初期表示
    applyFilter("");

    // 入力中はライブ絞り込み（軽いのでデバウンス不要）
    input.addEventListener("input", function () {
      applyFilter(input.value);
    });

    // Enterで「最初のヒットへスクロール＋ハイライト」
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      const { firstHitRow } = applyFilter(input.value);
      if (!firstHitRow) return;

      firstHitRow.scrollIntoView({ behavior: "smooth", block: "center" });
      flashRow(firstHitRow);
    });

    // クリア
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        input.value = "";
        const { firstHitRow } = applyFilter("");
        // クリア時はスクロールしない（うるさくなるので）
        if (firstHitRow) flashRow(firstHitRow); // ここは好みで消してOK
        input.focus();
      });
    }
  });
})();

// ===== 検索（山名フィルタ） =====
window.addEventListener("DOMContentLoaded", function () {
  const input = document.getElementById("mountainSearch");
  const clearBtn = document.getElementById("searchClear");
  const meta = document.getElementById("searchMeta");
  const table = document.getElementById("myTable");
  if (!input || !clearBtn || !meta || !table) return;

  const tbody = table.tBodies[0];
  const rows = Array.from(tbody.rows);

  function update() {
    const q = (input.value || "").trim().toLowerCase();
    let shown = 0;

    rows.forEach((tr) => {
      // 1列目（山名セル）
      const name = (tr.cells[0]?.textContent || "").trim().toLowerCase();

      const hit = q === "" || name.includes(q);

      tr.style.display = hit ? "" : "none";

      // ★ヒット行だけクラス付与（CSSで薄く強調できる）
      tr.classList.toggle("is-hit", hit);

      if (hit) shown++;
    });

    // ★右側の表示
    if (q === "") {
      meta.textContent = `ヒット: ${shown}/${rows.length}`;
    } else if (shown === 0) {
      meta.textContent = `該当する山はありません（0/${rows.length}）`;
    } else {
      meta.textContent = `ヒット: ${shown}/${rows.length}`;
    }
  }

  // 入力のたびに更新（Enter不要）
  input.addEventListener("input", update);

  // クリアボタン
  clearBtn.addEventListener("click", function () {
    input.value = "";
    input.focus();
    update();
  });

  // 初期表示
  update();
});

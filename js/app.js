/* ============================================================
   Encore — app controller
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var state = { search: "", sort: "soon" };

  var CURRENCY = { USD: "$", EUR: "€", GBP: "£", CAD: "$", AUD: "$" };
  var PLATFORM_COLORS = {
    "Ticketmaster": "linear-gradient(135deg,#0266ff,#00b3ff)",
    "StubHub":      "linear-gradient(135deg,#ff5a36,#ff9a36)",
    "SeatGeek":     "linear-gradient(135deg,#ff3b6b,#ff8a5b)",
    "Live Nation":  "linear-gradient(135deg,#7b2ff7,#b06bff)",
    "AXS":          "linear-gradient(135deg,#00c2a8,#4cc9ff)",
    "Vivid Seats":  "linear-gradient(135deg,#e63946,#ff6b6b)",
    "Other":        "linear-gradient(135deg,#8b45ff,#ff5da2)"
  };

  /* ---------------- formatting ---------------- */
  function money(v, cur) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var sym = CURRENCY[cur] || "$";
    return sym + Number(v).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function moneyDec(v, cur) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    var sym = CURRENCY[cur] || "$";
    return sym + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase();
  }
  function fmtDate(iso) {
    if (!iso) return "Date TBA";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d)) return "Date TBA";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function fmtDateTime(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  function platformColor(p) { return PLATFORM_COLORS[p] || PLATFORM_COLORS.Other; }

  /* ---------------- sparkline ---------------- */
  function sparkline(history, w, h, color) {
    w = w || 260; h = h || 46;
    if (!history || history.length < 2) {
      return "<svg class='spark' viewBox='0 0 " + w + " " + h + "' preserveAspectRatio='none'></svg>";
    }
    var vals = history.map(function (p) { return p.price; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var range = max - min || 1;
    var pad = 4;
    var stepX = (w - pad * 2) / (vals.length - 1);
    var pts = vals.map(function (v, i) {
      var x = pad + i * stepX;
      var y = pad + (h - pad * 2) * (1 - (v - min) / range);
      return [x, y];
    });
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + h + " L" + pts[0][0].toFixed(1) + " " + h + " Z";
    var gid = "g" + Math.random().toString(36).slice(2, 8);
    var last = pts[pts.length - 1];
    return "<svg class='spark' viewBox='0 0 " + w + " " + h + "' preserveAspectRatio='none'>" +
      "<defs><linearGradient id='" + gid + "' x1='0' y1='0' x2='0' y2='1'>" +
      "<stop offset='0' stop-color='" + color + "' stop-opacity='.35'/>" +
      "<stop offset='1' stop-color='" + color + "' stop-opacity='0'/></linearGradient></defs>" +
      "<path d='" + area + "' fill='url(#" + gid + ")'/>" +
      "<path d='" + line + "' fill='none' stroke='" + color + "' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/>" +
      "<circle cx='" + last[0].toFixed(1) + "' cy='" + last[1].toFixed(1) + "' r='3' fill='" + color + "'/>" +
      "</svg>";
  }

  /* Full detail chart with axis labels. */
  function bigChart(t) {
    var hist = t.history;
    var w = 600, h = 160, padL = 44, padR = 12, padT = 14, padB = 26;
    if (!hist || hist.length < 2) {
      return "<div class='chart' style='display:grid;place-items:center;color:var(--text-mute);font-size:.85rem;height:160px'>Log a couple of prices to see the trend.</div>";
    }
    var vals = hist.map(function (p) { return p.price; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (t.targetPrice !== null) { min = Math.min(min, t.targetPrice); max = Math.max(max, t.targetPrice); }
    var range = (max - min) || 1;
    min -= range * 0.12; max += range * 0.12; range = max - min;

    var innerW = w - padL - padR, innerH = h - padT - padB;
    var stepX = innerW / (hist.length - 1);
    function px(i) { return padL + i * stepX; }
    function py(v) { return padT + innerH * (1 - (v - min) / range); }

    var pts = vals.map(function (v, i) { return [px(i), py(v)]; });
    var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ");
    var area = line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (padT + innerH) + " L" + pts[0][0].toFixed(1) + " " + (padT + innerH) + " Z";

    var svg = "<svg class='chart' viewBox='0 0 " + w + " " + h + "' preserveAspectRatio='none'>";
    svg += "<defs><linearGradient id='cg' x1='0' y1='0' x2='0' y2='1'>" +
      "<stop offset='0' stop-color='var(--accent)' stop-opacity='.32'/>" +
      "<stop offset='1' stop-color='var(--accent)' stop-opacity='0'/></linearGradient></defs>";

    // gridlines + y labels
    for (var g = 0; g <= 3; g++) {
      var yv = min + (range * g / 3);
      var yy = py(yv);
      svg += "<line x1='" + padL + "' y1='" + yy.toFixed(1) + "' x2='" + (w - padR) + "' y2='" + yy.toFixed(1) +
        "' stroke='var(--border)' stroke-width='1'/>";
      svg += "<text x='" + (padL - 6) + "' y='" + (yy + 3).toFixed(1) + "' text-anchor='end' font-size='9' fill='var(--text-mute)'>" +
        money(Math.round(yv), t.currency) + "</text>";
    }
    // target line
    if (t.targetPrice !== null) {
      var ty = py(t.targetPrice);
      svg += "<line x1='" + padL + "' y1='" + ty.toFixed(1) + "' x2='" + (w - padR) + "' y2='" + ty.toFixed(1) +
        "' stroke='var(--ok)' stroke-width='1.4' stroke-dasharray='5 4'/>";
      svg += "<text x='" + (w - padR) + "' y='" + (ty - 4).toFixed(1) + "' text-anchor='end' font-size='9' fill='var(--ok)'>target</text>";
    }
    svg += "<path d='" + area + "' fill='url(#cg)'/>";
    svg += "<path d='" + line + "' fill='none' stroke='var(--accent)' stroke-width='2.2' stroke-linejoin='round' stroke-linecap='round'/>";
    pts.forEach(function (p) {
      svg += "<circle cx='" + p[0].toFixed(1) + "' cy='" + p[1].toFixed(1) + "' r='2.6' fill='var(--accent)'/>";
    });
    // x labels (first / mid / last)
    [0, Math.floor((hist.length - 1) / 2), hist.length - 1].forEach(function (i) {
      var d = new Date(hist[i].ts);
      var lbl = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      svg += "<text x='" + px(i).toFixed(1) + "' y='" + (h - 8) + "' text-anchor='middle' font-size='9' fill='var(--text-mute)'>" + lbl + "</text>";
    });
    svg += "</svg>";
    return svg;
  }

  /* ---------------- rendering ---------------- */
  function filtered() {
    var list = Store.all();
    var q = state.search.trim().toLowerCase();
    if (q) {
      list = list.filter(function (t) {
        return (t.artist + " " + t.venue + " " + t.city + " " + t.platform + " " + t.section)
          .toLowerCase().indexOf(q) !== -1;
      });
    }
    var s = state.sort;
    list.sort(function (a, b) {
      if (s === "soon") return (a.date || "9999").localeCompare(b.date || "9999");
      if (s === "added") return (b.createdAt || 0) - (a.createdAt || 0);
      if (s === "best") return dropPct(b) - dropPct(a);
      if (s === "target") return targetGap(a) - targetGap(b);
      return 0;
    });
    return list;
  }
  function dropPct(t) {
    var first = Store.firstPrice(t), cur = Store.currentPrice(t);
    if (first === null || cur === null || first === 0) return 0;
    return (first - cur) / first;
  }
  function targetGap(t) {
    var cur = Store.currentPrice(t);
    if (cur === null || t.targetPrice === null) return Infinity;
    return Math.max(0, cur - t.targetPrice);
  }

  function render() {
    var grid = $("#grid");
    var list = filtered();
    renderStats();

    if (!Store.all().length) {
      grid.innerHTML = "";
      $("#emptyState").hidden = false;
      return;
    }
    $("#emptyState").hidden = true;

    if (!list.length) {
      grid.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:var(--text-mute);padding:30px'>No trackers match “" + escapeHtml(state.search) + "”.</p>";
      return;
    }

    grid.innerHTML = list.map(cardHtml).join("");
    $$(".card", grid).forEach(function (el, i) {
      el.style.animationDelay = (i * 0.04) + "s";
      el.addEventListener("click", function () { openDetail(el.dataset.id); });
    });
  }

  function cardHtml(t) {
    var cur = Store.currentPrice(t);
    var delta = Store.delta(t);
    var status = Store.status(t);
    var color = status === "hit" ? "#37e0a0" : "var(--accent)";
    var deltaClass = delta < 0 ? "down" : delta > 0 ? "up" : "flat";
    var deltaArrow = delta < 0 ? "↓" : delta > 0 ? "↑" : "→";
    var pct = (function () {
      var first = Store.firstPrice(t);
      if (first && cur !== null && first !== 0) {
        var p = Math.round((cur - first) / first * 100);
        return (p > 0 ? "+" : "") + p + "%";
      }
      return "";
    })();

    var statusPill = {
      hit:   "<span class='status-pill status-pill--hit'>✓ Target hit</span>",
      close: "<span class='status-pill status-pill--close'>Near target</span>",
      watch: "<span class='status-pill status-pill--watch'>Watching</span>"
    }[status];

    return "<article class='card' data-id='" + t.id + "'>" +
      "<div class='card__glow' style='background:radial-gradient(120% 80% at 50% -10%," +
        "color-mix(in oklab,var(--accent) 18%,transparent),transparent)'></div>" +
      "<div class='card__top'>" +
        "<div class='card__badge' style='background:" + platformColor(t.platform) + "'>" + escapeHtml(initials(t.artist)) + "</div>" +
        "<div class='card__head'>" +
          "<div class='card__artist'>" + escapeHtml(t.artist) + "</div>" +
          "<div class='card__meta'>" +
            iconCal() + fmtDate(t.date) +
          "</div>" +
          "<div class='card__meta'>" +
            iconPin() + escapeHtml(t.venue || t.city || "Venue TBA") +
          "</div>" +
        "</div>" +
      "</div>" +
      "<div class='card__price'>" +
        "<div>" +
          "<div class='price__label'>Current price</div>" +
          "<div class='price__now'>" + money(cur, t.currency) + "</div>" +
        "</div>" +
        (delta !== 0 || pct ?
          "<div class='delta delta--" + deltaClass + "'>" + deltaArrow + " " +
          (pct || money(Math.abs(delta), t.currency)) + "</div>" : "") +
      "</div>" +
      sparkline(t.history, 300, 46, color) +
      "<div class='card__foot'>" +
        "<span class='target'>" + iconTarget() + "Target <b>" + money(t.targetPrice, t.currency) + "</b></span>" +
        statusPill +
      "</div>" +
      "<div class='card__meta' style='padding:0 16px 12px'>" +
        "<span class='chip'>" + escapeHtml(t.platform) + "</span>" +
        (t.section ? "<span class='chip'>" + escapeHtml(t.section) + "</span>" : "") +
      "</div>" +
    "</article>";
  }

  function renderStats() {
    var all = Store.all();
    var tracked = all.length;
    var hits = all.filter(function (t) { return Store.status(t) === "hit"; }).length;
    var savings = all.reduce(function (sum, t) {
      var first = Store.firstPrice(t), cur = Store.currentPrice(t);
      if (first !== null && cur !== null && cur < first) return sum + (first - cur);
      return sum;
    }, 0);
    var cur = all.length ? all[0].currency : "USD";

    $("#stats").innerHTML =
      statTile(tracked, "Tracking", false) +
      statTile(hits, "At target", true) +
      statTile(money(Math.round(savings), cur), "Tracked drop", true);
  }
  function statTile(num, label, grad) {
    return "<div class='stat'><div class='stat__num" + (grad ? " grad" : "") + "'>" + num + "</div>" +
      "<div class='stat__label'>" + label + "</div></div>";
  }

  /* ---------------- detail view ---------------- */
  var currentDetailId = null;

  function openDetail(id) {
    var t = Store.get(id);
    if (!t) return;
    currentDetailId = id;
    $("#detailTitle").textContent = t.artist;

    var cur = Store.currentPrice(t);
    var low = Store.lowestPrice(t);
    var first = Store.firstPrice(t);
    var changeTxt = "";
    if (first !== null && cur !== null && first !== 0) {
      var p = Math.round((cur - first) / first * 100);
      changeTxt = (p > 0 ? "+" : "") + p + "% since tracking";
    }

    var body = $("#detailBody");
    body.innerHTML =
      "<div class='detail__hero'>" +
        "<div class='detail__badge' style='background:" + platformColor(t.platform) + "'>" + escapeHtml(initials(t.artist)) + "</div>" +
        "<div class='detail__title'>" +
          "<h4>" + escapeHtml(t.artist) + "</h4>" +
          "<p>" + fmtDate(t.date) + " · " + escapeHtml(t.venue || "Venue TBA") +
          (t.city ? " · " + escapeHtml(t.city) : "") + "</p>" +
        "</div>" +
      "</div>" +

      "<div class='detail__pricerow'>" +
        pricecard("Current", money(cur, t.currency), changeTxt) +
        pricecard("Lowest seen", money(low, t.currency), "") +
        pricecard("Your target", money(t.targetPrice, t.currency),
          (cur !== null && t.targetPrice !== null ?
            (cur <= t.targetPrice ? "Reached ✓" : money(cur - t.targetPrice, t.currency) + " to go") : "")) +
      "</div>" +

      "<div class='chart-wrap'><h5>Price history</h5>" + bigChart(t) + "</div>" +

      "<div class='detail__facts'>" +
        fact("Platform", escapeHtml(t.platform)) +
        fact("Seats / Section", escapeHtml(t.section || "—")) +
        fact("Location", escapeHtml(t.city || t.venue || "—")) +
        fact("Data points", String(t.history.length)) +
        (t.url ? "<div class='fact' style='grid-column:1/-1'><span>Listing</span><b><a href='" +
          escapeAttr(t.url) + "' target='_blank' rel='noopener'>" + escapeHtml(t.url) + "</a></b></div>" : "") +
      "</div>" +

      "<div class='logprice'>" +
        "<input id='logInput' type='number' min='0' step='0.01' inputmode='decimal' placeholder='Log a new price you saw…' />" +
        "<button class='btn btn--primary' id='logBtn'>Add</button>" +
      "</div>" +

      historyHtml(t) +

      "<div class='detail__actions'>" +
        "<button class='btn btn--ghost' id='editTrackerBtn'>Edit details</button>" +
        "<button class='btn btn--danger' id='deleteTrackerBtn'>Delete</button>" +
      "</div>";

    // wire detail actions
    $("#logBtn").addEventListener("click", function () {
      var val = parseFloat($("#logInput").value);
      if (isNaN(val) || val < 0) { toast("Enter a valid price.", "default"); return; }
      var res = Store.logPrice(id, val);
      $("#logInput").value = "";
      if (res && res.crossedTarget) {
        handleTargetHit(res.tracker, val);
      } else {
        toast("Price logged.", "success");
      }
      openDetail(id); // refresh
      render();
    });
    $("#logInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); $("#logBtn").click(); }
    });
    $("#editTrackerBtn").addEventListener("click", function () {
      closeModal($("#detailModal"));
      openEditor(id);
    });
    $("#deleteTrackerBtn").addEventListener("click", function () {
      if (confirm("Delete this tracker and its price history?")) {
        Store.remove(id);
        closeModal($("#detailModal"));
        toast("Tracker deleted.", "default");
        render();
      }
    });

    openModal($("#detailModal"));
  }

  function pricecard(label, value, sub) {
    return "<div class='pricecard'><span>" + label + "</span><b>" + value + "</b>" +
      (sub ? "<span style='text-transform:none;letter-spacing:0;color:var(--text-dim)'>" + sub + "</span>" : "") + "</div>";
  }
  function fact(label, value) {
    return "<div class='fact'><span>" + label + "</span><b>" + value + "</b></div>";
  }
  function historyHtml(t) {
    if (!t.history || !t.history.length) return "";
    var rows = t.history.slice().reverse().map(function (h, i, arr) {
      var next = arr[i + 1];
      var trend = "";
      if (next) {
        var d = h.price - next.price;
        if (d < 0) trend = "<span style='color:var(--down)'>↓ " + moneyDec(Math.abs(d), t.currency) + "</span>";
        else if (d > 0) trend = "<span style='color:var(--up)'>↑ " + moneyDec(d, t.currency) + "</span>";
      }
      return "<div class='hrow'>" +
        "<span class='hrow__date'>" + fmtDateTime(h.ts) + " · " + escapeHtml(h.platform || t.platform) + "</span>" +
        "<span class='hrow__price'>" + moneyDec(h.price, t.currency) + " " + trend + "</span>" +
      "</div>";
    }).join("");
    return "<div class='history'><h5>Log</h5><div class='history__list'>" + rows + "</div></div>";
  }

  /* ---------------- editor ---------------- */
  function openEditor(id) {
    var form = $("#editorForm");
    form.reset();
    if (id) {
      var t = Store.get(id);
      if (!t) return;
      $("#editorTitle").textContent = "Edit tracker";
      $("#f_id").value = t.id;
      $("#f_artist").value = t.artist;
      $("#f_date").value = t.date;
      $("#f_platform").value = t.platform;
      $("#f_venue").value = t.venue;
      $("#f_city").value = t.city;
      $("#f_section").value = t.section;
      $("#f_currency").value = t.currency;
      $("#f_current").value = Store.currentPrice(t) !== null ? Store.currentPrice(t) : "";
      $("#f_target").value = t.targetPrice !== null ? t.targetPrice : "";
      $("#f_url").value = t.url || "";
    } else {
      $("#editorTitle").textContent = "Track a concert";
      $("#f_id").value = "";
    }
    openModal($("#editorModal"));
    setTimeout(function () { $("#f_artist").focus(); }, 120);
  }

  function submitEditor(e) {
    e.preventDefault();
    var id = $("#f_id").value;
    var data = {
      artist: $("#f_artist").value.trim(),
      date: $("#f_date").value,
      platform: $("#f_platform").value,
      venue: $("#f_venue").value.trim(),
      city: $("#f_city").value.trim(),
      section: $("#f_section").value.trim(),
      currency: $("#f_currency").value,
      currentPrice: $("#f_current").value,
      targetPrice: $("#f_target").value,
      url: $("#f_url").value.trim()
    };
    if (!data.artist) { toast("Give the concert a name.", "default"); return; }

    if (id) {
      var t = Store.update(id, data);
      toast("Tracker updated.", "success");
      // Check if the manual price update crossed the target.
      var cur = Store.currentPrice(t);
      if (t.targetPrice !== null && cur !== null && cur <= t.targetPrice) {
        // no notification spam on manual edit, just visual
      }
    } else {
      Store.add(data);
      toast("Now tracking " + data.artist + ".", "success");
    }
    closeModal($("#editorModal"));
    render();
  }

  /* ---------------- target hit handling ---------------- */
  function handleTargetHit(tracker, price) {
    toast("🎯 " + tracker.artist + " hit " + money(price, tracker.currency) + " — your target!", "alert", 6000);
    if (Notifier.permission() === "granted") {
      Notifier.priceAlert(tracker, price, money);
    }
  }

  /* ---------------- price update (manual + auto) ---------------- */
  /* One price-check pass. In a static PWA this is a market simulation; a real
     price feed would replace the random walk with a fetch and call
     Store.logPrice() the same way. `opts.silent` (used by auto-update)
     suppresses the "prices refreshed" toast but still fires target alerts. */
  function runPriceUpdate(opts) {
    opts = opts || {};
    var all = Store.all();
    if (!all.length) {
      if (!opts.silent) toast("Add a concert to track first.", "default");
      return { moved: 0, hitList: [] };
    }

    var hitList = [];
    var moved = 0;
    all.forEach(function (t) {
      var cur = Store.currentPrice(t);
      if (cur === null) return;
      // Gentle random walk, slightly biased downward (resale prices soften over time).
      var pct = (Math.random() * 0.09 - 0.055); // -5.5% .. +3.5%
      var next = Math.max(5, Math.round(cur * (1 + pct)));
      if (next === cur) next = cur - 1;
      var res = Store.logPrice(t.id, next);
      moved++;
      if (res && res.crossedTarget) hitList.push({ tracker: res.tracker, price: next });
    });

    setLastUpdated(Date.now());
    render();
    if (currentDetailId && !$("#detailModal").hidden) openDetail(currentDetailId);

    // Target alerts always fire, auto or manual.
    hitList.forEach(function (h) {
      if (Notifier.permission() === "granted") Notifier.priceAlert(h.tracker, h.price, money);
    });

    if (hitList.length) {
      var first = hitList[0];
      toast("🎯 " + (hitList.length === 1
        ? first.tracker.artist + " hit your target!"
        : hitList.length + " concerts hit their targets!"), "alert", 6000);
    } else if (!opts.silent) {
      toast("Prices refreshed across " + moved + " tracker" + (moved > 1 ? "s" : "") + ".", "success");
    }
    return { moved: moved, hitList: hitList };
  }

  function simulateRefresh() { runPriceUpdate({ silent: false }); }

  /* ---------------- auto-update ---------------- */
  var autoTimer = null;
  var tickTimer = null;
  var AUTO_OPTIONS = [
    { ms: 0, label: "Off" },
    { ms: 300000, label: "Every 5 minutes" },
    { ms: 900000, label: "Every 15 minutes" },
    { ms: 1800000, label: "Every 30 minutes" },
    { ms: 3600000, label: "Every hour" }
  ];

  function getAutoInterval() { return Number(Store.settings().autoUpdate) || 0; }

  function setAutoInterval(ms) {
    var s = Store.settings();
    s.autoUpdate = ms;
    Store.saveSettings(s);
    applyAutoUpdate();
    if (ms > 0) {
      toast("Auto-update on · " + relativeInterval(ms) + ".", "success");
      // Prompt for notifications so alerts can reach the user.
      if (Notifier.permission() === "default") enableNotifications();
    } else {
      toast("Auto-update turned off.", "default");
    }
  }

  function applyAutoUpdate() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    var ms = getAutoInterval();
    updateBar();
    if (ms > 0) {
      autoTimer = setInterval(function () { runPriceUpdate({ silent: true }); }, ms);
      // Catch up if it's been longer than the interval since the last check.
      var last = Store.settings().lastUpdated || 0;
      if (Date.now() - last > ms) {
        setTimeout(function () { runPriceUpdate({ silent: true }); }, 2500);
      }
    }
  }

  function setLastUpdated(ts) {
    var s = Store.settings();
    s.lastUpdated = ts;
    Store.saveSettings(s);
    updateBar();
  }

  function relativeInterval(ms) {
    if (ms >= 3600000) return "every hour";
    return "every " + Math.round(ms / 60000) + " min";
  }

  function relativeTime(ts) {
    if (!ts) return "not yet";
    var s = Math.round((Date.now() - ts) / 1000);
    if (s < 45) return "just now";
    if (s < 90) return "1 min ago";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 5400) return "1 hour ago";
    if (s < 86400) return Math.round(s / 3600) + " hours ago";
    return Math.round(s / 86400) + " days ago";
  }

  /* Live status line under the toolbar. */
  function updateBar() {
    var bar = $("#updateBar");
    if (!bar) return;
    var ms = getAutoInterval();
    var last = Store.settings().lastUpdated || 0;
    if (!Store.all().length) { bar.hidden = true; return; }
    bar.hidden = false;
    if (ms > 0) {
      bar.innerHTML =
        "<span class='dot'></span><b>Auto-updating</b> · " + relativeInterval(ms) +
        " · <span class='muted'>checked " + relativeTime(last) + "</span>";
      bar.classList.add("on");
    } else {
      bar.classList.remove("on");
      bar.innerHTML = last
        ? "<span class='muted'>Prices checked " + relativeTime(last) + " · turn on auto-update in settings ⚙</span>"
        : "<span class='muted'>Tip: turn on auto-update in settings to check prices automatically ⚙</span>";
    }
  }

  /* ---------------- notifications UI ---------------- */
  function refreshNotifState() {
    var perm = Notifier.permission();
    var banner = $("#notifBanner");
    var status = $("#notifStatus");
    var settingsBtn = $("#settingsNotif");
    var dismissed = Store.settings().notifDismissed;

    if (perm === "granted") {
      banner.hidden = true;
      status.textContent = "Alerts are on — you'll be notified when a target is hit.";
      settingsBtn.textContent = "On";
      settingsBtn.disabled = true;
      settingsBtn.classList.remove("btn--primary");
      settingsBtn.classList.add("btn--ghost");
    } else if (perm === "denied") {
      banner.hidden = true;
      status.textContent = "Blocked in your browser settings. Re-enable notifications for this site.";
      settingsBtn.textContent = "Blocked";
      settingsBtn.disabled = true;
    } else if (perm === "unsupported") {
      banner.hidden = true;
      status.textContent = "This browser doesn't support notifications.";
      settingsBtn.disabled = true;
      settingsBtn.textContent = "N/A";
    } else {
      banner.hidden = !!dismissed || !Store.all().length;
      status.textContent = "Notifications are off.";
      settingsBtn.textContent = "Enable";
      settingsBtn.disabled = false;
    }
  }

  function enableNotifications() {
    Notifier.request().then(function (perm) {
      refreshNotifState();
      if (perm === "granted") {
        toast("Alerts enabled 🔔", "success");
        Notifier.fire("Encore alerts are on", {
          body: "We'll ping you the moment a tracked ticket hits your target price.",
          tag: "encore-welcome"
        });
      } else if (perm === "denied") {
        toast("Notifications blocked. You can re-enable them in browser settings.", "default", 5000);
      }
    });
  }

  /* ---------------- modals ---------------- */
  function openModal(m) {
    m.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeModal(m) {
    m.hidden = true;
    if ($$(".modal").every(function (x) { return x.hidden; })) {
      document.body.style.overflow = "";
    }
  }

  /* ---------------- theme ---------------- */
  function initTheme() {
    var saved = Store.settings().theme;
    if (saved) document.body.setAttribute("data-theme", saved);
    else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
      document.body.setAttribute("data-theme", "light");
    }
  }
  function toggleTheme() {
    var cur = document.body.getAttribute("data-theme");
    var next = cur === "dark" ? "light" : "dark";
    document.body.setAttribute("data-theme", next);
    var s = Store.settings(); s.theme = next; Store.saveSettings(s);
  }

  /* ---------------- toast ---------------- */
  function toast(msg, kind, ms) {
    kind = kind || "default";
    ms = ms || 3200;
    var host = $("#toastHost");
    var el = document.createElement("div");
    el.className = "toast toast--" + kind;
    el.innerHTML = "<span class='toast__dot'></span><span>" + escapeHtml(msg) + "</span>";
    host.appendChild(el);
    setTimeout(function () {
      el.classList.add("out");
      setTimeout(function () { el.remove(); }, 300);
    }, ms);
  }

  /* ---------------- icons ---------------- */
  function iconCal() { return "<svg viewBox='0 0 24 24' width='13' height='13' fill='none'><rect x='3' y='5' width='18' height='16' rx='2' stroke='currentColor' stroke-width='1.6'/><path d='M3 9h18M8 3v4M16 3v4' stroke='currentColor' stroke-width='1.6' stroke-linecap='round'/></svg>"; }
  function iconPin() { return "<svg viewBox='0 0 24 24' width='13' height='13' fill='none'><path d='M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z' stroke='currentColor' stroke-width='1.6'/><circle cx='12' cy='10' r='2.4' stroke='currentColor' stroke-width='1.6'/></svg>"; }
  function iconTarget() { return "<svg viewBox='0 0 24 24' width='14' height='14' fill='none'><circle cx='12' cy='12' r='8' stroke='currentColor' stroke-width='1.5'/><circle cx='12' cy='12' r='3.4' stroke='currentColor' stroke-width='1.5'/></svg>"; }

  /* ---------------- utils ---------------- */
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }

  /* ---------------- wire up ---------------- */
  function init() {
    initTheme();

    // First visit → seed sample data so the app feels alive.
    if (!Store.settings().visited) {
      Store.seed();
      var s = Store.settings(); s.visited = true; Store.saveSettings(s);
    }

    $("#addBtn").addEventListener("click", function () { openEditor(null); });
    $("#fabBtn").addEventListener("click", function () { openEditor(null); });
    $("#emptyAddBtn").addEventListener("click", function () { openEditor(null); });
    $("#refreshBtn").addEventListener("click", simulateRefresh);
    $("#editorForm").addEventListener("submit", submitEditor);

    $("#searchInput").addEventListener("input", function (e) {
      state.search = e.target.value; render();
    });
    $("#sortSelect").addEventListener("change", function (e) {
      state.sort = e.target.value; render();
    });

    $("#themeToggle").addEventListener("click", toggleTheme);
    $("#settingsBtn").addEventListener("click", function () {
      $("#aboutMeta").textContent = "Encore · v1.1 · " + Store.all().length + " trackers stored locally.";
      $("#autoUpdateSelect").value = String(getAutoInterval());
      openModal($("#settingsModal"));
    });

    // Auto-update selector.
    var autoSel = $("#autoUpdateSelect");
    autoSel.innerHTML = AUTO_OPTIONS.map(function (o) {
      return "<option value='" + o.ms + "'>" + o.label + "</option>";
    }).join("");
    autoSel.value = String(getAutoInterval());
    autoSel.addEventListener("change", function (e) {
      setAutoInterval(Number(e.target.value));
    });

    $("#notifEnable").addEventListener("click", enableNotifications);
    $("#settingsNotif").addEventListener("click", enableNotifications);
    $("#notifDismiss").addEventListener("click", function () {
      var s = Store.settings(); s.notifDismissed = true; Store.saveSettings(s);
      $("#notifBanner").hidden = true;
    });

    $("#seedBtn").addEventListener("click", function () {
      Store.seed();
      closeModal($("#settingsModal"));
      toast("Sample concerts loaded.", "success");
      render();
      updateBar();
    });
    $("#clearBtn").addEventListener("click", function () {
      if (confirm("Remove all trackers from this device? This can't be undone.")) {
        Store.clearAll();
        closeModal($("#settingsModal"));
        toast("All trackers cleared.", "default");
        render();
        refreshNotifState();
        updateBar();
      }
    });

    // modal close handlers
    $$("[data-close]").forEach(function (el) {
      el.addEventListener("click", function () {
        var m = el.closest(".modal");
        if (m) closeModal(m);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") $$(".modal").forEach(function (m) { if (!m.hidden) closeModal(m); });
    });

    render();
    refreshNotifState();
    applyAutoUpdate();

    // Keep the "checked N min ago" label live.
    tickTimer = setInterval(updateBar, 30000);
    // Re-check the moment the app regains focus after being backgrounded.
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState !== "visible") return;
      updateBar();
      var ms = getAutoInterval();
      var last = Store.settings().lastUpdated || 0;
      if (ms > 0 && Date.now() - last > ms) runPriceUpdate({ silent: true });
    });

    // Register service worker + auto-refresh when a new version is deployed.
    if ("serviceWorker" in navigator) {
      var hadController = !!navigator.serviceWorker.controller;
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("sw.js").then(function (reg) {
          reg.addEventListener("updatefound", function () {
            var nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", function () {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                toast("Updating to the latest version…", "success", 2500);
              }
            });
          });
          // Check for a newer app version periodically.
          setInterval(function () { reg.update(); }, 3600000);
        }).catch(function () {});
      });
      // When the fresh service worker takes control, reload once to apply it.
      var reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloaded || !hadController) return;
        reloaded = true;
        window.location.reload();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ============================================================
   Encore — data store (localStorage-backed)
   ============================================================ */
(function (global) {
  "use strict";

  var KEY = "encore.trackers.v1";
  var SETTINGS_KEY = "encore.settings.v1";

  function uid() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  var trackerBackup=AutoBackup.create({
    id:"encore-ticket-tracker",name:"Encore",read:load,
    validate(rows){
      if(!Array.isArray(rows)||rows.length>20000)throw new Error("Invalid tracker backup.");
      const ids=new Set(), strings=["artist","date","venue","city","platform","section","currency","url"];
      return rows.map(r=>{
        if(!r||typeof r.id!=="string"||!/^[a-z0-9_-]{1,80}$/i.test(r.id)||ids.has(r.id)||!Number.isFinite(r.createdAt)||
           strings.some(k=>typeof r[k]!=="string"||r[k].length>4096)||
           (r.targetPrice!==null&&!Number.isFinite(r.targetPrice))||!Array.isArray(r.history))throw new Error("A tracker could not be validated.");
        if(r.url&&!/^https?:\/\//i.test(r.url))throw new Error("A tracker has an unsupported link.");
        ids.add(r.id);
        const history=r.history.map(h=>{
          if(!h||!Number.isFinite(h.ts)||!Number.isFinite(h.price)||typeof h.platform!=="string"||h.platform.length>4096)throw new Error("A saved price could not be validated.");
          return {ts:h.ts,price:h.price,platform:h.platform};
        });
        return {id:r.id,...Object.fromEntries(strings.map(k=>[k,r[k]])),targetPrice:r.targetPrice,createdAt:r.createdAt,history};
      });
    },
    apply(rows){
      localStorage.setItem(KEY,JSON.stringify(rows));
      document.dispatchEvent(new Event("encore-backup-restored"));
      return true;
    }
  });
  function persist(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      trackerBackup.capture(list);
    } catch (e) {
      /* storage full / unavailable */
    }
  }

  var Store = {
    openAutoBackup: trackerBackup.open,
    all: function () {
      return load().sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
    },

    get: function (id) {
      return load().filter(function (t) { return t.id === id; })[0] || null;
    },

    /* Create a tracker. `data` has artist, date, venue, city, platform,
       section, currency, targetPrice, url, and an optional starting price. */
    add: function (data) {
      var list = load();
      var now = Date.now();
      var tracker = {
        id: uid(),
        artist: data.artist,
        date: data.date || "",
        venue: data.venue || "",
        city: data.city || "",
        platform: data.platform || "Ticketmaster",
        section: data.section || "",
        currency: data.currency || "USD",
        targetPrice: numOrNull(data.targetPrice),
        url: data.url || "",
        createdAt: now,
        history: []
      };
      var start = numOrNull(data.currentPrice);
      if (start !== null) {
        tracker.history.push({ ts: now, price: start, platform: tracker.platform });
      }
      list.push(tracker);
      persist(list);
      return tracker;
    },

    update: function (id, data) {
      var list = load();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          var t = list[i];
          t.artist = data.artist;
          t.date = data.date || "";
          t.venue = data.venue || "";
          t.city = data.city || "";
          t.platform = data.platform || t.platform;
          t.section = data.section || "";
          t.currency = data.currency || t.currency;
          t.targetPrice = numOrNull(data.targetPrice);
          t.url = data.url || "";
          var newPrice = numOrNull(data.currentPrice);
          if (newPrice !== null && newPrice !== Store.currentPrice(t)) {
            t.history.push({ ts: Date.now(), price: newPrice, platform: t.platform });
          }
          persist(list);
          return t;
        }
      }
      return null;
    },

    /* Record an observed price. Returns { tracker, crossedTarget } */
    logPrice: function (id, price, platform) {
      var list = load();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          var t = list[i];
          var prev = Store.currentPrice(t);
          t.history.push({ ts: Date.now(), price: price, platform: platform || t.platform });
          persist(list);
          var crossed =
            t.targetPrice !== null &&
            price <= t.targetPrice &&
            (prev === null || prev > t.targetPrice);
          return { tracker: t, crossedTarget: crossed, previous: prev };
        }
      }
      return null;
    },

    remove: function (id) {
      var list = load().filter(function (t) { return t.id !== id; });
      persist(list);
    },

    clearAll: function () {
      localStorage.removeItem(KEY);
      trackerBackup.capture([]);
    },

    /* ---- derived helpers ---- */
    currentPrice: function (t) {
      if (!t.history || !t.history.length) return null;
      return t.history[t.history.length - 1].price;
    },

    firstPrice: function (t) {
      if (!t.history || !t.history.length) return null;
      return t.history[0].price;
    },

    lowestPrice: function (t) {
      if (!t.history || !t.history.length) return null;
      return t.history.reduce(function (m, h) { return Math.min(m, h.price); }, Infinity);
    },

    /* Change vs the previous observation. */
    delta: function (t) {
      if (!t.history || t.history.length < 2) return 0;
      var cur = t.history[t.history.length - 1].price;
      var prev = t.history[t.history.length - 2].price;
      return cur - prev;
    },

    status: function (t) {
      var cur = Store.currentPrice(t);
      if (cur === null || t.targetPrice === null) return "watch";
      if (cur <= t.targetPrice) return "hit";
      if (cur <= t.targetPrice * 1.1) return "close";
      return "watch";
    },

    /* ---- settings ---- */
    settings: function () {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
      } catch (e) {
        return {};
      }
    },
    saveSettings: function (s) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
    },

    /* ---- sample data ---- */
    seed: function () {
      var now = Date.now();
      var day = 86400000;
      var samples = [
        {
          artist: "Tame Impala", venue: "Red Rocks Amphitheatre", city: "Morrison, CO",
          platform: "Ticketmaster", section: "Reserved · Row 24", currency: "USD",
          target: 120, prices: [189, 176, 168, 155, 149, 138, 129]
        },
        {
          artist: "Olivia Rodrigo", venue: "The O2", city: "London, UK",
          platform: "StubHub", section: "Block 104", currency: "GBP",
          target: 95, prices: [140, 132, 128, 121, 118, 112, 108]
        },
        {
          artist: "Fred again..", venue: "Brooklyn Mirage", city: "Brooklyn, NY",
          platform: "SeatGeek", section: "Floor GA", currency: "USD",
          target: 85, prices: [110, 104, 96, 92, 88, 84, 79]
        },
        {
          artist: "Coldplay", venue: "Estadio River Plate", city: "Buenos Aires, AR",
          platform: "AXS", section: "Campo Delantero", currency: "USD",
          target: 150, prices: [210, 205, 198, 192, 188, 184, 181]
        },
        {
          artist: "Chappell Roan", venue: "The Fillmore", city: "San Francisco, CA",
          platform: "Vivid Seats", section: "GA Standing", currency: "USD",
          target: 90, prices: [130, 122, 118, 109, 101, 97, 93]
        }
      ];

      var list = load();
      samples.forEach(function (s, idx) {
        var history = s.prices.map(function (p, i) {
          return {
            ts: now - (s.prices.length - 1 - i) * (2 * day) - idx * 3600000,
            price: p,
            platform: s.platform
          };
        });
        list.push({
          id: uid(),
          artist: s.artist,
          date: new Date(now + (14 + idx * 9) * day).toISOString().slice(0, 10),
          venue: s.venue,
          city: s.city,
          platform: s.platform,
          section: s.section,
          currency: s.currency,
          targetPrice: s.target,
          url: "",
          createdAt: now - idx * 1000,
          history: history
        });
      });
      persist(list);
    }
  };

  function numOrNull(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  global.Store = Store;
})(window);

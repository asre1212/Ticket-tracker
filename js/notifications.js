/* ============================================================
   Encore — notifications / price alerts
   ============================================================ */
(function (global) {
  "use strict";

  var Notifier = {
    supported: function () {
      return "Notification" in window;
    },

    permission: function () {
      return this.supported() ? Notification.permission : "unsupported";
    },

    /* Ask the user for permission. Returns a promise resolving to the
       permission string. */
    request: function () {
      if (!this.supported()) return Promise.resolve("unsupported");
      try {
        var res = Notification.requestPermission();
        // Older Safari uses a callback signature.
        if (res && typeof res.then === "function") return res;
        return new Promise(function (resolve) {
          Notification.requestPermission(resolve);
        });
      } catch (e) {
        return Promise.resolve(Notification.permission);
      }
    },

    /* Fire a notification (prefers the service worker registration so it
       survives on mobile). Falls back gracefully. */
    fire: function (title, opts) {
      opts = opts || {};
      opts.icon = opts.icon || "icons/icon-192.png";
      opts.badge = opts.badge || "icons/icon-192.png";
      if (!this.supported() || Notification.permission !== "granted") return false;

      if ("serviceWorker" in navigator && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready
          .then(function (reg) { reg.showNotification(title, opts); })
          .catch(function () {
            try { new Notification(title, opts); } catch (e) {}
          });
      } else {
        try { new Notification(title, opts); } catch (e) {}
      }
      return true;
    },

    /* Convenience: a price-drop alert. */
    priceAlert: function (tracker, price, moneyFmt) {
      var body =
        moneyFmt(price, tracker.currency) +
        " on " + tracker.platform +
        (tracker.section ? " · " + tracker.section : "") +
        " — at or below your " + moneyFmt(tracker.targetPrice, tracker.currency) + " target.";
      return this.fire("🎯 " + tracker.artist + " hit your price!", {
        body: body,
        tag: "encore-" + tracker.id,
        renotify: true,
        vibrate: [90, 40, 90],
        data: { id: tracker.id }
      });
    }
  };

  global.Notifier = Notifier;
})(window);

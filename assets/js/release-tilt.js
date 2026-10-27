/*
 * release-tilt.js — gives the release artwork a slight 3D tilt that follows
 * the pointer, so it reads as a physical sleeve catching the light rather
 * than a flat image.
 *
 * Opt in by putting `data-release-tilt` on an element. The script only writes
 * two custom properties, --tilt-x and --tilt-y, each normalised to -1..1; the
 * stylesheets decide how far that actually rotates things.
 *
 * Deliberately limited to desktop: it needs a fine, hovering pointer and a
 * viewport wide enough that the artwork is not the whole screen. It also
 * honours prefers-reduced-motion, and stops its animation frame loop as soon
 * as the value has settled, so an idle page costs nothing.
 */
(function () {
  "use strict";

  var SELECTOR = "[data-release-tilt]";
  var EASING = 0.12; // how quickly the tilt catches up with the pointer
  var EPSILON = 0.0005; // below this the motion is invisible, so stop

  var desktop = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var items = [];
  var frame = null;
  var listening = false;

  function enabled() {
    return desktop.matches && !reduced.matches;
  }

  function clamp(n) {
    return n < -1 ? -1 : n > 1 ? 1 : n;
  }

  function write(item) {
    item.el.style.setProperty("--tilt-x", item.x.toFixed(4));
    item.el.style.setProperty("--tilt-y", item.y.toFixed(4));
  }

  function clear(item) {
    item.x = item.y = item.targetX = item.targetY = 0;
    item.el.style.removeProperty("--tilt-x");
    item.el.style.removeProperty("--tilt-y");
  }

  function step() {
    frame = null;
    var moving = false;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var dx = item.targetX - item.x;
      var dy = item.targetY - item.y;

      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        if (item.x !== item.targetX || item.y !== item.targetY) {
          item.x = item.targetX;
          item.y = item.targetY;
          write(item);
        }
        continue;
      }

      item.x += dx * EASING;
      item.y += dy * EASING;
      write(item);
      moving = true;
    }

    if (moving) frame = requestAnimationFrame(step);
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(step);
  }

  function onPointerMove(event) {
    if (!enabled()) return;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var rect = item.el.getBoundingClientRect();
      if (!rect.width) continue;

      // Measured from the artwork's centre and scaled by the viewport, so the
      // tilt eases off the further away the pointer travels instead of
      // snapping to its limit the moment it leaves the artwork.
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      item.targetY = clamp((event.clientX - cx) / (window.innerWidth / 2));
      item.targetX = clamp(-(event.clientY - cy) / (window.innerHeight / 2));
    }

    schedule();
  }

  function onPointerLeave() {
    for (var i = 0; i < items.length; i++) {
      items[i].targetX = items[i].targetY = 0;
    }
    schedule();
  }

  function listen(on) {
    if (on === listening) return;
    listening = on;

    if (on) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("blur", onPointerLeave);
    } else {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      for (var i = 0; i < items.length; i++) clear(items[i]);
    }
  }

  function sync() {
    listen(enabled());
  }

  function init() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;

    for (var i = 0; i < nodes.length; i++) {
      items.push({ el: nodes[i], x: 0, y: 0, targetX: 0, targetY: 0 });
    }

    // Safari below 14 only has the deprecated addListener.
    [desktop, reduced].forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener("change", sync);
      else if (mq.addListener) mq.addListener(sync);
    });

    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

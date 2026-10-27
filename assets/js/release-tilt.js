/*
 * release-tilt.js — gives the release artwork a slight 3D tilt that follows
 * the pointer, so it reads as a physical sleeve catching the light rather
 * than a flat image.
 *
 * The tilt is relative, never absolute: once the cursor has been still for a
 * moment the artwork drifts back to a flat square, on a much slower easing
 * than it uses to track live movement.
 *
 * Opt in by putting `data-release-tilt` on an element. The script writes
 * --tilt-x and --tilt-y, each normalised to -1..1, and sets
 * `data-release-tilt-live` on <html> while the effect is actually running;
 * the stylesheet decides what any of that looks like.
 *
 * Needs a fine, hovering pointer on a wide enough viewport, so touch devices
 * never run it. Honours prefers-reduced-motion, and stops its animation frame
 * loop as soon as the values have settled, so an idle page costs nothing.
 */
(function () {
  "use strict";

  var SELECTOR = "[data-release-tilt]";

  var TRACK_EASE = 0.12; // catching up with the cursor
  var RETURN_EASE = 0.012; // drifting back to neutral, deliberately slower
  var IDLE_MS = 500; // cursor still for this long counts as "stopped"
  var EPSILON = 0.0005; // below this the motion is invisible, so stop

  var finePointer = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var items = [];
  var frame = null;
  var ease = TRACK_EASE;
  var idleTimer = null;
  var pointerOn = false;

  function clamp(n) {
    return n < -1 ? -1 : n > 1 ? 1 : n;
  }

  function live(on) {
    var root = document.documentElement;
    if (on) root.setAttribute("data-release-tilt-live", "");
    else root.removeAttribute("data-release-tilt-live");
  }

  function paint(item) {
    item.el.style.setProperty("--tilt-x", item.x.toFixed(4));
    item.el.style.setProperty("--tilt-y", item.y.toFixed(4));
  }

  function step() {
    frame = null;
    var moving = false;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var dx = item.tx - item.x;
      var dy = item.ty - item.y;

      if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) {
        if (item.x !== item.tx || item.y !== item.ty) {
          item.x = item.tx;
          item.y = item.ty;
          paint(item);
        }
        continue;
      }

      item.x += dx * ease;
      item.y += dy * ease;
      paint(item);
      moving = true;
    }

    if (moving) frame = requestAnimationFrame(step);
  }

  function schedule() {
    if (frame === null) frame = requestAnimationFrame(step);
  }

  function toNeutral() {
    ease = RETURN_EASE;
    for (var i = 0; i < items.length; i++) {
      items[i].tx = 0;
      items[i].ty = 0;
    }
    schedule();
  }

  function onPointerMove(event) {
    ease = TRACK_EASE;

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var rect = item.el.getBoundingClientRect();
      if (!rect.width) continue;

      // Measured from the artwork's centre and scaled by the viewport, so the
      // tilt eases off the further away the pointer travels instead of
      // snapping to its limit the moment it leaves the artwork.
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      item.ty = clamp((event.clientX - cx) / (window.innerWidth / 2));
      item.tx = clamp(-(event.clientY - cy) / (window.innerHeight / 2));
    }

    schedule();

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(toNeutral, IDLE_MS);
  }

  function onPointerOut() {
    if (idleTimer) clearTimeout(idleTimer);
    toNeutral();
  }

  function pointer(on) {
    if (on === pointerOn) return;
    pointerOn = on;

    if (on) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.addEventListener("pointerleave", onPointerOut);
      window.addEventListener("blur", onPointerOut);
    } else {
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerOut);
      window.removeEventListener("blur", onPointerOut);
      if (idleTimer) clearTimeout(idleTimer);
    }
  }

  function sync() {
    pointer(finePointer.matches && !reduced.matches);
    live(pointerOn);
    if (!pointerOn) toNeutral();
  }

  function init() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;

    for (var i = 0; i < nodes.length; i++) {
      items.push({ el: nodes[i], x: 0, y: 0, tx: 0, ty: 0 });
    }

    // Safari below 14 only has the deprecated addListener.
    [finePointer, reduced].forEach(function (mq) {
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

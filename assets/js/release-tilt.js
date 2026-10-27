/*
 * release-tilt.js — gives the release artwork a slight 3D tilt, so it reads as
 * a physical sleeve catching the light rather than a flat image.
 *
 * Two input sources:
 *   fine pointer   the tilt follows the cursor, then drifts back to neutral
 *                  once the cursor has been still for a moment
 *   device motion  phones and tablets tilt the artwork as they are moved
 *
 * Both are relative, never absolute. The pointer target returns to zero when
 * the cursor stops, and the device baseline continuously drifts towards
 * however the device is currently being held, so holding it at any angle
 * settles the artwork back to a flat square. Only *changes* tilt it — which
 * also means a phone resting on a table never sits at a permanent angle.
 *
 * Opt in by putting `data-release-tilt` on an element. The script writes
 * --tilt-x and --tilt-y, each normalised to -1..1, and sets
 * `data-release-tilt-live` on <html> while an input source is actually
 * running; the stylesheet decides what any of that looks like.
 *
 * Honours prefers-reduced-motion, and stops its animation frame loop as soon
 * as the values have settled, so an idle page costs nothing.
 */
(function () {
  "use strict";

  var SELECTOR = "[data-release-tilt]";

  var TRACK_EASE = 0.12; // catching up with live input
  var RETURN_EASE = 0.03; // drifting back to neutral, deliberately slower
  var IDLE_MS = 600; // cursor still for this long counts as "stopped"
  var EPSILON = 0.0005; // below this the motion is invisible, so stop

  var ORIENT_RANGE = 22; // degrees of change that reaches full tilt
  var ORIENT_BASE_EASE = 0.02; // how fast "neutral" follows how you hold it
  var ORIENT_SETTLE = 12; // ignore the first few noisy readings

  /*
   * iOS 13+ hides device orientation behind a permission prompt that can only
   * be triggered by a user gesture. Asking an unsuspecting visitor for motion
   * access the moment they tap a link is worse than quietly doing without, so
   * we do not ask. Android, and iOS devices where access was already granted,
   * get the effect; everyone else sees a still artwork. Flip this to true to
   * request it on the first tap instead.
   */
  var REQUEST_MOTION_PERMISSION = false;

  var finePointer = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  var coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  var items = [];
  var frame = null;
  var ease = TRACK_EASE;
  var idleTimer = null;

  var pointerOn = false;
  var orientationOn = false;
  var baseBeta = null;
  var baseGamma = null;
  var orientSeen = 0;

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

  function setTarget(x, y) {
    for (var i = 0; i < items.length; i++) {
      items[i].tx = x;
      items[i].ty = y;
    }
    schedule();
  }

  function toNeutral() {
    ease = RETURN_EASE;
    setTarget(0, 0);
  }

  /* ------------------------------------------------------------ pointer -- */

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

  /* ------------------------------------------------------ device motion -- */

  function onOrientation(event) {
    var beta = event.beta;
    var gamma = event.gamma;
    if (beta === null || gamma === null || beta === undefined || gamma === undefined) return;

    if (baseBeta === null) {
      baseBeta = beta;
      baseGamma = gamma;
      orientSeen = 0;
      return;
    }

    // The baseline chases however the device is currently held, so the tilt
    // reflects recent movement only and always unwinds back to neutral. This
    // is what makes the absolute orientation of the device irrelevant.
    baseBeta += (beta - baseBeta) * ORIENT_BASE_EASE;
    baseGamma += (gamma - baseGamma) * ORIENT_BASE_EASE;

    if (orientSeen < ORIENT_SETTLE) {
      orientSeen++;
      return;
    }

    ease = TRACK_EASE;
    setTarget(
      clamp(-(beta - baseBeta) / ORIENT_RANGE),
      clamp((gamma - baseGamma) / ORIENT_RANGE)
    );
  }

  function orientation(on) {
    if (on === orientationOn) return;
    orientationOn = on;

    if (on) {
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
    } else {
      window.removeEventListener("deviceorientation", onOrientation);
      baseBeta = baseGamma = null;
    }
  }

  function motionSupported() {
    return typeof window.DeviceOrientationEvent !== "undefined";
  }

  function needsMotionPermission() {
    return (
      motionSupported() &&
      typeof window.DeviceOrientationEvent.requestPermission === "function"
    );
  }

  /* ------------------------------------------------------------- wiring -- */

  function sync() {
    if (reduced.matches) {
      pointer(false);
      orientation(false);
      live(false);
      toNeutral();
      return;
    }

    var wantPointer = finePointer.matches;
    var wantOrientation = !wantPointer && coarsePointer.matches && motionSupported();

    pointer(wantPointer);
    orientation(wantOrientation && !needsMotionPermission());

    if (!pointerOn && !orientationOn) {
      live(false);
      toNeutral();
    } else {
      live(true);
    }
  }

  function init() {
    var nodes = document.querySelectorAll(SELECTOR);
    if (!nodes.length) return;

    for (var i = 0; i < nodes.length; i++) {
      items.push({ el: nodes[i], x: 0, y: 0, tx: 0, ty: 0 });
    }

    // Safari below 14 only has the deprecated addListener.
    [finePointer, coarsePointer, reduced].forEach(function (mq) {
      if (mq.addEventListener) mq.addEventListener("change", sync);
      else if (mq.addListener) mq.addListener(sync);
    });

    if (REQUEST_MOTION_PERMISSION && needsMotionPermission()) {
      window.addEventListener(
        "touchend",
        function () {
          window.DeviceOrientationEvent.requestPermission()
            .then(function (state) {
              if (state === "granted") sync();
            })
            .catch(function () {});
        },
        { once: true }
      );
    }

    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

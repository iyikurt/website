// The masthead's menu and color-scheme buttons, the tabs, and Copy.
(() => {
  const head = document.querySelector(".masthead");
  const menu = document.querySelector(".menu-toggle");
  if (head && menu) {
    head.dataset.js = "true";
    const set = (open) => {
      head.dataset.open = String(open);
      menu.setAttribute("aria-expanded", String(open));
    };
    menu.addEventListener("click", () => set(head.dataset.open !== "true"));
    head.querySelector("nav")?.addEventListener("click", (e) => {
      if (e.target.closest("a")) set(false);
    });
  }

  const scheme = document.querySelector(".scheme-toggle");
  if (head && scheme) {
    const root = document.documentElement;
    const paper = scheme.dataset.paper ?? "";
    const paperDark = scheme.dataset.paperDark ?? "";
    const meta = document.querySelector('meta[name="theme-color"]');
    const apply = (mode) => {
      if (mode === "light") root.dataset.theme = "light";
      else delete root.dataset.theme;
      if (meta) meta.content = mode === "dark" ? paperDark : paper;
      try { localStorage.setItem("kurt-theme", mode); } catch {}
    };
    if (root.dataset.theme === "light" && meta) meta.content = paper;
    scheme.addEventListener("click", () => apply(root.dataset.theme === "light" ? "dark" : "light"));
  }

  for (const box of document.querySelectorAll("[data-platform-switch]")) {
    box.dataset.js = "true";
    const tabs = [...box.querySelectorAll("[data-platform]")];
    const show = (name) => {
      for (const tab of tabs) {
        const on = tab.dataset.platform === name;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      }
      for (const panel of box.querySelectorAll("[data-platform-panel]")) {
        panel.hidden = panel.dataset.platformPanel !== name;
      }
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => show(tab.dataset.platform));
      tab.addEventListener("keydown", (e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        const next = tabs[(i + step + tabs.length) % tabs.length];
        next.focus();
        next.click();
      });
    });
    show(tabs[0]?.dataset.platform);
  }

  const status = document.getElementById("copy-status");
  const copied = "Copied";
  const failed = "Could not copy";
  for (const button of document.querySelectorAll("button[data-copy]")) {
    const label = button.textContent ?? "Copy";
    button.addEventListener("click", async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(button.dataset.copy ?? ""); ok = true; } catch {}
      button.textContent = ok ? copied : failed;
      if (status) status.textContent = ok ? copied : failed;
      setTimeout(() => { button.textContent = label; if (status) status.textContent = ""; }, 1600);
    });
  }

  // The story: the step nearest the reading line is the active one, and the
  // terminal plays its frame: each command typed, then its output line by line.
  const story = document.querySelector("[data-story]");
  if (story) {
    const steps = [...story.querySelectorAll(".story-step")];
    const frames = [...story.querySelectorAll(".story-frame")];
    const screen = story.querySelector(".story-screen");
    const label = story.querySelector("[data-story-label]");
    const count = story.querySelector("[data-story-count]");
    const bar = story.querySelector("[data-story-bar]");
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = matchMedia("(width <= 860px)");
    let current = -1;
    let run = 0;
    story.dataset.js = "true";

    const wait = (ms) => new Promise((done) => setTimeout(done, ms));

    const play = async (frame, token) => {
      const lines = [...frame.querySelectorAll(".ln")];
      for (const line of lines) line.classList.add("is-hidden");
      for (const line of lines) {
        if (token !== run) return;
        line.classList.remove("is-hidden");
        const typed = line.querySelector(".typed");
        if (typed && !still.matches) {
          const text = typed.dataset.text ?? "";
          const caret = document.createElement("span");
          caret.className = "caret";
          typed.textContent = "";
          typed.after(caret);
          const step = Math.max(8, Math.min(32, 700 / Math.max(text.length, 1)));
          // Typed as plain text, then given back its colours.
          const lit = () => { if (typed.dataset.html) typed.innerHTML = typed.dataset.html; else typed.textContent = text; };
          for (let i = 1; i <= text.length; i++) {
            if (token !== run) { lit(); caret.remove(); return; }
            typed.textContent = text.slice(0, i);
            await wait(step);
          }
          lit();
          await wait(160);
          caret.remove();
        } else if (!still.matches) {
          await wait(lines.length > 24 ? 12 : 28);
        }
      }
    };

    const show = (index) => {
      if (index === current) return;
      current = index;
      run += 1;
      steps.forEach((step, i) => step.classList.toggle("is-on", i === index));
      frames.forEach((frame, i) => frame.classList.toggle("is-on", i === index));
      const frame = frames[index];
      if (label) label.textContent = frame?.dataset.label ?? "";
      if (count) count.textContent = `${count.dataset.word ?? ""} ${index + 1} / ${frames.length}`;
      if (bar) bar.style.width = `${((index + 1) / frames.length) * 100}%`;
      if (screen) screen.scrollTop = 0;
      if (frame) play(frame, run);
    };

    // A step's text sticks at the terminal's top line (the copy's `top`); the
    // step takes over once its text has nearly arrived there from below.
    const copy = story.querySelector(".story-copy");
    const pick = () => {
      const settle = copy ? parseFloat(getComputedStyle(copy).top) || 0 : 0;
      const line = settle + innerHeight * (narrow.matches ? 0.12 : 0.2);
      let best = 0;
      steps.forEach((step, i) => {
        if (step.getBoundingClientRect().top <= line) best = i;
      });
      show(best);
    };

    // One gesture, one step, the way fullPage.js does it.
    //
    // - A move animates for 600 ms and locks for 750 ms; wheel events that
    //   arrive while it is locked are dropped, not queued (fullPage:
    //   scrollingSpeed 700, canScroll).
    // - A trackpad keeps sending events after the fingers leave, with falling
    //   deltas. The events of one stream (no pause of 200 ms or more) are kept,
    //   and a stream moves a step when it starts, or when it speeds up again:
    //   the average of its last 10 deltas against the average of its last 70
    //   (fullPage: isAccelerating). Averages are taken over the samples there
    //   are, so a short stream does not look like it is speeding up.
    // - The page scrolls natively up to the story. A wheel event that would
    //   carry it past the first step (or, going up, past the last) is stopped
    //   there, so momentum cannot run through several steps.
    // - A swipe moves a step after 5% of the screen's height (fullPage:
    //   touchSensitivity 5).
    const settleTop = () => (copy ? parseFloat(getComputedStyle(copy).top) || 0 : 0);
    const rests = () => steps.map((s) => Math.round(s.getBoundingClientRect().top + scrollY - settleTop()));
    let animating = false;
    let lockedUntil = 0;
    const animateTo = (y) => {
      const from = scrollY;
      const distance = y - from;
      const root = document.documentElement;
      const behavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      lockedUntil = performance.now() + 750;
      if (still.matches || Math.abs(distance) < 2) {
        scrollTo(0, y);
        root.style.scrollBehavior = behavior;
        return;
      }
      animating = true;
      const start = performance.now();
      const duration = 600;
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        scrollTo(0, y);
        animating = false;
        root.style.scrollBehavior = behavior;
        pick();
      };
      const tick = (now) => {
        if (done) return;
        const t = Math.min(1, (now - start) / duration);
        scrollTo(0, from + distance * ease(t));
        if (t < 1) requestAnimationFrame(tick);
        else finish();
      };
      requestAnimationFrame(tick);
      // Frames can stall (a hidden tab, a busy machine); the move still ends
      // on time, at its place, and never leaves the story locked.
      setTimeout(finish, duration + 120);
    };
    const locked = () => animating || performance.now() < lockedUntil;
    // The resting place of the next (dir 1) or previous (dir -1) step.
    const nextRest = (dir) => {
      const y = scrollY;
      const all = rests();
      if (dir > 0) return all.find((r) => r > y + 2);
      for (let i = all.length - 1; i >= 0; i--) if (all[i] < y - 2) return all[i];
      return undefined;
    };
    const go = (dir) => {
      const to = nextRest(dir);
      if (to === undefined) return false;
      animateTo(to);
      return true;
    };
    // Whether the story holds a move in this direction: between its first
    // and last resting places.
    const inside = (dir) => {
      const y = scrollY;
      const all = rests();
      const first = all[0];
      const last = all[all.length - 1];
      return dir > 0 ? y >= first - 2 && y < last - 2 : y > first + 2 && y <= last + 2;
    };
    const average = (list, n) => {
      const tail = list.slice(-n);
      return tail.reduce((a, b) => a + b, 0) / Math.max(tail.length, 1);
    };

    let samples = [];
    let lastWheel = -Infinity;
    let moved = false;      // has this stream moved a step yet?
    addEventListener("wheel", (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      const now = performance.now();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      const dir = Math.sign(delta);
      if (!dir) return;
      if (now - lastWheel > 200) { samples = []; moved = false; }
      lastWheel = now;
      samples.push(Math.abs(delta));
      if (samples.length > 150) samples.shift();

      const y = scrollY;
      const all = rests();
      const first = all[0];
      const last = all[all.length - 1];
      // Coming in from above or below: stop at the edge step.
      if (dir > 0 && y < first - 2 && y + Math.abs(delta) >= first - 2) {
        e.preventDefault();
        if (!locked()) { animateTo(first); moved = true; }
        return;
      }
      if (dir < 0 && y > last + 2 && y - Math.abs(delta) <= last + 2) {
        e.preventDefault();
        if (!locked()) { animateTo(last); moved = true; }
        return;
      }
      if (!inside(dir)) return;
      e.preventDefault();
      if (locked()) return;
      const speedingUp = samples.length >= 20 && Math.abs(delta) >= 8 &&
        average(samples, 10) > average(samples, 70) * 1.25;
      if (!moved || speedingUp) {
        if (go(dir)) moved = true;
      }
    }, { passive: false });

    let touchY = null;
    addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    addEventListener("touchmove", (e) => {
      if (touchY === null) return;
      const dy = touchY - e.touches[0].clientY;
      const dir = Math.sign(dy);
      if (!dir || !inside(dir)) return;
      e.preventDefault();
      if (!locked() && Math.abs(dy) > innerHeight * 0.05) { go(dir); touchY = null; }
    }, { passive: false });
    addEventListener("touchend", () => { touchY = null; });

    addEventListener("keydown", (e) => {
      const keys = { ArrowDown: 1, PageDown: 1, " ": 1, ArrowUp: -1, PageUp: -1 };
      const dir = keys[e.key];
      if (!dir || (e.shiftKey && e.key === " ") || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (!inside(dir)) return;
      e.preventDefault();
      if (!locked()) go(dir);
    });

    let queued = false;
    addEventListener("scroll", () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; pick(); });
    }, { passive: true });
    addEventListener("resize", pick);
    pick();
  }
})();

/*
  Scroll reveal text (blocks/scroll-reveal-text.liquid).
  Loaded as a module, so it runs once per page however many blocks there are.

  Sets one property on the block, --vt-progress (0 to 1), as the text crosses the
  screen; the block's stylesheet turns it into each word's opacity. The value eases
  toward the scroll position instead of jumping to it, so a mouse wheel that scrolls
  in steps still reveals the words smoothly. Work runs only while the text is on screen.
*/

if (!customElements.get('vt-scroll-reveal')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Share of the screen height, from the top: the reveal starts when the top of the
  // text reaches START and is complete when its bottom reaches END
  const START = 0.85;
  const END = 0.35;
  // Time for the reveal to catch up with the scroll, in seconds (smaller is snappier)
  const EASE_TIME = 0.15;

  class VtScrollReveal extends HTMLElement {
    #observer = null;
    #abort = null;
    #frame = 0;
    #current = null;
    #target = 0;
    #lastTime = 0;

    connectedCallback() {
      // With reduced motion the stylesheet shows every word in full
      if (reducedMotion.matches) return;

      this.#observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          this.#listen();
        } else {
          // Settle at the start or the end before going quiet
          this.#stop();
          this.#render(this.#measure());
        }
      });
      this.#observer.observe(this);
    }

    disconnectedCallback() {
      this.#observer?.disconnect();
      this.#stop();
    }

    #listen() {
      if (this.#abort) return;
      this.#abort = new AbortController();
      const { signal } = this.#abort;
      window.addEventListener('scroll', this.#onScroll, { signal, passive: true });
      window.addEventListener('resize', this.#onScroll, { signal, passive: true });
      this.#onScroll();
    }

    #stop() {
      this.#abort?.abort();
      this.#abort = null;
      cancelAnimationFrame(this.#frame);
      this.#frame = 0;
    }

    // Where the reveal should be for the current scroll position
    #measure() {
      const { top, height } = this.getBoundingClientRect();
      const screen = window.innerHeight;
      const start = screen * START;
      const distance = Math.max(screen * 0.1, start - screen * END + height);
      // Near the end of the page the text may never reach END: finish it there
      const { scrollHeight } = document.documentElement;
      if (window.scrollY + screen >= scrollHeight - 2) return 1;
      return Math.min(1, Math.max(0, (start - top) / distance));
    }

    #onScroll = () => {
      this.#target = this.#measure();
      // First reading: show the right state at once, without easing in from 0
      if (this.#current === null) this.#render(this.#target);
      if (!this.#frame) {
        this.#lastTime = performance.now();
        this.#frame = requestAnimationFrame(this.#tick);
      }
    };

    #tick = (now) => {
      const elapsed = Math.min(0.1, (now - this.#lastTime) / 1000);
      this.#lastTime = now;
      // Frame-rate independent easing: the same feel at 60 Hz and 120 Hz
      const step = 1 - Math.exp(-elapsed / EASE_TIME);
      const next = this.#current + (this.#target - this.#current) * step;

      if (Math.abs(this.#target - next) < 0.0005) {
        this.#render(this.#target);
        this.#frame = 0;
        return;
      }
      this.#render(next);
      this.#frame = requestAnimationFrame(this.#tick);
    };

    #render(progress) {
      this.#current = Math.min(1, Math.max(0, progress));
      this.style.setProperty('--vt-progress', this.#current.toFixed(4));
    }
  }

  customElements.define('vt-scroll-reveal', VtScrollReveal);
}

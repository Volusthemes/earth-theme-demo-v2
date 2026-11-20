const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

class VtScrollHighlight extends HTMLElement {
  connectedCallback() {
    this.words = this.querySelectorAll('.vt-scroll-highlight__word');
    if (!this.words.length) return;

    this.ticking = false;
    this.onScroll = () => {
      if (!this.ticking) {
        this.ticking = true;
        requestAnimationFrame(() => this.update());
      }
    };

    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll);

    this.onMotionChange = () => this.update();
    if (reducedMotion.addEventListener) {
      reducedMotion.addEventListener('change', this.onMotionChange);
    }

    this.update();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    if (reducedMotion.removeEventListener) {
      reducedMotion.removeEventListener('change', this.onMotionChange);
    }
  }

  getStartOpacity() {
    const raw =
      this.dataset.startOpacity ||
      getComputedStyle(this).getPropertyValue('--start-opacity') ||
      getComputedStyle(this).getPropertyValue('--vt-sh-start-opacity');
    const val = parseFloat(raw);
    return isNaN(val) ? 0.3 : val;
  }

  update() {
    this.ticking = false;
    if (!this.words || !this.words.length) return;

    if (reducedMotion.matches) {
      this.words.forEach((w) => {
        w.style.opacity = '1';
        w.classList.add('is-active');
      });
      return;
    }

    const vh = window.innerHeight || document.documentElement.clientHeight;
    const rect = this.getBoundingClientRect();

    const bandStart = parseFloat(this.dataset.bandStart) || 0.85;
    const bandEnd = parseFloat(this.dataset.bandEnd) || 0.15;
    const speed = parseFloat(this.dataset.speed) || 1.0;

    // Start when top of element reaches bandStart of viewport
    const startY = vh * bandStart;
    // End when bottom of element reaches bandEnd of viewport
    const endY = vh * bandEnd;
    // Height-aware: accounts for rect.height so long text blocks reveal progressively
    const totalDistance = Math.max(vh * 0.1, (startY - endY) + (rect.height || 0));
    const scrolled = startY - rect.top;
    const rawProgress = scrolled / totalDistance;
    const progress = Math.min(1, Math.max(0, rawProgress * speed));

    const startOpacity = this.getStartOpacity();
    const trail = 1; // word smooth gradient transition ahead of active words
    const cursor = progress * (this.words.length + trail);

    for (let i = 0; i < this.words.length; i++) {
      const w = this.words[i];
      if (i <= cursor - trail) {
        w.style.opacity = '1';
        w.classList.add('is-active');
      } else if (i < cursor) {
        const t = (cursor - i) / trail;
        const easedT = t * t * (3 - 2 * t);
        const op = startOpacity + (1 - startOpacity) * easedT;
        w.style.opacity = op.toFixed(3);
        w.classList.remove('is-active');
      } else {
        w.style.opacity = '';
        w.classList.remove('is-active');
      }
    }
  }
}


if (!customElements.get('vt-scroll-highlight-text')) {
  customElements.define('vt-scroll-highlight-text', VtScrollHighlight);
}

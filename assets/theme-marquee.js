/**
 * <vt-marquee>: seamless scrolling row for the Scrolling content block. 
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

class VtMarquee extends HTMLElement {
  connectedCallback() {
    this.track = this.querySelector('[data-marquee-track]');
    this.group = this.querySelector('[data-marquee-group]');
    if (!this.track || !this.group) return;

    this.frame = 0;
    this.width = 0;
    this.groupWidth = 0;

    this.resizeObserver = new ResizeObserver(() => this.schedule());
    this.resizeObserver.observe(this);
    this.resizeObserver.observe(this.group);

    this.visibilityObserver = new IntersectionObserver(([entry]) => {
      this.toggleAttribute('data-offscreen', !entry.isIntersecting);
    });
    this.visibilityObserver.observe(this);

    this.onMotionChange = () => this.schedule(true);
    reducedMotion.addEventListener('change', this.onMotionChange);

    this.schedule(true);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    reducedMotion.removeEventListener('change', this.onMotionChange);
  }

  /* Batch resize callbacks into one measurement per frame */
  schedule(force = false) {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.update(force));
  }

  update(force) {
    const width = this.clientWidth;
    const groupWidth = this.group.getBoundingClientRect().width;
    if (!width || !groupWidth) return;

    /* Ignore the observer callback that the new copies themselves cause */
    if (!force && width === this.width && groupWidth === this.groupWidth) return;
    this.width = width;
    this.groupWidth = groupWidth;

    const styles = getComputedStyle(this.track);
    const gap = parseFloat(styles.columnGap) || 0;
    const shift = groupWidth + gap;

    /* Enough copies that the row is still full after moving one group's width */
    const copies = reducedMotion.matches ? 0 : Math.max(1, Math.ceil(width / shift));
    this.renderCopies(copies);

    const speed = parseFloat(getComputedStyle(this).getPropertyValue('--vt-marquee-speed')) || 40;
    this.style.setProperty('--vt-marquee-shift', `${shift}px`);
    this.style.setProperty('--vt-marquee-duration', `${(shift / speed).toFixed(2)}s`);
    this.toggleAttribute('data-ready', copies > 0);
  }

  renderCopies(count) {
    this.track.querySelectorAll('[data-marquee-copy]').forEach((copy) => copy.remove());

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const copy = this.group.cloneNode(true);
      copy.removeAttribute('data-marquee-group');
      copy.setAttribute('data-marquee-copy', '');
      copy.setAttribute('aria-hidden', 'true');
      copy.inert = true;

      /* Copies must not repeat ids, or look like editable blocks in the theme editor */
      copy.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
      copy.querySelectorAll('[data-shopify-editor-block]').forEach((element) => {
        element.removeAttribute('data-shopify-editor-block');
      });
      fragment.append(copy);
    }
    this.track.append(fragment);
  }
}

if (!customElements.get('vt-marquee')) customElements.define('vt-marquee', VtMarquee);

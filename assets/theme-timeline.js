/*
  Timeline: the badge list of sections/timeline.liquid.
  Loaded by the section as a module, so it runs once per page however many timelines there are.

  The card entrance is CSS only (scroll-driven animation in the section's stylesheet).
  This file:
  - builds the badge list from the cards: Liquid can't read theme block settings from
    section.blocks, so each card carries its label (data-timeline-label, or its heading)
  - marks the badge of the card crossing the reading line with aria-current
  - moves to a card, and focus into it, when its badge is used
*/

if (!customElements.get('vt-timeline')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // A thin line a little above the middle of the screen: the card under it is "in view"
  const READING_LINE = '-45% 0px -54% 0px';

  const labelOf = (item) =>
    item.dataset.timelineLabel || item.querySelector('h1, h2, h3, h4, h5, h6, .vt-heading')?.textContent.trim() || '';

  class VtTimeline extends HTMLElement {
    #observer = null;
    #editorObserver = null;
    // card -> badge link
    #linkFor = new Map();
    // While a badge scrolls the page, the cards passed on the way don't take over
    #jumping = false;
    #jumpTimer = null;

    connectedCallback() {
      this.#build();
      this.addEventListener('click', this.#onClick);

      // In the theme editor a card can change without the section reloading
      if (window.Shopify?.designMode) {
        const items = this.querySelector('.vt-timeline__items');
        if (items) {
          this.#editorObserver = new MutationObserver(() => this.#build());
          this.#editorObserver.observe(items, {
            childList: true,
            subtree: true,
            characterData: true,
            attributeFilter: ['data-timeline-label'],
          });
        }
      }
    }

    disconnectedCallback() {
      this.#observer?.disconnect();
      this.#editorObserver?.disconnect();
      clearTimeout(this.#jumpTimer);
      this.#linkFor.clear();
      this.removeEventListener('click', this.#onClick);
    }

    #build() {
      const list = this.querySelector('[data-timeline-badges]');
      const template = this.querySelector('template[data-timeline-badge]');
      if (!list || !template) return;

      this.#observer?.disconnect();
      this.#linkFor.clear();

      const badges = [];
      this.querySelectorAll('[data-timeline-item]').forEach((item) => {
        const label = labelOf(item);
        if (!label) return;

        const badge = template.content.firstElementChild.cloneNode(true);
        const link = badge.querySelector('[data-timeline-link]');
        link.href = `#${item.id}`;
        link.textContent = label;
        this.#linkFor.set(item, link);
        badges.push(badge);
      });

      list.replaceChildren(...badges);
      if (!badges.length) return;

      // root: document, because with the default root a page shown in a cross-origin frame
      // (the theme editor preview) ignores rootMargin, so the reading line would be lost
      this.#observer ??= new IntersectionObserver(this.#onIntersect, { root: document, rootMargin: READING_LINE });
      this.#linkFor.forEach((_link, item) => this.#observer.observe(item));
    }

    // Between cards nothing crosses the line, so the last badge stays active
    #onIntersect = (entries) => {
      if (this.#jumping) return;
      const entry = entries.find(({ isIntersecting }) => isIntersecting);
      if (entry) this.#setActive(this.#linkFor.get(entry.target));
    };

    #endJump = () => {
      clearTimeout(this.#jumpTimer);
      this.#jumping = false;
    };

    #onClick = (event) => {
      const link = event.target.closest('[data-timeline-link]');
      if (!link) return;
      const item = [...this.#linkFor].find(([, itemLink]) => itemLink === link)?.[0];
      if (!item) return;

      event.preventDefault();
      this.#jumping = true;
      window.addEventListener('scrollend', this.#endJump, { once: true });
      // Fallback for browsers without scrollend, or when the page doesn't need to move
      clearTimeout(this.#jumpTimer);
      this.#jumpTimer = setTimeout(this.#endJump, 1000);

      item.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      // Keyboard and screen reader users continue reading from the card
      item.focus({ preventScroll: true });
      this.#setActive(link);
    };

    #setActive(activeLink) {
      this.#linkFor.forEach((link) => {
        if (link === activeLink) {
          link.setAttribute('aria-current', 'true');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }
  }

  customElements.define('vt-timeline', VtTimeline);
}

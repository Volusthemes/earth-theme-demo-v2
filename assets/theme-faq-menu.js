/*
  Topic menu (blocks/faq-topic-menu.liquid).
  Loaded as a module, so it runs once per page however many menus there are.

  - builds the links from the Topic with anchor blocks (blocks/faq-topic.liquid) of the same section: Liquid can't read
    theme block settings from other blocks, so each topic carries its title (its
    heading) and its icon (a <template>)
  - highlights the topic being read: the last topic whose top has passed the reading
    line. Positions are read once per frame, only while the section is on screen
  - moves smoothly to a topic when its link is used, puts its anchor in the address
    bar, and moves focus to the topic's heading
*/

if (!customElements.get('vt-faq-menu')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Share of the screen height, from the top: the topic crossing it is being read
  const READING_LINE = 0.3;

  class VtFaqMenu extends HTMLElement {
    // [{ topic, link, item }] in page order
    #entries = [];
    #active = null;
    #frame = 0;
    #inView = false;
    // While a link scrolls the page, the topics passed on the way don't take over
    #jumping = false;
    #jumpTimer = null;
    #abort = null;
    #sectionObserver = null;
    #resizeObserver = null;
    #editorObserver = null;

    connectedCallback() {
      this.#abort = new AbortController();
      const { signal } = this.#abort;
      this.scope = this.closest('.shopify-section') || document.body;

      this.addEventListener('click', this.#onClick, { signal });
      window.addEventListener('scroll', this.#requestUpdate, { signal, passive: true });
      window.addEventListener('resize', this.#requestUpdate, { signal, passive: true });

      // Follow the page only while the section is on screen
      this.#sectionObserver = new IntersectionObserver(([entry]) => {
        this.#inView = entry.isIntersecting;
        if (this.#inView) this.#requestUpdate();
      });
      this.#sectionObserver.observe(this.scope);

      // Text size, fonts loading and the window width move the links
      this.#resizeObserver = new ResizeObserver(() => this.#placeIndicator());

      this.#build();

      // In the theme editor topics change without the section reloading
      if (window.Shopify?.designMode) {
        this.#editorObserver = new MutationObserver((records) => {
          if (records.some(({ target }) => !this.contains(target))) this.#build();
        });
        this.#editorObserver.observe(this.scope, { childList: true, subtree: true, characterData: true });
      }
    }

    disconnectedCallback() {
      this.#abort?.abort();
      this.#sectionObserver?.disconnect();
      this.#resizeObserver?.disconnect();
      this.#editorObserver?.disconnect();
      cancelAnimationFrame(this.#frame);
      clearTimeout(this.#jumpTimer);
      this.#entries = [];
      this.#active = null;
    }

    #build() {
      const list = this.querySelector('[data-faq-menu-list]');
      const template = this.querySelector('template[data-faq-menu-item]');
      if (!list || !template) return;

      const activeTopic = this.#active?.topic;
      this.#active = null;
      this.#entries = [];

      this.scope.querySelectorAll('[data-faq-topic]').forEach((topic) => {
        const label = topic.querySelector('[data-faq-topic-title]')?.textContent.trim();
        if (!label || !topic.id) return;

        const item = template.content.firstElementChild.cloneNode(true);
        const link = item.querySelector('[data-faq-menu-link]');
        link.href = `#${topic.id}`;
        item.querySelector('.vt-faq-menu__label').textContent = label;

        const icon = item.querySelector('.vt-faq-menu__icon');
        const iconTemplate = topic.querySelector(':scope > template[data-faq-topic-icon]');
        if (icon && iconTemplate) icon.append(iconTemplate.content.cloneNode(true));

        this.#entries.push({ topic, link, item });
      });

      list.replaceChildren(...this.#entries.map(({ item }) => item));
      this.#resizeObserver.disconnect();
      this.#resizeObserver.observe(list);

      const keep = this.#entries.find(({ topic }) => topic === activeTopic);
      if (keep) this.#setActive(keep);
      this.#requestUpdate();
    }

    #requestUpdate = () => {
      if (this.#frame || !this.#inView || this.#jumping) return;
      this.#frame = requestAnimationFrame(this.#update);
    };

    #update = () => {
      this.#frame = 0;
      if (this.#jumping || !this.#entries.length) return;

      const line = window.innerHeight * READING_LINE;
      let current = this.#entries[0];
      for (const entry of this.#entries) {
        if (entry.topic.getBoundingClientRect().top > line) break;
        current = entry;
      }

      // At the very end of the page a short last topic can't reach the line
      const { scrollHeight } = document.documentElement;
      if (window.scrollY + window.innerHeight >= scrollHeight - 2) current = this.#entries.at(-1);

      this.#setActive(current);
    };

    #setActive(entry) {
      if (entry === this.#active) return;
      this.#active?.link.removeAttribute('aria-current');
      entry.link.setAttribute('aria-current', 'true');
      this.#active = entry;
      this.#placeIndicator();
    }

    #placeIndicator() {
      const item = this.#active?.item;
      if (!item?.isConnected) return;

      this.style.setProperty('--vt-faq-indicator-y', `${item.offsetTop}px`);
      this.style.setProperty('--vt-faq-indicator-height', `${item.offsetHeight}px`);

      // The first time it appears in place; after that it slides
      if (!this.hasAttribute('data-active')) {
        this.setAttribute('data-active', '');
        requestAnimationFrame(() => requestAnimationFrame(() => this.setAttribute('data-ready', '')));
      }
    }

    #endJump = () => {
      clearTimeout(this.#jumpTimer);
      window.removeEventListener('scrollend', this.#endJump);
      this.#jumping = false;
      this.#requestUpdate();
    };

    #onClick = (event) => {
      const link = event.target.closest('[data-faq-menu-link]');
      const entry = link && this.#entries.find((candidate) => candidate.link === link);
      if (!entry) return;

      event.preventDefault();
      this.#jumping = true;
      window.addEventListener('scrollend', this.#endJump, { once: true });
      // Fallback for browsers without scrollend, or when the page doesn't need to move
      clearTimeout(this.#jumpTimer);
      this.#jumpTimer = setTimeout(this.#endJump, 1200);

      // scroll-margin on the topic leaves it clear of the sticky header
      entry.topic.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(history.state, '', link.hash);
      // Keyboard and screen reader users continue reading from the topic
      entry.topic.querySelector('[data-faq-topic-title]')?.focus({ preventScroll: true });
      this.#setActive(entry);
    };
  }

  customElements.define('vt-faq-menu', VtFaqMenu);
}

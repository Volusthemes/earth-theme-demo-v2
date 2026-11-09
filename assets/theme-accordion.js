/*
  Accordion: smooth expand and collapse for blocks/accordion.liquid.
  Loaded by the block as a module, so it runs once per page however many accordions there are.

  The items are native <details>, which already open and close without this file.
  This adds:
  - the expand effect (height, optionally with a fade), interruptible mid-way
  - "Open one answer at a time" with the closing item animated too
  - opening the right item when a block is selected in the theme editor
*/

if (!customElements.get('vt-accordion')) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

  // Longer content moves further, so it gets a little more time, within limits
  const durationFor = (distance) => Math.min(Math.max(distance * 0.6, 250), 450);

  class VtAccordion extends HTMLElement {
    // details element -> { opening, animations }
    #running = new Map();

    connectedCallback() {
      // The shared name gives exclusive items without JavaScript, but the browser would
      // close the other item instantly; from here on this element closes it, animated
      this.#items().forEach((item) => item.removeAttribute('name'));

      this.addEventListener('click', this.#onClick);
      // Items can also open without a click (find-in-page); keep one open when exclusive
      this.addEventListener('toggle', this.#onToggle, true);
      this.addEventListener('shopify:block:select', this.#onBlockSelect);
    }

    disconnectedCallback() {
      this.removeEventListener('click', this.#onClick);
      this.removeEventListener('toggle', this.#onToggle, true);
      this.removeEventListener('shopify:block:select', this.#onBlockSelect);
      this.#running.forEach((_, item) => this.#settle(item));
    }

    get #exclusive() {
      return this.hasAttribute('data-exclusive');
    }

    // Own items only, not the items of an accordion nested inside a panel
    #items() {
      return Array.from(this.querySelectorAll('details[data-vt-accordion-item]')).filter(
        (item) => item.parentElement === this
      );
    }

    // Where an item is heading: its running animation, or its current state
    #isOpening(item) {
      const run = this.#running.get(item);
      return run ? run.opening : item.open;
    }

    #onClick = (event) => {
      const summary = event.target.closest('summary');
      const item = summary?.parentElement;
      if (!item || item.parentElement !== this || summary !== item.querySelector(':scope > summary')) return;

      event.preventDefault();
      this.#set(item, !this.#isOpening(item));
    };

    #onToggle = (event) => {
      const item = event.target;
      if (!this.#exclusive || item.parentElement !== this || !this.#isOpening(item)) return;
      this.#closeOthers(item);
    };

    // Theme editor: show the selected item, or the item holding the selected block
    #onBlockSelect = (event) => {
      this.#items().forEach((item) => {
        if (item.contains(event.target) && !this.#isOpening(item)) this.#set(item, true, false);
      });
    };

    #closeOthers(item, animate = true) {
      this.#items().forEach((other) => {
        if (other !== item && this.#isOpening(other)) this.#set(other, false, animate);
      });
    }

    #set(item, open, animate = true) {
      if (open && this.#exclusive) this.#closeOthers(item, animate);

      const effect = this.dataset.effect;
      if (!animate || effect === 'none' || reducedMotion.matches) {
        this.#settle(item);
        item.open = open;
        return;
      }

      const run = this.#running.get(item);
      if (run?.opening === open || (!run && item.open === open)) return;

      const summary = item.querySelector(':scope > summary');
      const panel = item.querySelector(':scope > .vt-accordion__panel');

      // Start from wherever the item is now, also mid-animation
      const startHeight = item.getBoundingClientRect().height;
      // A closed panel isn't rendered, so it starts from invisible
      const startOpacity = item.open && panel ? parseFloat(getComputedStyle(panel).opacity) : 0;
      this.#settle(item);

      item.open = true;
      item.classList.toggle('is-closing', !open);
      item.style.overflow = 'hidden';

      // Closed height: the header plus the item's own borders
      const endHeight = open
        ? item.getBoundingClientRect().height
        : summary.getBoundingClientRect().height + (item.offsetHeight - item.clientHeight);

      const options = { duration: durationFor(Math.abs(endHeight - startHeight)), easing: EASING, fill: 'forwards' };
      const animations = [item.animate({ height: [`${startHeight}px`, `${endHeight}px`] }, options)];

      if (effect === 'slide_fade' && panel) {
        animations.push(
          panel.animate(
            {
              opacity: [startOpacity, open ? 1 : 0],
              transform: open ? ['translateY(-0.5rem)', 'none'] : ['none', 'translateY(-0.5rem)'],
            },
            options
          )
        );
      }

      const entry = { opening: open, animations };
      this.#running.set(item, entry);

      animations[0].finished
        .then(() => {
          if (this.#running.get(item) !== entry) return;
          if (!open) item.open = false;
          this.#settle(item);
        })
        .catch(() => {});
    }

    // Drop an item's animation and inline state, leaving it as it is
    #settle(item) {
      this.#running.get(item)?.animations.forEach((animation) => animation.cancel());
      this.#running.delete(item);
      item.classList.remove('is-closing');
      item.style.overflow = '';
    }
  }

  customElements.define('vt-accordion', VtAccordion);
}

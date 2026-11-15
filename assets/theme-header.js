/**
 * Header: sticky behavior, hamburger state and cart count.
 * Country and language popovers: assets/theme-localization.js.
 */
// Pixels to scroll in one direction before the sticky header hides or comes back
const HIDE_DISTANCE = 8;
const REVEAL_DISTANCE = 16;

class VtHeader extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController();
    const { signal } = this.abort;

    this.addEventListener('click', this.onClick, { signal });
    document.addEventListener('vt:cart:added', this.refreshCartCount, { signal });

    if (this.dataset.sticky !== 'none') {
      this.wrapper = this.closest('.section-header');
      this.lastScrollY = window.scrollY;
      this.scrollTravel = 0;
      window.addEventListener('scroll', this.onScroll, { signal, passive: true });
      // The header height changes with the viewport, the logo and the menu
      this.resizeObserver = new ResizeObserver(() => this.updateSticky());
      this.resizeObserver.observe(this.wrapper);
      this.updateSticky();
    }
  }

  disconnectedCallback() {
    this.abort.abort();
    this.resizeObserver?.disconnect();
    document.documentElement.style.removeProperty('--vt-header-height');
    document.documentElement.style.removeProperty('--vt-header-offset');
  }

  // Keeps the sticky header in view while a selector is open
  get openSelectors() {
    return this.querySelectorAll('[data-localization][open]');
  }

  onClick = (event) => {
    const toggle = event.target.closest('[data-header-menu-toggle]');
    if (!toggle) return;

    const isOpen = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
  };

  onScroll = () => {
    if (this.scrollFrame) return;

    this.scrollFrame = requestAnimationFrame(() => {
      this.scrollFrame = null;
      this.updateSticky();
    });
  };

  updateSticky() {
    const scrollY = Math.max(window.scrollY, 0);
    const { top, height } = this.wrapper.getBoundingClientRect();

    // The line under the header only shows while it covers the page
    this.toggleAttribute('data-stuck', scrollY > 0 && top <= 0);

    if (this.dataset.sticky === 'scroll-up') {
      const delta = scrollY - this.lastScrollY;

      // Distance in the current direction; small reversals from trackpads and inertia restart it
      if (delta !== 0) {
        this.scrollTravel = Math.sign(delta) === Math.sign(this.scrollTravel) ? this.scrollTravel + delta : delta;
      }

      const isPastHeader = scrollY > height * 2;
      const keepVisible = this.openSelectors.length > 0 || this.contains(document.activeElement);

      if (!isPastHeader || keepVisible || this.scrollTravel <= -REVEAL_DISTANCE) {
        this.wrapper.toggleAttribute('data-header-hidden', false);
      } else if (this.scrollTravel >= HIDE_DISTANCE) {
        this.wrapper.toggleAttribute('data-header-hidden', true);
      }
    }

    this.lastScrollY = scrollY;
    this.publishOffset(height);
  }

  /*
    Sticky content further down the page stays clear of the header:
    --vt-header-height: the header's height, for anchor targets (scroll-margin)
    --vt-header-offset: the part of the page it covers now, 0 while it's hidden
  */
  publishOffset(height) {
    const rootStyle = document.documentElement.style;
    const headerHeight = `${Math.round(height)}px`;
    const headerOffset = this.wrapper.hasAttribute('data-header-hidden') ? '0px' : headerHeight;

    if (headerHeight !== this.headerHeight) {
      this.headerHeight = headerHeight;
      rootStyle.setProperty('--vt-header-height', headerHeight);
    }
    if (headerOffset !== this.headerOffset) {
      this.headerOffset = headerOffset;
      rootStyle.setProperty('--vt-header-offset', headerOffset);
    }
  }

  refreshCartCount = async () => {
    const link = this.querySelector('[data-header-cart]');
    const count = this.querySelector('[data-header-cart-count]');
    if (!link || !count) return;

    try {
      // link.href is the localized cart route; ".js" returns JSON
      const response = await fetch(`${link.href}.js`, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;

      const { item_count: itemCount } = await response.json();
      count.textContent = itemCount;
      count.hidden = itemCount === 0;
    } catch {
      // The count refreshes on the next page load
    }
  };
}

if (!customElements.get('vt-header')) customElements.define('vt-header', VtHeader);

/**
 * Header: sticky behavior, hamburger state, selector popovers and cart count.
 */
// Pixels to scroll in one direction before the sticky header hides or comes back
const HIDE_DISTANCE = 8;
const REVEAL_DISTANCE = 16;

class VtHeader extends HTMLElement {
  connectedCallback() {
    this.abort = new AbortController();
    const { signal } = this.abort;

    this.addEventListener('click', this.onClick, { signal });
    this.addEventListener('toggle', this.onToggle, { signal, capture: true });
    this.addEventListener('focusout', this.onFocusOut, { signal });
    document.addEventListener('click', this.onDocumentClick, { signal });
    document.addEventListener('keydown', this.onKeydown, { signal });
    document.addEventListener('vt:cart:added', this.refreshCartCount, { signal });

    if (this.dataset.sticky !== 'none') {
      this.wrapper = this.closest('.section-header');
      this.lastScrollY = window.scrollY;
      this.scrollTravel = 0;
      window.addEventListener('scroll', this.onScroll, { signal, passive: true });
      this.updateSticky();
    }
  }

  disconnectedCallback() {
    this.abort.abort();
  }

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

  // Only one selector stays open at a time
  onToggle = (event) => {
    if (!event.target.matches('[data-localization]') || !event.target.open) return;

    this.openSelectors.forEach((selector) => {
      if (selector !== event.target) selector.open = false;
    });
  };

  onFocusOut = (event) => {
    const selector = event.target.closest('[data-localization]');
    if (selector && event.relatedTarget && !selector.contains(event.relatedTarget)) selector.open = false;
  };

  onDocumentClick = (event) => {
    this.openSelectors.forEach((selector) => {
      if (!selector.contains(event.target)) selector.open = false;
    });
  };

  onKeydown = (event) => {
    if (event.key !== 'Escape') return;

    this.openSelectors.forEach((selector) => {
      selector.open = false;
      selector.querySelector('summary').focus();
    });
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

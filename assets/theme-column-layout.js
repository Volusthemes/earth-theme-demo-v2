/*
  Column layout carousel: turns the columns into a Swiper below 1024px.
  Loaded by blocks/column-layout.liquid as a module, only when "Swipeable columns" is on.
  A module runs once per page, however many column layouts the page has.
*/

if (!customElements.get('vt-column-layout')) {
  class VtColumnLayout extends HTMLElement {
    #swiper = null;
    #autoplayHeld = false;
    #mediaQuery = window.matchMedia('(max-width: 1023.98px)');

    connectedCallback() {
      if (this.dataset.swipe !== 'true') return;

      this.#mediaQuery.addEventListener('change', this.#sync);

      // Autoplay pauses while keyboard focus is inside, so a slide never moves away mid-read
      this.addEventListener('focusin', this.#pauseAutoplay);
      this.addEventListener('focusout', this.#resumeAutoplay);

      if (this.dataset.editor === 'true') {
        this.addEventListener('shopify:block:select', this.#onBlockSelect);
        this.addEventListener('shopify:block:deselect', this.#resumeAutoplay);
      }

      // swiper-bundle.min.js is deferred in theme.liquid: if it has not run
      // yet, it will have by DOMContentLoaded.
      if (typeof window.Swiper === 'function') {
        this.#sync();
      } else {
        document.addEventListener('DOMContentLoaded', this.#sync, { once: true });
      }
    }

    disconnectedCallback() {
      this.#mediaQuery.removeEventListener('change', this.#sync);
      document.removeEventListener('DOMContentLoaded', this.#sync);
      this.removeEventListener('shopify:block:select', this.#onBlockSelect);
      this.removeEventListener('shopify:block:deselect', this.#resumeAutoplay);
      this.removeEventListener('focusin', this.#pauseAutoplay);
      this.removeEventListener('focusout', this.#resumeAutoplay);
      this.#destroy();
    }

    // Carousel only below 1024px; above it the CSS Grid layout is used.
    #sync = () => {
      if (!this.isConnected) return;
      if (this.#mediaQuery.matches) {
        this.#init();
      } else {
        this.#destroy();
      }
    };

    #toShares(value) {
      const shares = (value || '').split(' ').filter(Boolean);
      return shares.length ? shares : ['100'];
    }

    #init() {
      if (this.#swiper || typeof window.Swiper !== 'function') return;

      const viewport = this.querySelector('.vt-column-layout__viewport');
      const list = this.querySelector('.vt-column-layout__list');
      if (!viewport || !list) return;

      const slides = [...list.children].filter(
        (child) => !child.classList.contains('vt-column-layout__placeholder')
      );
      if (slides.length < 2) return;

      // Column widths repeat per row in the grid; do the same per slide.
      const mobileShares = this.#toShares(this.dataset.mobileShares);
      const tabletShares = this.#toShares(this.dataset.tabletShares);

      viewport.classList.add('swiper');
      list.classList.add('swiper-wrapper');
      slides.forEach((slide, index) => {
        slide.classList.add('swiper-slide');
        slide.style.setProperty('--vt-slide-share-mobile', mobileShares[index % mobileShares.length]);
        slide.style.setProperty('--vt-slide-share-tablet', tabletShares[index % tabletShares.length]);
      });

      this.#applyBleed(viewport);

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const autoplay = this.dataset.autoplay === 'true' && !prefersReducedMotion;

      this.#swiper = new window.Swiper(viewport, {
        slidesPerView: 'auto',
        spaceBetween: Number(this.dataset.mobileGap) || 0,
        breakpoints: {
          768: { spaceBetween: Number(this.dataset.tabletGap) || 0 },
        },
        speed: prefersReducedMotion ? 0 : 300,
        watchOverflow: true,
        autoplay: autoplay
          ? {
              delay: parseInt(this.dataset.autoplayDelay, 10) || 5000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }
          : false,
        on: {
          // Section padding can change with the screen width: measure again first
          beforeResize: () => this.#applyBleed(viewport),
        },
        a11y: {
          enabled: true,
          containerRole: 'group',
          containerMessage: this.dataset.labelContainer,
          containerRoleDescriptionMessage: this.dataset.labelCarousel,
          itemRoleDescriptionMessage: this.dataset.labelSlideRole,
          slideLabelMessage: (this.dataset.labelSlide || '')
            .replace('__index__', '{{index}}')
            .replace('__total__', '{{slidesLength}}'),
        },
      });
    }      

    #destroy() {
      if (!this.#swiper) return;

      this.#autoplayHeld = false;
      const { el, wrapperEl, slides } = this.#swiper;
      this.#swiper.destroy(true, true);
      this.#swiper = null;

      el.style.removeProperty('margin-left');
      el.style.removeProperty('margin-right');
      el.style.removeProperty('padding-left');
      el.style.removeProperty('padding-right');
      el.classList.remove('swiper');
      ['role', 'aria-label', 'aria-roledescription'].forEach((name) => el.removeAttribute(name));

      wrapperEl.classList.remove('swiper-wrapper');
      ['id', 'aria-live', 'aria-atomic'].forEach((name) => wrapperEl.removeAttribute(name));

      slides.forEach((slide) => {
        slide.classList.remove('swiper-slide');
        ['role', 'aria-label', 'aria-roledescription', 'aria-hidden'].forEach((name) =>
          slide.removeAttribute(name)
        );
        slide.style.removeProperty('--vt-slide-share-mobile');
        slide.style.removeProperty('--vt-slide-share-tablet');
      });
    }

    /*
      "Run to section edges" (on by default): let the slides run to the section's edges instead of being cut at the content
      edge (section padding, page width padding). The viewport grows by the distance
      to each edge with a negative margin, and the same padding keeps the first slide
      on the content edge. Swiper sizes slides from the padded box, so their width
      stays a share of the content. Measured from this element's content box, so the
      result does not depend on a previous measurement.
    */
    #applyBleed(viewport) {
      if (this.dataset.bleed === 'false') return;

      const section = this.closest('.vt-section') || document.documentElement;
      const sectionBox = section.getBoundingClientRect();
      const box = this.getBoundingClientRect();
      const styles = getComputedStyle(this);
      const start = Math.max(0, Math.round(box.left + parseFloat(styles.paddingLeft) - sectionBox.left));
      const end = Math.max(0, Math.round(sectionBox.right - (box.right - parseFloat(styles.paddingRight))));

      viewport.style.marginLeft = `${-start}px`;
      viewport.style.marginRight = `${-end}px`;
      viewport.style.paddingLeft = `${start}px`;
      viewport.style.paddingRight = `${end}px`;
    }

    // stop()/start() rather than pause(): Swiper resumes a paused autoplay on its own after a slide change
    #pauseAutoplay = () => {
      if (!this.#swiper?.autoplay?.running) return;
      this.#autoplayHeld = true;
      this.#swiper.autoplay.stop();
    };

    #resumeAutoplay = (event) => {
      if (event?.type === 'focusout' && this.contains(event.relatedTarget)) return;
      if (!this.#autoplayHeld || !this.#swiper) return;
      this.#autoplayHeld = false;
      this.#swiper.autoplay.start();
    };

    // Theme editor: bring the selected block's slide into view and hold it there.
    #onBlockSelect = (event) => {
      if (!this.#swiper) return;
      this.#pauseAutoplay();
      const slide = event.target.closest?.('.swiper-slide');
      const index = slide ? this.#swiper.slides.indexOf(slide) : -1;
      if (index >= 0) this.#swiper.slideTo(index);
    };
  }

  customElements.define('vt-column-layout', VtColumnLayout);
}

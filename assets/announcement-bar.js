/**
 * Earth Theme - Announcement Bar
 * Custom Element: <vt-announcement-bar>
 * Desktop: the chosen effect with autoplay. Mobile: a slide carousel moved by the
 * visitor. Swiper can't switch effects at a breakpoint, so the carousel is rebuilt
 * with assets/theme-slider.js whenever the viewport crosses it.
 */

if (!customElements.get('vt-announcement-bar')) {
  class VtAnnouncementBar extends HTMLElement {
    connectedCallback() {
      this.controller = new AbortController();
      const { signal } = this.controller;

      this.closeButton = this.querySelector('[data-announcement-close]');
      this.closeButton?.addEventListener('click', () => this.close(), { signal });

      if (this.wasClosed) {
        this.hidden = true;
        return;
      }

      this.slider = this.querySelector('[data-swiper]');
      if (!this.slider || this.slider.querySelectorAll('.swiper-slide').length < 2) return;

      this.desktop = window.matchMedia('(min-width: 750px)');
      this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.wantsAutoplay = this.dataset.autoplay === 'true' && !this.reducedMotion;
      this.pausedByVisitor = false;

      this.playback = this.querySelector('[data-announcement-playback]');
      if (this.playback) this.playback.hidden = !this.wantsAutoplay;
      this.playback?.addEventListener('click', () => this.togglePlayback(), { signal });

      this.desktop.addEventListener('change', () => this.build(), { signal });

      // Keyboard users read the current announcement without it changing
      this.addEventListener('focusin', () => this.swiper?.autoplay?.stop(), { signal });
      this.addEventListener(
        'focusout',
        (event) => {
          if (!this.contains(event.relatedTarget)) this.resume();
        },
        { signal }
      );

      // Theme editor: show the announcement the merchant selected
      this.addEventListener(
        'shopify:block:select',
        (event) => {
          const slide = event.target.closest('.swiper-slide');
          if (!slide || !this.swiper) return;
          this.swiper.autoplay?.stop();
          if (this.swiper.params.loop) this.swiper.slideToLoop(Number(slide.dataset.swiperSlideIndex), 0);
          else this.swiper.slideTo(this.swiper.slides.indexOf(slide), 0);
        },
        { signal }
      );
      this.addEventListener('shopify:block:deselect', () => this.resume(), { signal });

      this.build();
    }

    disconnectedCallback() {
      this.controller?.abort();
      if (this.slider) window.vtSlider?.destroy(this.slider);
    }

    get storageKey() {
      return `vt-announcement-closed-${this.id}`;
    }

    get remembersClose() {
      return this.dataset.closePersistence === 'session' && !window.Shopify?.designMode;
    }

    get wasClosed() {
      if (!this.remembersClose) return false;
      try {
        return Boolean(sessionStorage.getItem(this.storageKey));
      } catch {
        return false;
      }
    }

    build() {
      if (!window.vtSlider) return;
      const { dataset } = this.slider;
      const isDesktop = this.desktop.matches;

      dataset.effect = isDesktop ? this.dataset.effect : 'slide';
      dataset.speed = this.reducedMotion ? '0' : this.dataset.speed;
      dataset.touch = String(!isDesktop);
      dataset.autoplay = String(isDesktop && this.wantsAutoplay);

      window.vtSlider.destroy(this.slider);
      this.swiper = window.vtSlider.init(this.slider);
      if (isDesktop && this.pausedByVisitor) this.swiper?.autoplay?.stop();
      this.updatePlayback();
    }

    togglePlayback() {
      this.pausedByVisitor = !this.pausedByVisitor;
      if (this.pausedByVisitor) this.swiper?.autoplay?.stop();
      else this.resume();
      this.updatePlayback();
    }

    resume() {
      if (this.wantsAutoplay && !this.pausedByVisitor && this.desktop.matches) this.swiper?.autoplay?.start();
    }

    updatePlayback() {
      if (!this.playback) return;
      const paused = this.pausedByVisitor;
      this.playback.setAttribute('aria-label', paused ? this.playback.dataset.labelPlay : this.playback.dataset.labelPause);
      this.playback.setAttribute('aria-pressed', String(paused));
      this.playback.querySelector('.announcement-bar__play-icon').hidden = !paused;
      this.playback.querySelector('.announcement-bar__pause-icon').hidden = paused;
    }

    close() {
      this.swiper?.autoplay?.stop();
      this.hidden = true;
      if (!this.remembersClose) return;
      try {
        sessionStorage.setItem(this.storageKey, 'true');
      } catch {
        // Storage can be unavailable: the bar simply comes back on the next page
      }
    }
  }

  customElements.define('vt-announcement-bar', VtAnnouncementBar);
}

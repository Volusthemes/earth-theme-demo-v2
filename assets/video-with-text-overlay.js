/**
 * Video With Text Overlay Component
 * Starts the visible player (desktop or mobile) only when it is needed, keeps the
 * poster until the video really plays, and syncs the play / pause button.
 */

if (!customElements.get('vt-video-overlay')) {
  class VtVideoOverlay extends HTMLElement {
    connectedCallback() {
      this.players = Array.from(this.querySelectorAll('[data-video-player]'));
      if (!this.players.length) return;

      this.controller = new AbortController();
      const { signal } = this.controller;

      // Reduced motion: stay on the poster until the visitor presses play
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.resumeInView = this.dataset.autoplay === 'true' && !reducedMotion;
      this.pausedByVisitor = false;

      this.addEventListener(
        'click',
        (event) => {
          if (!event.target.closest('.vt-video-overlay__toggle, .vt-video-overlay__play-btn')) return;
          this.pausedByVisitor = this.isPlaying;
          this.isPlaying ? this.pause() : this.play();
        },
        { signal }
      );

      this.players.filter((player) => player.tagName === 'VIDEO').forEach((video) => {
        video.addEventListener(
          'playing',
          () => {
            video.classList.add('is-started');
            this.setPlaying(true);
          },
          { signal }
        );
        video.addEventListener(
          'pause',
          () => {
            if (video === this.activePlayer) this.setPlaying(false);
          },
          { signal }
        );
        video.addEventListener(
          'ended',
          () => {
            video.classList.remove('is-started');
            video.currentTime = 0;
          },
          { signal }
        );
      });

      // Crossing the breakpoint hands playback over to the other player
      window.matchMedia('(max-width: 749px)').addEventListener(
        'change',
        () => {
          const wasPlaying = this.isPlaying;
          this.players.forEach((player) => this.pause(player));
          if (wasPlaying) this.play();
        },
        { signal }
      );

      this.observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            if (this.resumeInView && !this.pausedByVisitor) this.play();
          } else if (this.isPlaying) {
            this.resumeInView = true;
            this.pause();
          }
        },
        { threshold: 0.1 }
      );
      this.observer.observe(this);
    }

    disconnectedCallback() {
      this.controller?.abort();
      this.observer?.disconnect();
    }

    get isPlaying() {
      return this.classList.contains('is-playing');
    }

    get activePlayer() {
      return this.players.find((player) => getComputedStyle(player).display !== 'none');
    }

    setPlaying(playing) {
      this.classList.toggle('is-playing', playing);
      this.querySelectorAll('.vt-video-overlay__toggle, .vt-video-overlay__play-btn').forEach((button) => {
        button.setAttribute('aria-label', playing ? button.dataset.labelPause : button.dataset.labelPlay);
      });
    }

    play(player = this.activePlayer) {
      if (!player) return;

      if (player.tagName === 'VIDEO') {
        // Rejected in low power mode: the poster and the play button stay
        player.play()?.catch(() => this.setPlaying(false));
        return;
      }

      this.setPlaying(true);
      if (player.getAttribute('src')) {
        this.sendCommand(player, 'play');
        return;
      }

      // The short wait hides the title bar the provider shows while loading
      player.addEventListener('load', () => setTimeout(() => player.classList.add('is-started'), 800), { once: true });
      player.setAttribute('src', player.dataset.src);
    }

    pause(player = this.activePlayer) {
      if (!player) return;

      if (player.tagName === 'VIDEO') {
        player.pause();
        return;
      }

      if (player === this.activePlayer) this.setPlaying(false);
      if (player.getAttribute('src')) this.sendCommand(player, 'pause');
    }

    sendCommand(iframe, command) {
      // The players always end up on https, even if the page is on http (local preview)
      const { hostname } = new URL(iframe.src);
      const message = hostname.includes('vimeo')
        ? { method: command }
        : { event: 'command', func: `${command}Video`, args: [] };
      iframe.contentWindow?.postMessage(JSON.stringify(message), `https://${hostname}`);
    }
  }

  customElements.define('vt-video-overlay', VtVideoOverlay);
}

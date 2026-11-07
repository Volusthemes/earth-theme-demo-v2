/*
  Shared Swiper carousel for sections and blocks.
  Loaded once in layout/theme.liquid, after swiper-bundle.min.js
*/


(function () {
  if (window.vtSlider) return;

  const desktop = window.matchMedia('(min-width: 990px)');

  const updateArrowState = (swiper, prevBtn, nextBtn) => {
    if (!prevBtn || !nextBtn) return;
    // When watchOverflow is true and not enough slides, Swiper locks
    const locked = swiper.isLocked;
    // A looping carousel has no first or last stop, so its arrows stay enabled
    const loops = swiper.params.loop;
    const atStart = locked || (!loops && swiper.isBeginning);
    const atEnd = locked || (!loops && swiper.isEnd);

    prevBtn.setAttribute('aria-disabled', atStart ? 'true' : 'false');
    nextBtn.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
  };

  const fillLoop = (container, perView) => {
    const wrapper = container.querySelector('.swiper-wrapper');
    const originals = Array.from(wrapper?.querySelectorAll(':scope > .swiper-slide') || []);
    if (originals.length < 2) return;
    const needed = Math.ceil(perView) * 2 + 3;
    for (let count = originals.length; count < needed; count += originals.length) {
      originals.forEach((slide) => {
        const copy = slide.cloneNode(true);
        copy.dataset.vtLoopCopy = '';
        // Unique ids stay on the original; copies aren't theme editor blocks
        [copy, ...copy.querySelectorAll('*')].forEach((el) => {
          el.removeAttribute('id');
          Array.from(el.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-shopify')) el.removeAttribute(attr.name);
          });
        });
        wrapper.appendChild(copy);
      });
    }
  };

  const init = (container) => {
    if (!container) return null;
    if (container.dataset.swiperReady === 'true') return container._swiperInstance || null;
    if (typeof Swiper === 'undefined') return null;

    const data = container.dataset;

    // Blocks that can't carry Swiper's class themselves (e.g. image blocks as slides):
    // every direct child of the wrapper becomes a slide
    if (data.slideChildren === 'true') {
      container.querySelector('.swiper-wrapper')?.querySelectorAll(':scope > *').forEach((child) => {
        child.classList.add('swiper-slide');
      });
    }

    const slidesDesktop = parseFloat(data.slidesDesktop) || 4;
    const slidesTablet = (parseFloat(data.slidesTablet) || 3) + (parseFloat(data.peekTablet) || 0);
    const slidesMobile = (parseFloat(data.slidesMobile) || 2) + (parseFloat(data.peekMobile) || 0);
    const desktopDrag = data.desktopDrag !== 'false';
    const loop = data.loop === 'true';

    // Loop with only a few slides: Swiper moves some of them before the current one, so the
    // far end can run out and show an empty gap. Opt-in: copy the slides until both ends stay full
    if (loop && data.loopFill === 'true') {
      fillLoop(container, Math.max(slidesDesktop, slidesTablet, slidesMobile));
    }
    const autoplay = data.autoplay === 'true' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const autoplayDelay = parseInt(data.autoplayDelay, 10) || 4000;

    // Gap is a CSS length (often a fluid clamp()); Swiper needs px, so read
    // the resolved value and refresh it on every resize
    const getGap = () => parseFloat(getComputedStyle(container).columnGap) || 0;

    // Offset (desktop): every stop sits a % of the carousel width from the left edge
    const offsetPercent = data.slideStyle === 'offset' ? parseFloat(data.slideOffset) || 0 : 0;
    // Center: the current slide sits in the middle, the slides on either side show equally
    const centered = data.slideStyle === 'center';
    const getOffset = () => (desktop.matches ? (container.clientWidth * offsetPercent) / 100 : 0);

    // Below desktop: when CSS bleeds the carousel past the side margins (negative
    // margins), start and end on those margins so the first and last slides line up
    const getBleed = (side) =>
      Math.max(0, -parseFloat(getComputedStyle(container).getPropertyValue(`margin-inline-${side}`)) || 0);
    const getOffsetBefore = () => (desktop.matches ? getOffset() : getBleed('start'));
    const getOffsetAfter = () => (desktop.matches ? getOffset() : getBleed('end'));

    // Arrows follow the same offset (CSS reads --vt-swiper-offset)
    const setArrowOffset = () => container.style.setProperty('--vt-swiper-offset', `${getOffset()}px`);

    const prevBtn = container.querySelector('[data-swiper-prev]');
    const nextBtn = container.querySelector('[data-swiper-next]');

    // Optional, default to Swiper's slide effect, speed and touch
    const touch = data.touch !== 'false';
    const speed = data.speed !== undefined ? { speed: parseInt(data.speed, 10) || 0 } : {};
    const effect = data.effect === 'fade' ? { effect: 'fade', fadeEffect: { crossFade: true } } : {};

    const swiper = new Swiper(container, {
      ...speed,
      ...effect,
      slidesPerView: slidesMobile,
      spaceBetween: getGap(),
      watchOverflow: true,
      centeredSlides: centered,
      slidesOffsetBefore: getOffsetBefore(),
      slidesOffsetAfter: getOffsetAfter(),
      loop: loop && container.querySelectorAll('.swiper-slide').length > slidesDesktop,
      autoplay: autoplay ? { delay: autoplayDelay, disableOnInteraction: false, pauseOnMouseEnter: true } : false,
      navigation: {
        prevEl: prevBtn,
        nextEl: nextBtn,
        disabledClass: 'is-disabled',
      },
      allowTouchMove: touch,
      breakpoints: {
        750: { slidesPerView: slidesTablet, allowTouchMove: touch },
        990: { slidesPerView: slidesDesktop, allowTouchMove: touch && desktopDrag },
      },
      // Translated labels from Liquid (Swiper's a11y would otherwise set English ones)
      a11y: {
        prevSlideMessage: prevBtn?.getAttribute('aria-label') || '',
        nextSlideMessage: nextBtn?.getAttribute('aria-label') || '',
      },
      on: {
        beforeResize(s) {
          s.params.spaceBetween = getGap();
          s.params.slidesOffsetBefore = getOffsetBefore();
          s.params.slidesOffsetAfter = getOffsetAfter();
        },
        init(s) {
          setArrowOffset();
          updateArrowState(s, prevBtn, nextBtn);
        },
        slideChange(s) {
          updateArrowState(s, prevBtn, nextBtn);
        },
        resize(s) {
          setArrowOffset();
          updateArrowState(s, prevBtn, nextBtn);
        },
      },
    });

    container.dataset.swiperReady = 'true';
    container._swiperInstance = swiper;
    return swiper;
  };

  const destroy = (container) => {
    if (!container?._swiperInstance) return;
    container._swiperInstance.destroy(true, true);
    container.querySelectorAll('[data-vt-loop-copy]').forEach((copy) => copy.remove());
    container._swiperInstance = null;
    container.dataset.swiperReady = 'false';
  };

  const initAuto = (root = document) => {
    root.querySelectorAll('[data-swiper][data-swiper-auto]').forEach(init);
  };

  window.vtSlider = { init, destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAuto());
  } else {
    initAuto();
  }

  document.addEventListener('shopify:section:load', (event) => initAuto(event.target));
})();

/*
  Shared Swiper carousel for sections and blocks.
  Loaded once in layout/theme.liquid, after swiper-bundle.min.js

  data-slides-auto="true": slides keep the width their CSS gives them (Swiper's
  slidesPerView 'auto'), for carousels whose slide width is a share of the page
  rather than of the carousel (e.g. a carousel that runs to the screen edge).
  data-swiper-block-select: the theme editor shows a slide when its block is selected.
  data-slide-style="page" (Align with page, desktop): the carousel runs to both screen
  edges while its first and last slides line up with the page content around it.
  Slide widths come from CSS (assets/theme.css, ALIGN WITH PAGE).
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
    const slidesAuto = data.slidesAuto === 'true';

    // Loop with only a few slides: Swiper moves some of them before the current one, so the
    // far end can run out and show an empty gap. Opt-in: copy the slides until both ends stay full
    if (loop && data.loopFill === 'true') {
      fillLoop(container, slidesAuto ? 3 : Math.max(slidesDesktop, slidesTablet, slidesMobile));
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
    // Align with page (desktop): runs to the screen edges, stops on the page content
    const pageAligned = data.slideStyle === 'page';

    // When CSS or applyPageBleed bleeds the carousel past the side margins (negative
    // margins), start and end on those margins so the first and last slides line up
    const getBleed = (side) =>
      Math.max(0, -parseFloat(getComputedStyle(container).getPropertyValue(`margin-inline-${side}`)) || 0);
    const getOffset = () => {
      if (!desktop.matches) return 0;
      return pageAligned ? getBleed('start') : (container.clientWidth * offsetPercent) / 100;
    };
    const getOffsetBefore = () => (desktop.matches && !pageAligned ? getOffset() : getBleed('start'));
    const getOffsetAfter = () => (desktop.matches && !pageAligned ? getOffset() : getBleed('end'));

    // Align with page: measure the content edges against the visible screen width
    // (clientWidth leaves out a classic scrollbar, which 100vw in CSS can't), then bleed
    // to the screen edges. CSS holds a close fallback until this runs.
    const pageBleedProps = ['margin-inline', '--vt-carousel-bleed-start', '--vt-carousel-bleed-end'];
    const applyPageBleed = () => {
      if (!pageAligned) return;
      pageBleedProps.forEach((prop) => container.style.removeProperty(prop));
      if (!desktop.matches) return;
      const parent = container.parentElement;
      const box = parent.getBoundingClientRect();
      const parentStyle = getComputedStyle(parent);
      const start = Math.max(0, box.left + parseFloat(parentStyle.paddingLeft));
      const end = Math.max(0, document.documentElement.clientWidth - box.right + parseFloat(parentStyle.paddingRight));
      container.style.setProperty('margin-inline', `${-start}px ${-end}px`);
      container.style.setProperty('--vt-carousel-bleed-start', `${start}px`);
      container.style.setProperty('--vt-carousel-bleed-end', `${end}px`);
    };
    applyPageBleed();

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
      slidesPerView: slidesAuto ? 'auto' : slidesMobile,
      spaceBetween: getGap(),
      watchOverflow: true,
      centeredSlides: centered,
      slidesOffsetBefore: getOffsetBefore(),
      slidesOffsetAfter: getOffsetAfter(),
      loop: loop && container.querySelectorAll('.swiper-slide').length > (slidesAuto ? 2 : slidesDesktop),
      autoplay: autoplay ? { delay: autoplayDelay, disableOnInteraction: false, pauseOnMouseEnter: true } : false,
      navigation: {
        prevEl: prevBtn,
        nextEl: nextBtn,
        disabledClass: 'is-disabled',
      },
      allowTouchMove: touch,
      breakpoints: {
        750: { slidesPerView: slidesAuto ? 'auto' : slidesTablet, allowTouchMove: touch },
        990: { slidesPerView: slidesAuto || pageAligned ? 'auto' : slidesDesktop, allowTouchMove: touch && desktopDrag },
      },
      // Translated labels from Liquid (Swiper's a11y would otherwise set English ones)
      a11y: {
        prevSlideMessage: prevBtn?.getAttribute('aria-label') || '',
        nextSlideMessage: nextBtn?.getAttribute('aria-label') || '',
      },
      on: {
        beforeResize(s) {
          applyPageBleed();
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
    ['margin-inline', '--vt-carousel-bleed-start', '--vt-carousel-bleed-end'].forEach((prop) => container.style.removeProperty(prop));
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

  // Theme editor: show a slide when its block is selected, and hold it there
  document.addEventListener('shopify:block:select', (event) => {
    const slide = event.target.closest?.('[data-swiper-block-select] .swiper-slide');
    const swiper = slide?.closest('[data-swiper]')?._swiperInstance;
    if (!swiper) return;
    const index = Number(slide.dataset.swiperSlideIndex ?? swiper.slides.indexOf(slide));
    if (Number.isNaN(index) || index < 0) return;
    swiper.autoplay?.stop();
    if (swiper.params.loop) swiper.slideToLoop(index);
    else swiper.slideTo(index);
  });

  document.addEventListener('shopify:block:deselect', (event) => {
    const swiper = event.target.closest?.('[data-swiper-block-select]')?._swiperInstance;
    if (swiper?.params.autoplay?.enabled) swiper.autoplay.start();
  });

  document.addEventListener('shopify:section:unload', (event) => {
    event.target.querySelectorAll?.('[data-swiper-block-select]').forEach(destroy);
  });
})();

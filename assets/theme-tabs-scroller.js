/*
  Shared tabs row that swipes sideways when it doesn't fit (CSS: .vt-tabs-scroller in theme.css).
*/

(function () {
  if (window.vtTabsScroller) return;
  
  const init = (scroller, content) => {
    if (!scroller) return null;

    const updateFade = () => {
      const max = scroller.scrollWidth - scroller.clientWidth;
      const pos = Math.abs(scroller.scrollLeft);
      scroller.classList.toggle('has-overflow-start', max > 1 && pos > 1);
      scroller.classList.toggle('has-overflow-end', max > 1 && pos < max - 1);
    };

    const scrollIntoView = (tab) => {
      if (!tab || scroller.scrollWidth <= scroller.clientWidth) return;
      const style = getComputedStyle(scroller);
      const box = scroller.getBoundingClientRect();
      const rect = tab.getBoundingClientRect();
      const start = box.left + (parseFloat(style.paddingLeft) || 0);
      const end = box.right - (parseFloat(style.paddingRight) || 0);
      let delta = 0;
      if (rect.left < start) delta = rect.left - start;
      else if (rect.right > end) delta = rect.right - end;
      if (delta) scroller.scrollBy({ left: delta, behavior: 'smooth' });
    };

    scroller.addEventListener('scroll', updateFade, { passive: true });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateFade);
      observer.observe(scroller);
      if (content) observer.observe(content);
    } else {
      window.addEventListener('resize', updateFade);
    }
    updateFade();

    return { scrollIntoView, update: updateFade };
  };

  window.vtTabsScroller = { init };
})();

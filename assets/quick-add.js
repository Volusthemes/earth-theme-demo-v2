/**
 * Product card actions: quick add / quick view modal and AJAX add to cart.
 *
 * - [data-vt-quick-add][data-product-url] buttons open a <dialog> whose content is
 *   server-rendered by sections/quick-add.liquid (Section Rendering API).
 * - form[data-vt-cart-form] (card buttons and the modal) add to cart without a
 *   page load; without JS they still submit normally.
 *
 * Loaded as a module, so it runs once however many cards include it.
 */

const SECTION_ID = 'quick-add';
const DONE_MS = 2000;

let dialog;
let lastTrigger;
let fetchController;

/* ---------- Styles: loaded on first use only ---------- */

function ensureStyles() {
  if (document.querySelector('link[data-vt-quick-add-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('quick-add.css', import.meta.url).href;
  link.dataset.vtQuickAddCss = '';
  document.head.append(link);
}

/* ---------- Screen reader announcements for card buttons ---------- */

function announce(message) {
  let region = document.getElementById('vt-cart-announcer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'vt-cart-announcer';
    region.setAttribute('role', 'status');
    region.style.cssText =
      'position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;';
    document.body.append(region);
  }
  // Clear first so repeating the same message is announced again
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

/* ---------- Dialog ---------- */

function getDialog() {
  if (dialog) return dialog;

  dialog = document.createElement('dialog');
  dialog.className = 'vt-quick-add';
  dialog.setAttribute('aria-labelledby', 'vt-quick-add-title');

  dialog.addEventListener('click', (event) => {
    // Click on the backdrop (the dialog box itself, outside its content) or the close button
    if (event.target === dialog || event.target.closest('[data-vt-qa-close]')) dialog.close();
  });

  dialog.addEventListener('close', () => {
    dialog.replaceChildren();
    // Return focus to the button that opened the modal
    lastTrigger?.focus();
  });

  document.body.append(dialog);
  return dialog;
}

async function openQuickAdd(trigger) {
  ensureStyles();
  fetchController?.abort();
  fetchController = new AbortController();

  const productUrl = trigger.dataset.productUrl;
  trigger.setAttribute('aria-busy', 'true');

  try {
    const url = new URL(productUrl, window.location.origin);
    url.searchParams.set('section_id', SECTION_ID);

    const response = await fetch(url, { signal: fetchController.signal });
    if (!response.ok) throw new Error(`Quick add request failed: ${response.status}`);

    const html = await response.text();
    const content = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-vt-qa-content]');
    if (!content) throw new Error('Quick add content missing');

    const modal = getDialog();
    modal.replaceChildren(content);
    lastTrigger = trigger;
    modal.showModal();
    initVariantPicker(content);
  } catch (error) {
    if (error.name === 'AbortError') return;
    // Anything goes wrong: fall back to the product page
    window.location.href = productUrl;
  } finally {
    trigger.removeAttribute('aria-busy');
  }
}

/* ---------- Variant picker inside the modal ---------- */

function initVariantPicker(root) {
  const dataEl = root.querySelector('[data-vt-qa-variants]');
  if (!dataEl) return;

  const variants = JSON.parse(dataEl.textContent);
  const fieldsets = [...root.querySelectorAll('[data-vt-qa-option]')];
  const idInput = root.querySelector('[data-vt-qa-variant-id]');
  const priceEl = root.querySelector('[data-vt-qa-price]');
  const submit = root.querySelector('[data-vt-qa-submit]');
  const labels = root.querySelector('[data-vt-qa-price-labels]')?.content;
  const saleLabel = labels?.querySelector('[data-sale]')?.textContent ?? '';
  const regularLabel = labels?.querySelector('[data-regular]')?.textContent ?? '';

  const renderPrice = (variant) => {
    priceEl.replaceChildren();
    const sr = (text) => Object.assign(document.createElement('span'), { className: 'vt-quick-add__sr', textContent: text });

    if (variant.compare) {
      const compare = Object.assign(document.createElement('s'), { className: 'vt-quick-add__compare', textContent: variant.compare });
      priceEl.append(sr(saleLabel), document.createTextNode(`${variant.price} `), sr(regularLabel), compare);
    } else {
      priceEl.textContent = variant.price;
    }
  };

  const update = () => {
    const selected = fieldsets.map((fieldset) => {
      const checked = fieldset.querySelector('input:checked');
      const output = fieldset.querySelector('[data-vt-qa-selected]');
      if (checked && output) output.textContent = checked.value;
      return checked?.value;
    });

    const variant = variants.find((v) => v.options.every((value, index) => value === selected[index]));

    if (!variant) {
      submit.disabled = true;
      submit.textContent = submit.dataset.labelUnavailable;
      return;
    }

    idInput.value = variant.id;
    renderPrice(variant);
    submit.disabled = !variant.available;
    submit.textContent = variant.available ? submit.dataset.labelAdd : submit.dataset.labelSoldOut;
  };

  fieldsets.forEach((fieldset) => fieldset.addEventListener('change', update));
}

/* ---------- AJAX add to cart ---------- */

async function addToCart(form) {
  const button = form.querySelector('[type="submit"]');
  const status = form.querySelector('[data-vt-cart-status]');
  const say = (message) => (status ? (status.textContent = message) : announce(message));

  button.disabled = true;
  button.setAttribute('aria-busy', 'true');

  try {
    // form.action is the localized /cart/add route; ".js" returns JSON
    const response = await fetch(`${form.action}.js`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: new FormData(form),
    });
    const data = await response.json();

    if (!response.ok) {
      say(data.description || data.message || '');
      return;
    }

    say(form.dataset.vtAdded || status?.dataset.added || '');
    button.classList.add('is-done');
    setTimeout(() => button.classList.remove('is-done'), DONE_MS);

    // Let a cart drawer / cart count listen and refresh
    document.dispatchEvent(new CustomEvent('vt:cart:added', { detail: { item: data } }));
  } catch {
    // Network error: submit the form the classic way
    form.submit();
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

/* ---------- Event delegation (works for cards added later, e.g. new tab panels) ---------- */

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-vt-quick-add][data-product-url]');
  if (!trigger) return;
  event.preventDefault();
  openQuickAdd(trigger);
});

document.addEventListener('submit', (event) => {
  const form = event.target.closest('form[data-vt-cart-form]');
  if (!form) return;
  event.preventDefault();
  addToCart(form);
});

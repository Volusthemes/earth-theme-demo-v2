/*
  Country and language selectors (snippets/localization-selector.liquid).
  Shared by the header and the Country and language block, loaded as a module so
  it runs once per page however many selectors there are.

  Each selector is a native <details> whose options submit the localization form,
  so it works without this file. This adds popover behavior to a group:
  - only one selector of the group stays open
  - clicking outside, tabbing away or pressing Escape closes it
*/

if (!customElements.get('vt-localization')) {
  class VtLocalization extends HTMLElement {
    #abort;

    connectedCallback() {
      this.#abort = new AbortController();
      const { signal } = this.#abort;

      this.addEventListener('toggle', this.#onToggle, { signal, capture: true });
      this.addEventListener('focusout', this.#onFocusOut, { signal });
      document.addEventListener('click', this.#onDocumentClick, { signal });
      document.addEventListener('keydown', this.#onKeydown, { signal });
    }

    disconnectedCallback() {
      this.#abort.abort();
    }

    get #openSelectors() {
      return this.querySelectorAll('[data-localization][open]');
    }

    #onToggle = (event) => {
      if (!event.target.matches('[data-localization]') || !event.target.open) return;

      this.#openSelectors.forEach((selector) => {
        if (selector !== event.target) selector.open = false;
      });
    };

    #onFocusOut = (event) => {
      const selector = event.target.closest('[data-localization]');
      if (selector && event.relatedTarget && !selector.contains(event.relatedTarget)) selector.open = false;
    };

    #onDocumentClick = (event) => {
      this.#openSelectors.forEach((selector) => {
        if (!selector.contains(event.target)) selector.open = false;
      });
    };

    #onKeydown = (event) => {
      if (event.key !== 'Escape') return;

      this.#openSelectors.forEach((selector) => {
        selector.open = false;
        selector.querySelector('summary').focus();
      });
    };
  }

  customElements.define('vt-localization', VtLocalization);
}

/* Collapsible Settings sections, including sections added after account loading. */
(() => {
  'use strict';
  const css = document.createElement('style');
  css.textContent = `
    main > section.card > .settings-section > summary {
      display:flex;align-items:center;gap:10px;cursor:pointer;
      list-style:none!important;font-size:20px!important;font-weight:700!important;
      line-height:1.6;padding:2px 0!important;
    }
    .settings-section > summary::-webkit-details-marker {display:none}
    .settings-section > summary::before {
      content:'＋';flex:none;width:24px;text-align:center;font-size:22px;
    }
    .settings-section[open] > summary::before {content:'−'}
    .settings-section > summary > h2 {margin:0;font-size:inherit;line-height:inherit}
    .settings-section > summary > .trash-fold-sign {display:none}
    .settings-section > summary:focus-visible {
      outline:2px solid #2563eb;outline-offset:5px;border-radius:4px;
    }
    .settings-section-body {padding-top:12px}
    @media(max-width:600px) {
      main > section.card > .settings-section > summary {font-size:18px!important}
    }
  `;
  document.head.append(css);

  function mount(section) {
    if (!section.matches('section.card')) return;
    let fold = Array.from(section.children).find(el => el.tagName === 'DETAILS');
    if (!fold) {
      const heading = Array.from(section.children).find(el => el.tagName === 'H2');
      if (!heading) return;
      fold = document.createElement('details');
      const summary = document.createElement('summary');
      const body = document.createElement('div');
      body.className = 'settings-section-body';
      summary.append(heading);
      // Move existing controls intact so values, IDs, and event handlers survive.
      body.append(...section.childNodes);
      fold.append(summary, body);
      section.append(fold);
    }
    fold.classList.add('settings-section');
  }

  function boot() {
    const main = document.querySelector('main');
    if (!main) return;
    for (const section of main.children) mount(section);
    new MutationObserver(records => {
      for (const record of records)
        for (const node of record.addedNodes)
          if (node.nodeType === Node.ELEMENT_NODE) mount(node);
    }).observe(main, {childList:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();

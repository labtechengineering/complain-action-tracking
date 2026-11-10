// Change only this value for the public application version.
(()=>{'use strict';
 const version='2.1.0';
 window.QA_RELEASE=Object.freeze({version,label:'Version '+version});
 const display=()=>document.querySelectorAll('[data-qa-version]').forEach(node=>{node.textContent=window.QA_RELEASE.label;});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',display,{once:true});else display();
})();

/* Soft Navy theme: presentation only, no API or database changes. */
(()=>{'use strict';
 const base=new URL('.',document.currentScript?.src||location.href);
 document.documentElement.dataset.theme='soft';
 if(!document.querySelector('link[data-qa-theme]')){
  const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('app-theme.css?v=chart-no-scale-20261110-r1',base).href;link.dataset.qaTheme='soft';document.head.append(link);
 }
 const script=document.createElement('script');script.src=new URL('app-theme.js?v=20261109-r1',base).href;script.defer=true;document.head.append(script);
})();

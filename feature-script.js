/* Load an export feature on its first use. Failed loads can be retried. */
(() => {
  'use strict';
  const requests = new Map();
  function load(path) {
    if (requests.has(path)) return requests.get(path);
    const script = document.createElement('script');
    const request = new Promise((resolve, reject) => {
      script.src = path;
      script.onload = resolve;
      script.onerror = () => {
        requests.delete(path);
        script.remove();
        reject(new Error('โหลดเครื่องมือไม่สำเร็จ กรุณาลองอีกครั้ง'));
      };
      document.head.append(script);
    });
    requests.set(path, request);
    return request;
  }
  window.QAFeatureScript = {load};
})();

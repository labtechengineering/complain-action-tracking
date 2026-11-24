(() => {
  'use strict';
  const button = document.getElementById('webPushToggle');
  const status = document.getElementById('webPushStatus');
  if (!button || !status) return;
  let registration;
  let publicKey;
  let subscribed = false;

  const show = (message = '') => { status.textContent = message; };
  const paint = value => {
    subscribed = Boolean(value);
    button.setAttribute('aria-checked', String(subscribed));
  };
  async function rpc(name, params = {}) {
    const {data, error} = await QA.client.rpc(name, params);
    if (error) throw error;
    return data;
  }
  const encodeKey = value => Uint8Array.from(
    atob(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')),
    c => c.charCodeAt(0)
  );
  function device(mode, subscription) {
    const {endpoint, keys} = subscription.toJSON();
    return rpc('qa_web_push_device_v1', {
      p_mode: mode, p_endpoint: endpoint,
      ...(mode === 'on' ? {p_p256dh: keys.p256dh, p_auth: keys.auth} : {})
    });
  }

  async function start() {
    await QA.whenReady();
    const appleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (appleMobile && navigator.standalone !== true && !matchMedia('(display-mode: standalone)').matches) {
      show('บน iPhone หรือ iPad ให้เพิ่มเว็บไว้ที่หน้าจอโฮม แล้วเปิดจากไอคอนเพื่อเปิดรับแจ้งเตือน');
      return;
    }
    if (!window.isSecureContext || !navigator.serviceWorker || !window.PushManager || !window.Notification) {
      show('เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน');
      return;
    }
    const configuredKey = await rpc('qa_web_push_config_v1');
    if (!configuredKey) {
      show('บัญชีนี้ยังเปิดรับแจ้งเตือนไม่ได้');
      return;
    }
    publicKey = encodeKey(configuredKey);
    const worker = await navigator.serviceWorker.register('web-push-sw.js');
    registration = worker.active ? worker : await navigator.serviceWorker.ready;
    const deviceSubscription = await registration.pushManager.getSubscription();
    paint(deviceSubscription && await device('status', deviceSubscription));
    if (Notification.permission === 'denied') {
      show('ระบบปิดสิทธิ์แจ้งเตือนสำหรับเว็บนี้ ให้เปิดสิทธิ์ในการตั้งค่าของเครื่องก่อน');
      button.disabled = !subscribed;
      return;
    }
    show();
    button.disabled = false;
  }

  button.addEventListener('click', async () => {
    const turningOff = subscribed;
    button.disabled = true;
    try {
      if (turningOff) {
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          await device('off', existing);
          paint(false);
          await existing.unsubscribe();
        } else paint(false);
      } else {
        // Begin subscription inside the click so mobile browsers can prompt.
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: publicKey
        });
        paint(await device('on', subscription));
      }
      show();
    } catch {
      show(Notification.permission === 'denied'
        ? 'ระบบปิดสิทธิ์แจ้งเตือน ให้เปิดสิทธิ์ในการตั้งค่าของเครื่องแล้วลองใหม่'
        : 'เปลี่ยนการตั้งค่าไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      button.disabled = false;
    }
  });
  start().catch(() => show('โหลดการตั้งค่าแจ้งเตือนไม่สำเร็จ กรุณาเปิดหน้านี้ใหม่'));
})();

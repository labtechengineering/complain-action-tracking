/* Shared viewer for job attachments, local picks, and the on-screen report. */
(() => {
  'use strict';
  const active = new WeakMap();

  function setupVideo(video) {
    video.controls = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('controlslist', 'nofullscreen');
    video.classList.add('qa-media-video');
  }

  function open(trigger, {kind, getSource, inlineVideo}) {
    const doc = trigger.ownerDocument;
    active.get(doc)?.();
    const dialog = doc.createElement('dialog');
    dialog.className = 'qa-media-viewer';
    dialog.setAttribute('aria-label', kind === 'IMAGE' ? 'รูปแนบ' : 'วิดีโอแนบ');
    dialog.innerHTML = '<div class="qa-media-viewer-bar"><span></span><button type="button" autofocus>ปิด</button></div><div class="qa-media-stage"><p role="status">กำลังเปิดไฟล์…</p></div>';
    const stage = dialog.querySelector('.qa-media-stage');
    const status = stage.querySelector('p');
    const closeButton = dialog.querySelector('button');
    dialog.querySelector('span').textContent = kind === 'IMAGE' ? 'รูปแนบ' : 'วิดีโอแนบ';

    const video = kind === 'VIDEO';
    const media = doc.createElement(video ? 'video' : 'img');
    media.hidden = true;
    let startAt = 0;
    let wasPlaying = false;
    if (video) {
      setupVideo(media);
      media.preload = 'metadata';
      if (inlineVideo) {
        startAt = inlineVideo.currentTime || 0;
        wasPlaying = !inlineVideo.paused;
        if (wasPlaying) inlineVideo.pause();
      }
    } else {
      media.alt = 'รูปแนบ';
    }
    stage.prepend(media);

    let disposed = false;
    function close() {
      if (disposed) return;
      disposed = true;
      if (video && !media.paused) media.pause();
      if (video && inlineVideo?.isConnected && inlineVideo.readyState > 0 && media.readyState > 0) {
        inlineVideo.currentTime = media.currentTime;
      }
      media.removeAttribute('src');
      if (video) media.load();
      if (dialog.open && typeof dialog.close === 'function') dialog.close();
      dialog.remove();
      active.delete(doc);
      if (trigger.isConnected) trigger.focus();
    }
    active.set(doc, close);
    closeButton.addEventListener('click', close);
    dialog.addEventListener('close', close);
    dialog.addEventListener('cancel', event => {event.preventDefault();close();});
    dialog.addEventListener('keydown', event => {
      if (event.key === 'Escape') {event.preventDefault();close();}
    });
    doc.body.append(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    closeButton.focus();

    function unavailable() {
      status.hidden = false;
      status.textContent = video ? 'เปิดวิดีโอไม่ได้ ลองปิดแล้วเปิดอีกครั้ง' : 'เปิดรูปไม่ได้ ลองปิดแล้วเปิดอีกครั้ง';
    }

    media.addEventListener(video ? 'loadedmetadata' : 'load', () => {
      media.hidden = false;
      status.hidden = true;
      if (video && startAt > 0 && startAt < media.duration) media.currentTime = startAt;
      if (wasPlaying) media.play().catch(() => {});
    }, {once: true});
    media.addEventListener('error', unavailable);
    Promise.resolve().then(getSource).then(source => {
      if (disposed) return;
      if (!source) throw new Error('MEDIA_URL_MISSING');
      media.src = source;
      if (video) media.hidden = false;
    }).catch(() => {if (!disposed) unavailable();});
  }

  function createTrigger(doc, kind, getSource, {thumbnail=null, inlineVideo=null}={}) {
    const button = doc.createElement('button');
    button.type = 'button';
    const label = kind === 'IMAGE' ? 'ดูรูป' : 'ดูวิดีโอเต็มจอ';
    if (thumbnail) {
      button.className = 'qa-media-picture';
      button.setAttribute('aria-label', label);
      button.append(thumbnail);
    } else {
      button.className = 'qa-media-open';
      button.textContent = label;
    }
    if (inlineVideo) setupVideo(inlineVideo);
    button.addEventListener('click', () => open(button, {kind, getSource, inlineVideo}));
    return button;
  }

  window.QAMediaViewer = {open, createTrigger};
})();

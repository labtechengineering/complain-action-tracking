/* Prepare phone photos locally before applying the attachment storage limit. */
(() => {
  'use strict';

  const maxBytes = 5 * 1024 * 1024;
  const extensions = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'};
  const storedTypes = Object.keys(extensions);
  const accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif';
  let lastPhoto = Promise.resolve();

  function sourceType(file) {
    const type = file.type.toLowerCase();
    if (storedTypes.includes(type)) return type;
    if (/^image\/hei[cf](-sequence)?$/.test(type)) return 'heif';
    if (/^image\/(jpg|pjpeg)$/.test(type)) return 'image/jpeg';
    if (type === 'image/x-png') return 'image/png';
    if (type && type !== 'application/octet-stream') return '';
    const extension = file.name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
    if (extension === 'jpeg' || extension === 'jpg') return 'image/jpeg';
    if (extension === 'png' || extension === 'webp') return 'image/' + extension;
    return extension === 'heic' || extension === 'heif' ? 'heif' : '';
  }

  function decode(image, url) {
    return new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
  }

  async function resize(file, source, type) {
    const image = new Image();
    const input = source === 'heif' && !/^image\//.test(file.type)
      ? file.slice(0, file.size, 'image/heic') : file;
    const url = URL.createObjectURL(input);
    const canvas = document.createElement('canvas');

    try {
      try {
        await decode(image, url);
      } catch {
        throw new Error(source === 'heif'
          ? 'เครื่องนี้เปิดรูป HEIC/HEIF ไม่ได้ กรุณาเลือกสำเนา JPG ของรูป ' + file.name
          : 'เปิดรูปไม่ได้ กรุณาลองเลือกรูปอีกครั้ง: ' + file.name);
      }
      const longSide = Math.max(image.naturalWidth, image.naturalHeight);
      if (!longSide) throw new Error('รูปไม่มีขนาดที่ใช้งานได้: ' + file.name);
      let scale = Math.min(1, 2560 / longSide);
      const context = canvas.getContext('2d', {alpha: type !== 'image/jpeg'});
      if (!context) throw new Error('เบราว์เซอร์เตรียมรูปไม่ได้: ' + file.name);

      const qualities = type === 'image/png' ? [undefined] : [0.92, 0.82];

      for (let attempt = 0; attempt < 8; attempt++) {
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        if (type === 'image/jpeg') {
          context.fillStyle = '#fff';
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of qualities) {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
          if (blob?.size && blob.size <= maxBytes && storedTypes.includes(blob.type)) {
            return renamed(file, blob);
          }
        }
        scale *= 0.8;
      }
      throw new Error('ย่อรูปไม่สำเร็จ กรุณาลองบันทึกเป็น JPG แล้วแนบอีกครั้ง: ' + file.name);
    } finally {
      URL.revokeObjectURL(url);
      canvas.width = canvas.height = 1;
      image.removeAttribute('src');
    }
  }

  function renamed(file, blob) {
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], name + '.' + extensions[blob.type], {type: blob.type, lastModified: file.lastModified});
  }

  // Regular photos still go through immediately. Decode large photos one at a
  // time, including when two different problem cards receive files together.
  function prepare(file) {
    const source = sourceType(file);
    if (!source || !file.size) throw new Error('กรุณาเลือกรูป JPG, PNG, WebP หรือ HEIC/HEIF ที่เปิดได้');
    if (source !== 'heif' && file.size <= maxBytes) {
      return source === file.type ? file : renamed(file, file.slice(0, file.size, source));
    }
    const result = lastPhoto.then(() => resize(file, source, source === 'heif' ? 'image/jpeg' : source));
    lastPhoto = result.catch(() => {});
    return result;
  }

  window.QAUploadPhoto = {accept, maxBytes, isImage: file => Boolean(sourceType(file)), prepare};
})();

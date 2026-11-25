(() => {
 'use strict';
 const levels = {
  S1: { name: 'Critical', urgency: 'ทันที', deadline: 'ทันที', color: '#8f0b20' },
  S2: { name: 'High', urgency: 'เร่งด่วน', deadline: 'ภายใน 24 ชั่วโมง', color: '#dc2937' },
  S3: { name: 'Medium', urgency: 'ตามแผน', deadline: 'ภายใน 7 วัน', color: '#ffac27' },
  S4: { name: 'Low', urgency: 'ตามโอกาส', deadline: 'ภายใน 14 วัน', color: '#ffea56' }
 };
 const occurrences = {
  OLD: { name: 'ปัญหาเก่า', color: '#f4b084' },
  NEW: { name: 'ปัญหาใหม่', color: '#00b0f0' }
 };

 function mount(host, { key, severity, occurrence, required }) {
  for (const [field, title, choices, value] of [
   ['severity_code', 'ระดับความรุนแรง', levels, severity],
   ['occurrence_type', 'ปัญหาเก่า / ใหม่', occurrences, occurrence]
  ]) {
   const group = document.createElement('fieldset');
   group.className = 'qa-issue-field';
   const legend = document.createElement('legend');
   legend.textContent = title + (required ? ' *' : '');
   group.append(legend);
   const options = document.createElement('div');
   options.className = 'qa-issue-options';
   for (const [id, meta] of Object.entries(choices)) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = field + '-' + key;
    radio.dataset.issueField = field;
    radio.value = id;
    radio.checked = value === id;
    radio.required = required;
    const text = document.createElement('span');
    text.textContent = field === 'severity_code' ? id + ' ' + meta.name : meta.name;
    const dot = document.createElement('i');
    dot.className = 'qa-issue-dot';
    dot.style.setProperty('--issue-color', meta.color);
    text.prepend(dot);
    if (meta.deadline) {
     const help = document.createElement('small');
     help.textContent = [...new Set([meta.urgency, meta.deadline])].join(' · ');
     text.append(help);
    }
    label.append(radio, text);
    options.append(label);
   }
   group.append(options);
   host.append(group);
  }
 }
 function read(root) {
  return Object.fromEntries(['severity_code', 'occurrence_type'].map(field => [
   field, root.querySelector('[data-issue-field="' + field + '"]:checked')?.value || null
  ]));
 }
 function badge(code, inList = false) {
  if (!Object.hasOwn(levels, code)) return '';
  const tint = !inList || code === 'S1';
  return '<span class="qa-severity ' + (tint ? code : '') + '" title="' + code + ' ' + levels[code].name + '">' + code + '</span>';
 }
 function showGuide(dialog) {
  const body = dialog.querySelector('tbody');
  if (!body.children.length) {
   for (const [id, level] of Object.entries(levels)) {
    const row = body.insertRow();
    const header = document.createElement('th');
    header.scope = 'row';
    header.innerHTML = badge(id);
    row.append(header);
    for (const text of [level.name, level.urgency, level.deadline]) row.insertCell().textContent = text;
   }
  }
  dialog.showModal();
 }
 window.QAIssueClassification = { levels, occurrences, mount, read, badge, showGuide };
})();

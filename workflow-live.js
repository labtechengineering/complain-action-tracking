/* Persisted workflow additions. Supabase RPCs enforce permissions; no demo data or AI. */
(()=>{'use strict';const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),norm=s=>String(s||'').trim().toLowerCase();let context=null,data={issues:{},assignments:{}},bindings=[],poll=null,channel=null,refreshing=false;const drafts=new Map();
const keyOf=t=>[t.p_assignment_id||'',t.p_issue_id||'',t.p_field].join(':');
function message(e){const s=e?.message||String(e);if(s.includes('DEPARTMENT_ALREADY_ASSIGNED'))return 'แผนกนี้อยู่ในปัญหานี้แล้ว กรุณาเลือกแผนกอื่น';if(s.includes('RESPONSIBLE_OR_HEAD_REQUIRED'))return 'เฉพาะผู้รับผิดชอบหรือหัวหน้าแผนกที่ส่งต่อได้';return s.includes('NOTE_CONFLICT')?'มีผู้แก้คอมเมนต์ช่องนี้แล้ว โปรดคัดลอกข้อความของคุณไว้ก่อนเปิดหน้าใหม่':s.includes('TARGET_REVIEW_FINISH_OR_REOPEN')?'แผนกปลายทางนี้กำลังรอตรวจรับหรือปิดงานแล้ว ต้องเปิดงานแผนกนั้นกลับก่อน จึงเพิ่มปัญหาให้ได้':s.includes('REOPEN_BEFORE_FORWARD')?'เปิดแก้ไขคำตอบก่อนส่งต่อแผนก':s.includes('VERSION_CONFLICT')?'ข้อมูลเปลี่ยนแล้ว กรุณาเปิดใบงานใหม่ก่อนทำรายการ':s;}
const value=t=>t.p_field==='problem'?String(data.issues?.[t.p_issue_id]||''):t.p_field==='qa_note'?String(data.assignments?.[t.p_assignment_id]?.qa_note||''):String(data.assignments?.[t.p_assignment_id]?.comments?.[t.p_field]||'');
function setValue(t,v){if(t.p_field==='problem'){data.issues||={};data.issues[t.p_issue_id]=v;}else{data.assignments||={};const a=data.assignments[t.p_assignment_id]||={};if(t.p_field==='qa_note')a.qa_note=v;else{a.comments||={};a.comments[t.p_field]=v;}}}
function api(args){return context.rpc('qa_workflow_notes_v1',{p_job_id:context.detail.job_id||context.jobId,...args});}
function annotation(target,title,editable,wide=false){const host=document.createElement('aside');host.className=wide?'live-qa-note':'live-comment';const heading=document.createElement('div');heading.className='live-note-heading';const label=document.createElement('b');label.textContent=title;const status=document.createElement('span');status.className='live-note-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');if(wide)heading.append(label);heading.append(status);host.append(heading);const current=value(target),key=keyOf(target);let input;
 const binding={target,host,status,key,editable,update:null};
 if(editable){input=document.createElement('textarea');input.maxLength=4000;input.rows=3;input.setAttribute('aria-label',(wide?title:'คอมเมนต์')+' · '+(target.p_issue_id||target.p_assignment_id)+' · '+target.p_field);input.placeholder=wide?'เพิ่มหมายเหตุได้ตลอด · บันทึกอัตโนมัติ':'พิมพ์คอมเมนต์ · บันทึกอัตโนมัติ';let d=drafts.get(key);if(!d){d={target,known:current,text:current,busy:false,blocked:false,timer:null,error:null};drafts.set(key,d);}else if(!d.busy&&!d.error&&d.text===d.known){d.known=current;d.text=current;}input.value=d.text;host.append(input);
 const update=()=>{status.textContent=d.error?message(d.error):d.busy?'กำลังบันทึก…':d.text===d.known?'บันทึกแล้ว':'รอบันทึก…';host.classList.toggle('has-note-error',!!d.error);};d.notify=update;binding.update=()=>{if(!d.busy&&d.text===d.known&&!d.error){d.known=value(target);d.text=d.known;input.value=d.text;}update();};
 input.oninput=()=>{d.text=input.value;if(!d.blocked)d.error=null;clearTimeout(d.timer);d.timer=setTimeout(()=>save(d),450);update();};update();
 }else{const p=document.createElement('p');p.className='live-note-text';p.textContent=current;host.append(p);binding.update=()=>{if(target.p_field==='qa_note'&&data.assignments?.[target.p_assignment_id]?.can_qa_note&&host.isConnected){const next=annotation(target,title,true,wide);host.replaceWith(next);binding.update=null;return;}p.textContent=value(target);host.hidden=!p.textContent.trim();if(host.parentElement?.classList.contains('live-answer-row'))host.parentElement.classList.toggle('live-empty-comment',!p.textContent.trim());};host.hidden=!current.trim();}
 bindings.push(binding);return host;}
async function save(d){clearTimeout(d.timer);if(d.busy)return d.promise;if(d.blocked)return false;if(d.text===d.known&&!d.error)return true;d.busy=true;d.notify?.();d.promise=(async()=>{try{while(d.text!==d.known){const text=d.text;await api({...d.target,p_text:text,p_expected:d.known});d.known=text;d.retryDelay=2000;setValue(d.target,text);}d.error=null;return true;}catch(e){d.error=e;d.blocked=String(e?.message||e).includes('NOTE_CONFLICT');if(!d.blocked&&!/FORBIDDEN|ONLY|AUTH_REQUIRED|PROFILE_NOT_ACTIVE|INVALID_|NOTE_TOO_LONG|42501|PGRST301/.test((String(e?.code||'')+' '+String(e?.message||e)))){d.retryDelay=Math.min((d.retryDelay||1000)*2,30000);d.timer=setTimeout(()=>save(d),d.retryDelay);}return false;}finally{d.busy=false;d.notify?.();}})();return d.promise;}
async function flushAll(){const results=await Promise.all([...drafts.values()].map(save));return results.every(Boolean);}
window.addEventListener('beforeunload',e=>{if([...drafts.values()].some(d=>d.busy||d.text!==d.known)){e.preventDefault();e.returnValue='';}});
function source(issue){const row=document.createElement('section');row.className='live-answer-row live-source';const main=document.createElement('div');main.className='live-answer-main';const label=document.createElement('b');label.textContent='รายละเอียดปัญหา / ข้อบกพร่อง';const p=document.createElement('p');p.className='live-source-text';p.textContent=issue.description||'';main.append(label,p);const files=document.createElement('div');files.className='live-source-attachments';files.hidden=true;main.append(files);row.append(main,annotation({p_issue_id:issue.issue_id,p_field:'problem'},'System Admin',QA.profile.role==='system_admin'));if(row.lastElementChild.hidden)row.classList.add('live-empty-comment');return row;}
function mount(ctx){context=ctx;data=ctx.notes;bindings=[];
 for(const a of ctx.detail.assignments||[]){const panel=ctx.root.querySelector('.department-panel[data-assignment="'+CSS.escape(String(a.assignment_id))+'"],.unaccepted-actions[data-assignment="'+CSS.escape(String(a.assignment_id))+'"]');if(!panel)continue;panel.querySelector('.response-field-card[data-field-step="1"]')?.setAttribute('hidden','');
  for(const [step,field] of [[2,'analysis'],[3,'fix'],[4,'prevent']]){const left=panel.querySelector('.response-field-card[data-field-step="'+step+'"]');if(!left)continue;const row=document.createElement('div');row.className='live-answer-row';row.dataset.field=field;left.before(row);left.classList.add('live-answer-main');row.append(left,annotation({p_assignment_id:a.assignment_id,p_field:field},'System Admin',QA.profile.role==='system_admin'));if(row.lastElementChild.hidden)row.classList.add('live-empty-comment');}
  const fields=panel.querySelector('.response-fields-grid'),ownerNode=panel.querySelector('.response-responsible'),due=panel.querySelector('.response-due-row');
  if(fields&&(ownerNode||due)){const footer=document.createElement('div');footer.className='live-response-footer';fields.after(footer);if(ownerNode)footer.append(ownerNode);if(due)footer.append(due);}
  const qa=data.assignments?.[a.assignment_id]||{};panel.append(annotation({p_assignment_id:a.assignment_id,p_field:'qa_note'},'หมายเหตุ QA',qa.can_qa_note===true,true));
  if(qa.reviewed_at){
   const result=document.createElement('p');result.className='live-review-result';
   const date=document.createElement('time');date.dateTime=qa.reviewed_at;
   date.textContent=new Date(qa.reviewed_at).toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});
   result.append(qa.passed?'ตรวจรับผ่านเมื่อ ':'ตรวจรับไม่ผ่านเมื่อ ',date);
   if(qa.review_comment)result.append(document.createElement('br'),'ความคิดเห็นตรวจรับ : '+qa.review_comment);
   panel.append(result);
  }
  if(QAWorkflow.permissions(QA.profile,ctx.detail,a).canFinalReview){const label=document.createElement('label');label.className='live-review-input';label.textContent='ความคิดเห็นตรวจรับ';const input=document.createElement('textarea');input.className='live-final-review-comment';input.maxLength=2000;input.placeholder='ผ่าน: เพิ่มความเห็นได้ · ไม่ผ่าน: ระบุสิ่งที่ต้องแก้';input.rows=2;label.append(input);const actions=panel.querySelector('.department-action-bar');if(actions)actions.before(label);else panel.append(label);}
  const own=['user','department_admin'].includes(QA.profile.role)&&norm(QA.profile.department)===norm(a.department_code);const responsible=!a.responsible_user||String(a.responsible_user)===String(QA.profile.user_id)||QA.profile.role==='department_admin';
  const system=QA.profile.role==='system_admin';
  const normalForward=(system||own&&responsible)&&['OPEN','IN_PROGRESS'].includes(a.status)&&!a.approval_requested_at;
  if(!a.self_response&&!a.unrelated_requested_at&&(normalForward||system&&['IN_PROGRESS','WAITING_REVIEW','CLOSED'].includes(a.status))){const b=document.createElement('button');b.type='button';b.className='secondary live-forward-button';b.textContent='ส่งต่อแผนก';b.onclick=()=>forward(a,panel);const actions=panel.querySelector('.department-action-bar')||panel;actions.append(b);}
 }
 for(const fold of ctx.root.querySelectorAll('.issue-disclosure')){const issue=(ctx.detail.assignments||[]).flatMap(a=>a.issues||[]).find(i=>String(i.issue_id)===fold.dataset.issueId);if(!issue)continue;fold.querySelector('.issue-disclosure-body').prepend(source(issue));}
 for(const holder of ctx.root.querySelectorAll('.received-issues'))if(!holder.querySelector('.media,.issueFiles,.issue-reassign,.unaccepted-actions'))holder.hidden=true;
 startWatching();}
async function refresh(){if(refreshing||document.hidden||!context)return;refreshing=true;try{const next=await api({});data=next;bindings.forEach(b=>b.update?.());}catch(e){console.warn('Live annotations refresh:',e?.message||e);}finally{refreshing=false;}}
function startWatching(){clearInterval(poll);poll=setInterval(refresh,5000);if(channel&&QA.client.removeChannel)void QA.client.removeChannel(channel);channel=null;if(QA.client.channel){const id=context.detail.job_id||context.jobId;channel=QA.client.channel('qa-notes:'+id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'qa_department_assignments',filter:'job_id=eq.'+id},refresh).on('postgres_changes',{event:'UPDATE',schema:'public',table:'qa_issue_items',filter:'job_id=eq.'+id},refresh).subscribe();}}
async function forward(a,panel){if(document.querySelector('.live-forward-dialog'))return;if(!await flushAll()){context.note('ยังมีคอมเมนต์ที่บันทึกไม่สำเร็จ',true);return;}if(document.querySelector('.live-forward-dialog'))return;const dialog=document.createElement('dialog');dialog.className='live-forward-dialog';const issues=a.issues||[];const activeId=panel.closest('.issue-disclosure')?.dataset.issueId||issues[0]?.issue_id;dialog.innerHTML='<form><h3>ส่งต่อ / เพิ่มแผนก</h3><label>ปัญหา<select name="issue">'+issues.map(i=>'<option value="'+esc(i.issue_id)+'">'+esc(i.issue_number)+' · '+esc(i.description)+'</option>').join('')+'</select></label><label class="live-forward-choice"><input type="radio" name="mode" value="transfer"> ส่งต่อทั้งหมด</label><label class="live-forward-choice"><input type="radio" name="mode" value="share" checked> ทำส่วนของฉันต่อ + เพิ่มแผนก</label><fieldset><legend>ส่งให้แผนก · เลือกได้หลายแผนก</legend><div class="live-forward-targets"></div></fieldset><label>ข้อความถึงแผนกปลายทาง<textarea name="note" maxlength="2000" rows="2"></textarea></label><p class="live-forward-error" role="alert"></p><div class="live-dialog-actions"><button type="button" class="secondary live-dialog-cancel">ยกเลิก</button><button type="submit">ยืนยัน</button></div></form>';document.body.append(dialog);const form=dialog.querySelector('form');form.elements.issue.value=activeId;const error=dialog.querySelector('.live-forward-error');
 const transferOnly=QA.profile.role==='system_admin'&&(!['OPEN','IN_PROGRESS'].includes(a.status)||Boolean(a.approval_requested_at));
 if(transferOnly){form.elements.mode.value='transfer';form.querySelector('[value=share]').closest('label').hidden=true;}
 try{const rows=await context.rpc('qa_workflow_receivers_v1',{}),renderTargets=()=>{const assigned=context.detail.assignments.filter(x=>(x.issues||[]).some(i=>String(i.issue_id)===form.elements.issue.value));dialog.querySelector('.live-forward-targets').innerHTML=(rows||[]).filter(r=>r.enabled!==false&&(r.department_code||r.code)!==a.department_code&&!assigned.some(x=>x.department_code===(r.department_code||r.code)&&(x.self_response||form.elements.mode.value!=='transfer'))).map(r=>'<label class="live-forward-choice"><input type="checkbox" name="department" value="'+esc(r.department_code||r.code)+'"> '+esc(r.department_code||r.code)+'</label>').join('');};if(a.status==='OPEN')form.elements.mode.value='transfer';renderTargets();form.elements.issue.onchange=renderTargets;for(const mode of form.querySelectorAll('[name=mode]'))mode.onchange=renderTargets;}catch(e){error.textContent=message(e);}
 if(a.status==='OPEN')form.elements.mode.value='transfer';const close=()=>{dialog.close();dialog.remove();};dialog.querySelector('.live-dialog-cancel').onclick=close;dialog.oncancel=()=>dialog.remove();
 form.onsubmit=async event=>{event.preventDefault();const targets=[...form.querySelectorAll('[name=department]:checked')].map(x=>x.value);if(!targets.length){error.textContent='เลือกแผนกปลายทางอย่างน้อย 1 แผนก';return;}const b=form.querySelector('[type=submit]');b.disabled=true;try{if(QAWorkflow.permissions(QA.profile,context.detail,a).canEdit&&panel.querySelector('.analysis:not(:disabled)'))await context.saveDraft(a,panel);const result=await context.rpc('qa_workflow_forward_v1',{p_assignment_id:a.assignment_id,p_issue_id:form.elements.issue.value,p_departments:targets,p_mode:form.elements.mode.value,p_expected_version:a.version,p_note:form.elements.note.value});const mode=form.elements.mode.value;close();context.queueEvents([result]);await context.sendEvents();if(mode==='transfer'&&await context.complete?.('TRANSFER'))return;await context.render();}catch(e){error.textContent=message(e);b.disabled=false;}};dialog.showModal();}
async function savedFiles(host,id,media,getUrl){
 if(!getUrl)return;
 const files=media.filter(f=>f.scope==='ASSIGNMENT'&&String(f.assignment_id)===String(id));
 if(!files.length)return;
 const box=document.createElement('div');box.className='media live-forward-media';host.append(box);
 for(const f of files){
  const card=document.createElement('div');card.className='media-item';box.append(card);
  const source=()=>getUrl(f.storage_path);
  try{
   const url=await source();
   if(f.kind==='IMAGE'){
    const image=document.createElement('img');image.src=url;image.alt='ไฟล์ที่บันทึกไว้ก่อนส่งต่อ';
    card.append(QAMediaViewer.createTrigger(document,'IMAGE',source,{thumbnail:image}));
   }
   card.append(QAMediaViewer.createTrigger(document,f.kind,source));
   if(f.note){const note=document.createElement('p');note.textContent=f.note;card.append(note);}
  }catch{card.textContent='โหลดไฟล์เดิมไม่ได้ กรุณาเปิดใบงานอีกครั้ง';}
 }
}
function buildForwardSnapshot(event,media=[],getUrl){
 const history=event.details,old=history.saved_response||{};
 const fields=[
  ['วิเคราะห์สาเหตุ',old.problem_analysis],['การแก้ปัญหา',old.corrective_action],
  ['การป้องกัน',old.preventive_action],['คอมเมนต์รายละเอียดปัญหา',old.source_problem_comment],
  ['คอมเมนต์วิเคราะห์สาเหตุ',old.system_comments?.analysis],
  ['คอมเมนต์การแก้ปัญหา',old.system_comments?.fix],
  ['คอมเมนต์การป้องกัน',old.system_comments?.prevent],['หมายเหตุ QA',old.qa_note]
 ].filter(([,value])=>String(value??'').trim());
 const beforeTime=Date.parse(event.created_at);
 const files=media.filter(file=>file.scope==='ASSIGNMENT'
   &&String(file.assignment_id)===String(history.source_assignment_id)
   &&(!file.created_at||Date.parse(file.created_at)<=beforeTime));
 if(!fields.length&&!files.length)return null;
 const disclosure=document.createElement('details');
 disclosure.className='timeline-forward-answer';
 const summary=document.createElement('summary');
 summary.textContent='คำตอบที่บันทึกไว้ก่อนส่งต่อ';
 disclosure.append(summary);
 const block=document.createElement('div');block.className='timeline-forward-answer-body';
 for(const [label,value] of fields){
  const line=document.createElement('p'),name=document.createElement('b');
  name.textContent=label;
  line.append(name,' : ',value);block.append(line);
 }
 disclosure.append(block);
 if(files.length){
  const showFiles=()=>{
   if(!disclosure.open)return;
   disclosure.removeEventListener('toggle',showFiles);
   void savedFiles(block,history.source_assignment_id,files,getUrl);
  };
  disclosure.addEventListener('toggle',showFiles);
 }
 return disclosure;
}
window.QAWork={mount,flushAll,source,buildForwardSnapshot,notes:()=>data,refresh,message};
})();

/* System Admin Excel preview, corrections and one atomic directory import. */
(()=>{'use strict';const D=window.QASerialDirectory;if(!D)return;
 const $=id=>document.getElementById(id);let records=[],snapshot=null,filename='',page=0,busy=false,readToken=0,batchId=null,sentPayload=null;const pageSize=40;
 const rpc=async(name,args={})=>{const {data,error}=await QA.client.rpc(name,args);if(error)throw error;return data;};
 const status=(message,bad=false)=>{const el=$('serialImportStatus');if(el){el.textContent=message;el.dataset.bad=String(bad);}};
 const fmt=v=>v?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(v)):'ยังไม่เคยนำเข้า';
 function showMeta(){const n=snapshot?.records?.length||0;$('serialDirectoryMeta').textContent=n.toLocaleString()+' Serial · อัปเดตล่าสุด '+fmt(snapshot?.updated_at);}
 function counts(){const old=new Map((snapshot?.records||[]).map(r=>[r.serial_key,r]));let added=0,changed=0,blocked=0;
  for(const r of records){const found=old.get(D.key(r.serial_no));if(!found)added++;else if(found.customer_name!==D.text(r.customer_name)||found.country_name!==D.text(r.country_name)||found.country_code!==r.country_code||found.customer_code!==r.customer_code||found.source_customer!==r.source_customer)changed++;if(D.issues(r).length)blocked++;}
  return {added,changed,blocked};
 }
 function refreshSummary(){if(!records.length)return;const c=counts();$('serialImportSummary').textContent='ทั้งหมด '+records.length.toLocaleString()+' · เพิ่มใหม่ '+c.added.toLocaleString()+' · อัปเดตข้อมูล '+c.changed.toLocaleString()+' · ต้องแก้/ตรวจ '+c.blocked.toLocaleString();$('serialImportConfirm').disabled=busy||c.blocked>0||!$('serialImportAcknowledge').checked;}
 function filtered(){const q=D.text($('serialImportSearch').value).toLowerCase(),only=$('serialImportOnlyReview').checked;return records.filter(r=>(!q||[r.serial_no,r.source_customer,r.customer_name,r.country_name].some(v=>v.toLowerCase().includes(q)))&&(!only||D.issues(r).length));}
 function invalidate(){batchId=null;sentPayload=null;$('serialImportAcknowledge').checked=false;refreshSummary();}
 function renderRows(){const rows=filtered(),pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages-1);const body=$('serialImportRows');body.replaceChildren();
  for(const r of rows.slice(page*pageSize,(page+1)*pageSize)){
   const tr=document.createElement('tr');tr.dataset.serial=r.serial_no;const td=value=>{const cell=document.createElement('td');cell.textContent=value;tr.append(cell);return cell;};
   td(r.serial_no);td(r.source_customer);const customer=td(''),country=td(''),review=td('');
   const name=document.createElement('input');name.type='text';name.value=r.customer_name;name.maxLength=200;name.setAttribute('aria-label','ชื่อลูกค้า '+r.serial_no);customer.append(name);
   const c=document.createElement('input');c.type='text';c.value=r.country_name;c.maxLength=120;c.setAttribute('aria-label','ประเทศ '+r.serial_no);country.append(c);
   const message=document.createElement('p');message.className='serial-row-message';review.append(message);
   const checkLabel=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=r.reviewed;check.setAttribute('aria-label','ตรวจแล้ว '+r.serial_no);checkLabel.append(check,document.createTextNode('ตรวจแล้ว'));review.append(checkLabel);
   const updateMessage=()=>{const errors=D.issues(r);message.textContent=errors.length?errors.join(' · '):r.reason;tr.dataset.bad=String(errors.length>0);};updateMessage();
   name.addEventListener('input',()=>{
    // One correction applies to the same SAP customer code + original name, never by row number.
    for(const other of records)if(D.nameKey(other.customer_code,other.source_customer)===D.nameKey(r.customer_code,r.source_customer)){other.customer_name=name.value;other.remember_name=true;other.reason='แก้ชื่อแล้ว · จำไว้ในการนำเข้าครั้งต่อไป';}
    for(const row of body.children){const other=records.find(x=>x.serial_no===row.dataset.serial);if(other&&D.nameKey(other.customer_code,other.source_customer)===D.nameKey(r.customer_code,r.source_customer)){row.querySelector('input[type=text]').value=name.value;row.querySelector('.serial-row-message').textContent=D.issues(other).join(' · ')||other.reason;row.dataset.bad=String(D.issues(other).length>0);}}
    invalidate();updateMessage();
   });
   c.addEventListener('input',()=>{r.country_name=c.value;r.reason='แก้ประเทศแล้ว';invalidate();updateMessage();});
   check.addEventListener('change',()=>{r.reviewed=check.checked;invalidate();updateMessage();});
   body.append(tr);
  }
  if(!rows.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='ไม่มีรายการตามตัวกรอง';tr.append(td);body.append(tr);}
  $('serialImportPage').textContent='หน้า '+(page+1)+' / '+pages+' · '+rows.length.toLocaleString()+' รายการ';$('serialImportPrev').disabled=page===0;$('serialImportNext').disabled=page>=pages-1;refreshSummary();
 }
 async function selectFile(){if(busy)return;const token=++readToken,file=$('serialImportFile').files[0];records=[];batchId=null;sentPayload=null;$('serialImportPreview').hidden=true;$('serialImportAcknowledge').checked=false;if(!file)return;
  try{if(!/\.xlsx$/i.test(file.name))throw Error('กรุณาเลือกไฟล์ .xlsx จาก SAP');if(file.size>D.MAX_FILE)throw Error('ไฟล์ต้องไม่เกิน 10 MB');status('กำลังอ่าน Excel และข้อมูลอ้างอิงล่าสุด...');
   const [buffer,latest]=await Promise.all([file.arrayBuffer(),rpc('qa_serial_admin_snapshot')]);if(token!==readToken)return;snapshot=latest;showMeta();
   const sheets=D.readXlsx(buffer).filter(s=>D.getHeaders(s));if(!sheets.length)throw Error('ไม่พบตารางที่มี internalSN, customer, custmrName, country และ Name');
   const select=$('serialImportSheet');select.replaceChildren();for(const s of sheets){const o=document.createElement('option');o.textContent=s.name;select.append(o);}select.onchange=()=>{try{records=D.prepare(sheets[select.selectedIndex],snapshot);page=0;invalidate();renderRows();status('ตรวจชื่อและประเทศ แล้วกดยืนยันนำเข้า');}catch(e){records=[];$('serialImportRows').replaceChildren();$('serialImportSummary').textContent='ไม่สามารถใช้ชีตนี้ได้';$('serialImportConfirm').disabled=true;status(D.friendly(e),true);}};
   records=D.prepare(sheets[0],snapshot);filename=file.name.slice(0,240);page=0;$('serialImportSearch').value='';$('serialImportOnlyReview').checked=false;$('serialImportPreview').hidden=false;renderRows();status('อ่านไฟล์แล้ว ตรวจชื่อและประเทศก่อนยืนยัน'+(sheets.length>1?' · เลือกชีตที่ต้องการด้านล่าง':''));
  }catch(e){if(token===readToken){records=[];$('serialImportPreview').hidden=true;status(D.friendly(e),true);}}
 }
 async function commit(){if(busy||!records.length||!snapshot)return;const c=counts();if(c.blocked||!$('serialImportAcknowledge').checked){status('กรุณาแก้/ตรวจรายการและยืนยันข้อมูลก่อนนำเข้า',true);return;}
  busy=true;const section=$('serialDirectorySettings');section.setAttribute('aria-busy','true');for(const n of section.querySelectorAll('input,button,select'))n.disabled=true;$('serialImportConfirm').textContent='กำลังนำเข้า...';status('กำลังบันทึกข้อมูลทั้งชุด กรุณารอ');
  try{batchId=batchId||D.uuid();sentPayload=sentPayload||D.payload(records);const result=await rpc('qa_serial_import',{p_rows:sentPayload,p_expected_revision:snapshot.revision,p_batch_id:batchId,p_filename:filename});if(!result||result.imported!==records.length)throw Error('ผลยืนยันการนำเข้าไม่ครบ กรุณากดลองอีกครั้ง');
   // Do not reload a new snapshot as a prerequisite to reporting an already committed import.
   const n=records.length;snapshot={...snapshot,revision:result.revision,updated_at:result.updated_at||snapshot.updated_at,records:[...new Map([...(snapshot.records||[]).map(r=>[r.serial_key,r]),...records.map(r=>[D.key(r.serial_no),{...r,serial_key:D.key(r.serial_no)}])]).values()]};showMeta();records=[];sentPayload=null;batchId=null;$('serialImportPreview').hidden=true;$('serialImportFile').value='';status('นำเข้าสำเร็จ '+n.toLocaleString()+' รายการ · พร้อมค้นหา Serial Number ในหน้าแจ้งงาน');
  }catch(e){status(D.friendly(e)+'\nยังไม่ยืนยันสำเร็จ กดลองอีกครั้งได้ ระบบป้องกันชุดเดิมซ้ำ',true);}
  finally{busy=false;section.removeAttribute('aria-busy');for(const n of section.querySelectorAll('input,button,select'))n.disabled=false;$('serialImportConfirm').textContent='ยืนยันนำเข้า';if(records.length){renderRows();refreshSummary();}}
 }
 async function boot(){try{await QA.whenReady();if(QA.profile?.role!=='system_admin')return;const main=document.querySelector('main');if(!main)return;
  const section=document.createElement('section');section.className='card serial-directory-settings';section.id='serialDirectorySettings';section.innerHTML=`<h2>ข้อมูลลูกค้าจาก Serial Number</h2><p id="serialDirectoryMeta" class="muted">กำลังโหลดข้อมูล...</p><p>เลือก Excel ที่ผู้ดูแล SAP ส่งให้ ตรวจชื่อและประเทศ แล้วกดยืนยัน</p><label class="serial-file-label">ไฟล์ Excel (.xlsx)<input id="serialImportFile" type="file" accept=".xlsx"></label><p id="serialImportStatus" role="status" aria-live="polite"></p><div id="serialImportPreview" hidden><div class="serial-toolbar"><label>ชีต<select id="serialImportSheet"></select></label><label>ค้นหาในไฟล์<input id="serialImportSearch" type="search" placeholder="Serial / ลูกค้า / ประเทศ"></label><label class="serial-check"><input id="serialImportOnlyReview" type="checkbox">เฉพาะรายการที่ต้องตรวจ</label></div><p id="serialImportSummary"></p><p class="muted">แก้ชื่อลูกค้าที่นี่ได้ ระบบจะจำชื่อตามรหัสลูกค้าและชื่อเดิมจาก SAP · ประเทศว่างให้ตรวจแล้วเลือก “ตรวจแล้ว” หากต้องการเว้นว่าง</p><div class="serial-table-wrap"><table><thead><tr><th>Serial Number</th><th>ชื่อเดิมจาก SAP</th><th>Customer ที่จะใช้</th><th>Country ที่จะใช้</th><th>ตรวจข้อมูล</th></tr></thead><tbody id="serialImportRows"></tbody></table></div><div class="serial-pagination"><button type="button" id="serialImportPrev">ก่อนหน้า</button><span id="serialImportPage"></span><button type="button" id="serialImportNext">ถัดไป</button></div><p class="muted">เพิ่มและอัปเดตข้อมูลอ้างอิงเท่านั้น ไม่ลบ Serial ที่ไม่ได้อยู่ในไฟล์ และไม่เปลี่ยนข้อมูลในใบงานเก่า</p><label class="serial-check"><input id="serialImportAcknowledge" type="checkbox">ฉันตรวจข้อมูลแล้ว ต้องการนำเข้าทั้งไฟล์</label><button type="button" id="serialImportConfirm" class="primary" disabled>ยืนยันนำเข้า</button></div>`;
  const note=main.querySelector('.note');if(note)note.after(section);else main.append(section);
  $('serialImportFile').addEventListener('change',selectFile);$('serialImportSearch').addEventListener('input',()=>{page=0;renderRows();});$('serialImportOnlyReview').addEventListener('change',()=>{page=0;renderRows();});$('serialImportPrev').onclick=()=>{page--;renderRows();};$('serialImportNext').onclick=()=>{page++;renderRows();};$('serialImportAcknowledge').onchange=refreshSummary;$('serialImportConfirm').onclick=commit;
  try{snapshot=await rpc('qa_serial_admin_snapshot');showMeta();}catch(e){$('serialDirectoryMeta').textContent='ยังไม่พร้อมใช้งาน';status(D.friendly(e),true);}
 }catch(e){console.warn('Serial settings unavailable:',e.message);}}
 boot();
})();

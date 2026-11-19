/* One file picker and one update button. Directory records are not listed on the page. */
(()=>{'use strict';const D=window.QASerialDirectory;if(!D)return;const $=id=>document.getElementById(id);
 let sheets=null,filename='',token=0,busy=false,snapshot=null,payload=null,batch=null,summary=null;
 const rpc=async(name,args={})=>{const {data,error}=await QA.client.rpc(name,args);if(error)throw error;return data;};
 function status(text,bad=false){const el=$('serialImportStatus');el.textContent=text;el.dataset.bad=String(bad);}
 function prepare(current,saved){const prepared=D.prepareWorkbook(current,saved||{overrides:[]});
  // Ambiguous names stay as source text; blank countries stay blank. Users can edit on the job form.
  const invalid=prepared.rows.map(r=>({r,issues:D.issues({...r,reviewed:true})})).filter(x=>x.issues.length);
  if(invalid.length)throw Error(invalid.slice(0,5).map(x=>(x.r.sheetName?x.r.sheetName+' · ':'')+'แถว '+x.r.row+': '+x.issues.join(' · ')).join('\n'));
  return prepared;
 }
 function importSummary(info){
  const messages=[];
  if(info.sheetCount>1)messages.push('จาก '+info.sheetCount+' ชีต');
  if(info.preferred)messages.push('ใช้ SerialProfile สำหรับ '+info.preferred.toLocaleString()+' Serial ที่ข้อมูลสองชีตต่างกัน');
  if(info.skippedConflicts)messages.push('ข้าม '+info.skippedConflicts.toLocaleString()+' Serial ที่ WorkSerial มีข้อมูลลูกค้าขัดกัน');
  if(info.skippedNotes)messages.push('ข้าม '+info.skippedNotes.toLocaleString()+' แถวที่ระบุ Serial เดียวหรือชื่อลูกค้าไม่ได้');
  return messages.length?' · '+messages.join(' · '):'';
 }
 async function read(){if(busy)return;const mine=++token,file=$('serialImportFile').files[0];sheets=null;snapshot=null;payload=null;batch=null;summary=null;$('serialImportUpdate').disabled=true;if(!file){status('');return;}
  try{if(!/\.xlsx$/i.test(file.name))throw Error('กรุณาเลือกไฟล์ .xlsx');if(file.size>D.MAX_FILE)throw Error('ไฟล์ต้องไม่เกิน 10 MB');status('กำลังอ่านไฟล์...');
   const bytes=await file.arrayBuffer();if(mine!==token)return;const found=D.readXlsx(bytes);
   const prepared=prepare(found);sheets=found;summary=prepared.summary;filename=file.name.slice(0,240);status('พร้อมอัปเดต '+prepared.rows.length.toLocaleString()+' รายการ'+importSummary(summary));$('serialImportUpdate').disabled=false;
  }catch(e){if(mine===token)status(D.friendly(e),true);}
 }
 async function update(){if(busy||!sheets)return;busy=true;const file=$('serialImportFile'),button=$('serialImportUpdate');file.disabled=true;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='กำลังอัปเดต...';status('กำลังอัปเดตข้อมูล...');
  try{if(!payload){snapshot=await rpc('qa_serial_admin_snapshot');payload=D.payload(prepare(sheets,snapshot).rows);batch=D.uuid();}
   const result=await rpc('qa_serial_import',{p_rows:payload,p_expected_revision:snapshot.revision,p_batch_id:batch,p_filename:filename});
   if(!result||result.imported!==payload.length)throw Error('ยังไม่ได้รับผลยืนยันครบ กดอัปเดตอีกครั้งได้');
   status('อัปเดตแล้ว '+result.imported.toLocaleString()+' รายการ'+importSummary(summary));sheets=null;snapshot=null;payload=null;batch=null;summary=null;file.value='';
  }catch(e){if(String(e.message||e).includes('IMPORT_VERSION_CONFLICT')){snapshot=null;payload=null;batch=null;status('มีการอัปเดตจากอีกหน้าแล้ว กดอัปเดตอีกครั้งได้',true);}else status(D.friendly(e)+'\nกดอัปเดตอีกครั้งได้',true);}
  finally{busy=false;file.disabled=false;button.disabled=!sheets;button.removeAttribute('aria-busy');button.textContent='อัปเดตข้อมูล';}
 }
 async function boot(){try{await QA.whenReady();if(QA.profile?.role!=='system_admin')return;const main=document.querySelector('main');if(!main)return;
  const section=document.createElement('section');section.className='card serial-directory-settings';section.id='serialDirectorySettings';section.innerHTML='<h2>ข้อมูล Serial Number</h2><p class="muted">ใช้ไฟล์ Excel ล่าสุดจากผู้ดูแล SAP</p><div class="serial-update-controls"><input id="serialImportFile" type="file" accept=".xlsx" aria-label="ไฟล์ข้อมูล Serial Number"><button type="button" id="serialImportUpdate" class="primary" disabled>อัปเดตข้อมูล</button></div><p id="serialImportStatus" role="status" aria-live="polite"></p>';
  const note=main.querySelector('.note');if(note)note.after(section);else main.append(section);
  $('serialImportFile').addEventListener('change',read);$('serialImportUpdate').addEventListener('click',update);
 }catch(e){console.warn('Serial settings unavailable:',e.message);}}
 boot();
})();

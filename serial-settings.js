/* One file picker and one update button. Directory records are not listed on the page. */
(()=>{'use strict';const D=window.QASerialDirectory;if(!D)return;const $=id=>document.getElementById(id);
 let sheet=null,filename='',token=0,busy=false,snapshot=null,payload=null,batch=null;
 const rpc=async(name,args={})=>{const {data,error}=await QA.client.rpc(name,args);if(error)throw error;return data;};
 function status(text,bad=false){const el=$('serialImportStatus');el.textContent=text;el.dataset.bad=String(bad);}
 function prepare(current,saved){const rows=D.prepare(current,saved||{overrides:[]});
  // Ambiguous names stay as source text; blank countries stay blank. Users can edit on the job form.
  const invalid=rows.map(r=>({r,issues:D.issues({...r,reviewed:true})})).filter(x=>x.issues.length);
  if(invalid.length)throw Error(invalid.slice(0,5).map(x=>'แถว '+x.r.row+': '+x.issues.join(' · ')).join('\n'));
  return rows;
 }
 async function read(){if(busy)return;const mine=++token,file=$('serialImportFile').files[0];sheet=null;snapshot=null;payload=null;batch=null;$('serialImportUpdate').disabled=true;if(!file){status('');return;}
  try{if(!/\.xlsx$/i.test(file.name))throw Error('กรุณาเลือกไฟล์ .xlsx');if(file.size>D.MAX_FILE)throw Error('ไฟล์ต้องไม่เกิน 10 MB');status('กำลังอ่านไฟล์...');
   const bytes=await file.arrayBuffer();if(mine!==token)return;const found=D.readXlsx(bytes).filter(s=>D.getHeaders(s));if(found.length!==1)throw Error(found.length?'พบหลายตาราง Serial กรุณาใช้ไฟล์ที่มีตาราง Serial เพียงชีตเดียว':'ไม่พบคอลัมน์ internalSN, customer, custmrName, country และ Name');
   const rows=prepare(found[0]);sheet=found[0];filename=file.name.slice(0,240);status('พร้อมอัปเดต '+rows.length.toLocaleString()+' รายการ');$('serialImportUpdate').disabled=false;
  }catch(e){if(mine===token)status(D.friendly(e),true);}
 }
 async function update(){if(busy||!sheet)return;busy=true;const file=$('serialImportFile'),button=$('serialImportUpdate');file.disabled=true;button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='กำลังอัปเดต...';status('กำลังอัปเดตข้อมูล...');
  try{if(!payload){snapshot=await rpc('qa_serial_admin_snapshot');payload=D.payload(prepare(sheet,snapshot));batch=D.uuid();}
   const result=await rpc('qa_serial_import',{p_rows:payload,p_expected_revision:snapshot.revision,p_batch_id:batch,p_filename:filename});
   if(!result||result.imported!==payload.length)throw Error('ยังไม่ได้รับผลยืนยันครบ กดอัปเดตอีกครั้งได้');
   status('อัปเดตแล้ว '+result.imported.toLocaleString()+' รายการ');sheet=null;snapshot=null;payload=null;batch=null;file.value='';
  }catch(e){if(String(e.message||e).includes('IMPORT_VERSION_CONFLICT')){snapshot=null;payload=null;batch=null;status('มีการอัปเดตจากอีกหน้าแล้ว กดอัปเดตอีกครั้งได้',true);}else status(D.friendly(e)+'\nกดอัปเดตอีกครั้งได้',true);}
  finally{busy=false;file.disabled=false;button.disabled=!sheet;button.removeAttribute('aria-busy');button.textContent='อัปเดตข้อมูล';}
 }
 async function boot(){try{await QA.whenReady();if(QA.profile?.role!=='system_admin')return;const main=document.querySelector('main');if(!main)return;
  const section=document.createElement('section');section.className='card serial-directory-settings';section.id='serialDirectorySettings';section.innerHTML='<h2>ข้อมูล Serial Number</h2><p class="muted">ใช้ไฟล์ Excel ล่าสุดจากผู้ดูแล SAP</p><div class="serial-update-controls"><input id="serialImportFile" type="file" accept=".xlsx" aria-label="ไฟล์ข้อมูล Serial Number"><button type="button" id="serialImportUpdate" class="primary" disabled>อัปเดตข้อมูล</button></div><p id="serialImportStatus" role="status" aria-live="polite"></p>';
  const note=main.querySelector('.note');if(note)note.after(section);else main.append(section);
  $('serialImportFile').addEventListener('change',read);$('serialImportUpdate').addEventListener('click',update);
 }catch(e){console.warn('Serial settings unavailable:',e.message);}}
 boot();
})();

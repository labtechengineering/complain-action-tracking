/* Inactive master cleanup and the saved short descriptions of Other categories. */
(()=>{'use strict';
const original=window.renderMaster;
if(original)window.renderMaster=function(rows){const host=document.getElementById('master'),open=host.querySelector('details')?.open===true;
 const active=(rows||[]).filter(r=>r.active!==false),inactive=(rows||[]).filter(r=>r.active===false);
 original(active);const visible=document.createElement('div');visible.append(...host.childNodes);
 const fold=document.createElement('details');fold.open=open;fold.style.marginTop='16px';const summary=document.createElement('summary');summary.style.cssText='cursor:pointer;font-weight:600;padding:10px 0';summary.textContent='รายการไม่ Active ('+inactive.length+')';fold.append(summary);
 original(inactive);const old=document.createElement('div');old.append(...host.childNodes);fold.append(old);host.replaceChildren(visible,fold);
 for(const tr of old.querySelectorAll('tr[data-type][data-code]')){const button=document.createElement('button');button.type='button';button.className='reject';button.textContent='ลบ';button.style.marginLeft='6px';button.onclick=async()=>{
  const type=tr.dataset.type,code=tr.dataset.code;
  if(!confirm('ลบ Master Data '+code+'?\nลบได้เฉพาะรายการไม่ Active ที่ไม่มีการอ้างอิงหรือประวัติใช้งาน'))return;
  button.disabled=true;try{const {error}=await QA.client.rpc('qa_admin_delete_inactive_setting',{p_type:type,p_code:code});if(error)throw error;show('ลบ Master Data '+code+' แล้ว');await reloadAll();}
  catch(e){let m=e?.message||String(e);if(m.includes('MASTER_DATA_IN_USE'))m='รายการนี้ยังมีการอ้างอิงหรือประวัติใช้งาน จึงลบไม่ได้';else if(m.includes('SETTING_STILL_ACTIVE'))m='รายการนี้ยัง Active อยู่ กรุณาบันทึกเป็นไม่ Active ก่อน';show(m,true);button.disabled=false;}
 };tr.lastElementChild.append(button);}
};
async function init(){await QA.whenReady();if(QA.profile.role!=='system_admin')return;
 const section=document.createElement('section');section.className='card';section.id='otherCategoryHistory';const fold=document.createElement('details'),summary=document.createElement('summary');summary.style.cssText='cursor:pointer;font-weight:700;font-size:18px';summary.textContent='ประเภทปัญหาอื่นๆ ที่ระบุ';const body=document.createElement('div');body.style.marginTop='14px';fold.append(summary,body);section.append(fold);document.querySelector('main').append(section);
 const {data,error}=await QA.client.rpc('qa_admin_other_category_history');if(error){body.textContent='โหลดประวัติไม่สำเร็จ กรุณารีเฟรชเพื่อลองอีกครั้ง';return;}
 const rows=Array.isArray(data)?data:[];summary.textContent='ประเภทปัญหาอื่นๆ ที่ระบุ ('+rows.length+')';
 if(!rows.length){body.textContent='ยังไม่มีรายการที่ระบุ';return;}
 const table=document.createElement('table');table.style.minWidth='500px';table.innerHTML='<thead><tr><th>ประเภทที่ระบุ</th><th>จำนวนปัญหา</th><th>ล่าสุด</th></tr></thead>';const tbody=document.createElement('tbody');
 for(const row of rows){const tr=document.createElement('tr');for(const value of [row.label,String(row.issue_count),new Date(row.last_used_at).toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok'})]){const td=document.createElement('td');td.textContent=value;tr.append(td);}tbody.append(tr);}table.append(tbody);body.append(table);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error));else init().catch(console.error);
})();

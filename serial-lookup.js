/* Exact serial lookup for NEW jobs only. Manual entries are never overwritten silently. */
(()=>{'use strict';let instance=null;
 function mount(){if(instance||new URLSearchParams(location.search).has('edit'))return;const serial=document.getElementById('serialNo'),customer=document.getElementById('vnCustomer'),country=document.getElementById('vnCountry');if(!serial||!customer||!country)return;
  const box=document.createElement('div');box.className='serial-lookup';const search=document.createElement('button');search.type='button';search.textContent='ค้นหา Serial';const apply=document.createElement('button');apply.type='button';apply.textContent='ใช้ข้อมูลจาก Serial นี้';apply.hidden=true;const message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.textContent='พิมพ์ Serial Number เพื่อเติมลูกค้าและประเทศ หากไม่พบสามารถกรอกเองได้';box.append(search,apply,message);serial.closest('.grid')?.after(box);
  const fields=[customer,country],owned=new Map(fields.map(f=>[f,null]));let timer=null,seq=0,pending=null,lastKey='',matched=null;
  const key=()=>serial.value.trim().toUpperCase();
  function setMessage(text,bad=false){message.textContent=text;message.dataset.bad=String(bad);}
  function applyMatch(force=false){if(!matched||matched.key!==key())return;const values=[matched.row.customer_name||'',matched.row.country||''];let kept=false;fields.forEach((field,i)=>{if(force||!field.value.trim()||(owned.get(field)!==null&&field.value===owned.get(field))){field.value=values[i];owned.set(field,values[i]);}else kept=true;});apply.hidden=!kept;setMessage(kept?'พบข้อมูล Serial แล้ว · คงข้อมูลที่คุณกรอกเองไว้ กด “ใช้ข้อมูลจาก Serial นี้” หากต้องการแทนที่':'พบ Serial แล้ว เติมลูกค้าและประเทศให้แล้ว · สามารถแก้ไขได้');}
  for(const field of fields)field.addEventListener('input',()=>{owned.set(field,null);if(matched&&matched.key===key()){apply.hidden=false;setMessage('ใช้ข้อมูลที่คุณกรอกเอง · กด “ใช้ข้อมูลจาก Serial นี้” หากต้องการคืนข้อมูลอ้างอิง');}});
  async function run(){clearTimeout(timer);timer=null;const current=key();if(!current){lastKey='';pending=null;return;}
   if(pending&&lastKey===current)return pending;const mine=++seq;lastKey=current;matched=null;apply.hidden=true;search.disabled=true;setMessage('กำลังค้นหา Serial...');
   const task=(async()=>{try{await QA.whenReady();if(!['system_admin','department_admin','user'].includes(QA.profile?.role))return;const {data,error}=await QA.client.rpc('qa_serial_lookup',{p_serial_no:current});if(error)throw error;if(mine!==seq||key()!==current)return;
     if(!data){setMessage('ไม่พบ Serial นี้ในข้อมูลอ้างอิง · กรอกลูกค้าและประเทศเองได้');return;}matched={key:current,row:data};applyMatch();
    }catch(e){if(mine===seq&&key()===current)setMessage('ค้นหาไม่ได้ในขณะนี้ · กรอกลูกค้าและประเทศเองได้',true);}
    finally{if(mine===seq){search.disabled=serial.disabled;pending=null;}}
   })();pending=task;return task;
  }
  serial.addEventListener('input',()=>{clearTimeout(timer);seq++;pending=null;matched=null;apply.hidden=true;search.disabled=serial.disabled;for(const field of fields){if(owned.get(field)!==null&&field.value===owned.get(field))field.value='';owned.set(field,null);}if(key()){setMessage('กำลังรอค้นหา Serial...');timer=setTimeout(run,400);}else{lastKey='';setMessage('กรอกลูกค้าและประเทศเองได้ หรือพิมพ์ Serial Number เพื่อค้นหา');}});
  search.onclick=()=>run();apply.onclick=()=>applyMatch(true);
  instance={settle:async()=>{let before;do{before=key();if(timer||before&&before!==lastKey)await run();else if(pending)await pending;}while(key()!==before||timer);}};
 }
 window.QASerialLookup=Object.freeze({mount,settle:async()=>{if(instance)await instance.settle();}});
})();

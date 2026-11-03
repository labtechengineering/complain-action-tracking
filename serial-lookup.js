/* Quiet automatic lookup. All customer/country fields stay editable. */
(()=>{'use strict';let instance=null;
 function mount(){if(instance||new URLSearchParams(location.search).has('edit'))return;
  const serial=document.getElementById('serialNo'),customer=document.getElementById('vnCustomer'),country=document.getElementById('vnCountry');if(!serial||!customer||!country)return;
  const message=document.createElement('p');message.className='serial-lookup-note';message.setAttribute('role','status');message.setAttribute('aria-live','polite');message.hidden=true;serial.closest('.grid')?.after(message);
  const fields=[customer,country],owned=new Map(fields.map(f=>[f,null]));let timer=null,seq=0,pending=null,lastKey='';
  const key=()=>serial.value.trim().toUpperCase();
  function status(text){message.textContent=text;message.hidden=!text;}
  for(const field of fields)field.addEventListener('input',()=>{owned.set(field,null);status('');});
  async function run(){clearTimeout(timer);timer=null;const current=key();if(!current){lastKey='';pending=null;status('');return;}
   if(pending&&lastKey===current)return pending;
   const mine=++seq;lastKey=current;status('กำลังค้นหา...');
   const task=(async()=>{try{await QA.whenReady();if(!['system_admin','department_admin','user'].includes(QA.profile?.role)){status('');return;}
     const {data,error}=await QA.client.rpc('qa_serial_lookup',{p_serial_no:current});if(error)throw error;if(mine!==seq||key()!==current)return;
     if(!data){status('ไม่พบ Serial นี้ กรอกลูกค้าและประเทศเองได้');return;}
     const values=[data.customer_name||'',data.country||''];fields.forEach((field,i)=>{if(!field.value.trim()||(owned.get(field)!==null&&field.value===owned.get(field))){field.value=values[i];owned.set(field,values[i]);}});status('');
    }catch(e){if(mine===seq&&key()===current)status('ค้นหาไม่ได้ในขณะนี้ กรอกลูกค้าและประเทศเองได้');}
    finally{if(mine===seq)pending=null;}
   })();pending=task;return task;
  }
  serial.addEventListener('input',()=>{clearTimeout(timer);seq++;pending=null;for(const field of fields){if(owned.get(field)!==null&&field.value===owned.get(field))field.value='';owned.set(field,null);}status('');if(key())timer=setTimeout(run,300);else{timer=null;lastKey='';}});
  serial.addEventListener('blur',()=>{if(timer||key()&&key()!==lastKey)void run();});
  instance={settle:async()=>{let before;do{before=key();if(timer||before&&before!==lastKey)await run();else if(pending)await pending;}while(key()!==before||timer);}};
 }
 window.QASerialLookup=Object.freeze({mount,settle:async()=>{if(instance)await instance.settle();}});
})();

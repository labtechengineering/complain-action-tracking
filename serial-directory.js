/* Local XLSX reader + explicit customer/country preparation. No workbook code or links execute. */
(()=>{'use strict';
 const MAX_ROWS=20000,MAX_FILE=10*1024*1024;
 const text=v=>String(v??'').trim(),key=v=>text(v).toUpperCase(),nameKey=(code,raw)=>JSON.stringify([text(code),text(raw)]);
 function splitName(raw,country){
  const name=text(raw),c=text(country);if(!name||!c)return {name,split:false};
  let prefix=null;
  if(name.toLowerCase().endsWith((c+'.').toLowerCase()))prefix=name.slice(0,-c.length-1).trim();
  else if(name.toLowerCase().endsWith(c.toLowerCase()))prefix=name.slice(0,-c.length).trim();
  // Country is removed only at the end, following a comma or colon. The period in Ltd. is retained.
  if(prefix&&/[,:]$/.test(prefix)){const clean=prefix.replace(/[\s,:]+$/u,'').trim();if(clean)return {name:clean,split:true};}
  return {name,split:false};
 }
 function xml(data){const d=new DOMParser().parseFromString(new TextDecoder().decode(data),'application/xml');if(d.getElementsByTagName('parsererror').length||d.doctype)throw Error('ไฟล์ Excel มี XML ที่ไม่รองรับ');return d;}
 const nodes=(parent,name)=>Array.from(parent.getElementsByTagNameNS('*',name));
 const content=parent=>nodes(parent,'t').map(x=>x.textContent).join('');
 function readXlsx(buffer){
  const data=new Uint8Array(buffer);if(data.byteLength>MAX_FILE)throw Error('ไฟล์ต้องไม่เกิน 10 MB');
  if(!window.fflate)throw Error('โหลดตัวอ่าน Excel ไม่สำเร็จ กรุณารีเฟรชหน้า');
  let total=0,files=0;const zip=fflate.unzipSync(data,{filter:f=>{
   if(++files>2000)throw Error('ไฟล์ Excel มีส่วนประกอบมากเกินไป');
   const want=/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(f.name);
   if(want){total+=f.originalSize;if(f.originalSize>30*1024*1024||total>60*1024*1024)throw Error('ข้อมูลใน Excel ใหญ่เกินไป กรุณาใช้เฉพาะตาราง Serial');}
   return want;
  }});
  const required=name=>{if(!zip[name])throw Error('ไฟล์ไม่ใช่ .xlsx ที่รองรับ');return xml(zip[name]);};
  const wb=required('xl/workbook.xml'),rels=required('xl/_rels/workbook.xml.rels');
  const targets=new Map(nodes(rels,'Relationship').filter(r=>r.getAttribute('TargetMode')!=='External').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
  const shared=zip['xl/sharedStrings.xml']?nodes(xml(zip['xl/sharedStrings.xml']),'si').map(content):[];
  return nodes(wb,'sheet').map(sh=>{
   const id=sh.getAttribute('r:id')||sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
   const target=targets.get(id)||'';const path=target.startsWith('/xl/')?target.slice(1):'xl/'+target.replace(/^\.\//,'');
   if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(path)||!zip[path])return null;
   const rows=[];for(const r of nodes(required(path),'row')){
    const row=[];let nonempty=false;for(const c of nodes(r,'c')){
     const ref=c.getAttribute('r')||'',col=ref.match(/^([A-Z]+)\d+$/)?.[1];if(!col)continue;
     let index=0;for(const ch of col)index=index*26+ch.charCodeAt(0)-64;index--;if(index>255)continue;
     const t=c.getAttribute('t'),v=nodes(c,'v')[0]?.textContent||'';let value=t==='s'?(v===''?'':shared[Number(v)]??''):t==='inlineStr'?content(c):v;
     if(t==='e')throw Error('พบเซลล์ Error ที่ '+ref+' ในชีต '+sh.getAttribute('name'));
     row[index]={value:text(value),numeric:(!t||t==='n')&&value!==''};if(text(value))nonempty=true;
    }
    if(nonempty)rows.push({number:Number(r.getAttribute('r'))||rows.length+1,cells:row});
    if(rows.length>MAX_ROWS+11)throw Error('รองรับสูงสุด 20,000 รายการต่อไฟล์');
   }
   return {name:sh.getAttribute('name'),rows};
  }).filter(Boolean);
 }
 function getHeaders(sheet){
  for(let i=0;i<Math.min(sheet.rows.length,10);i++){
   const header=sheet.rows[i].cells.map(c=>text(c?.value).toLowerCase());
   const names=['internalsn','customer','custmrname','country','name'];
   if(names.every(n=>header.includes(n))){if(names.some(n=>header.filter(h=>h===n).length!==1))throw Error('หัวคอลัมน์ซ้ำในชีต '+sheet.name);return {index:i,columns:Object.fromEntries(names.map(n=>[n,header.indexOf(n)]))};}
  }return null;
 }
 function prepare(sheet,snapshot){
  const header=getHeaders(sheet);if(!header)throw Error('ต้องมีคอลัมน์ internalSN, customer, custmrName, country และ Name');
  const remembered=new Map((snapshot.overrides||[]).map(o=>[nameKey(o.customer_code,o.source_customer),o.customer_name]));
  const countries=[...new Set(sheet.rows.slice(header.index+1).map(r=>text(r.cells[header.columns.name]?.value)).filter(Boolean))].sort((a,b)=>b.length-a.length);
  const records=[];const seen=new Map(),errors=[];
  for(const source of sheet.rows.slice(header.index+1)){
   const cell=n=>source.cells[header.columns[n]],v=n=>text(cell(n)?.value);
   if(!['internalsn','customer','custmrname','country','name'].some(n=>v(n)))continue;
   const serial=v('internalsn'),raw=v('custmrname'),code=v('customer'),countryCode=v('country'),country=v('name')||countryCode;
   if(!serial){errors.push('แถว '+source.number+': ไม่มี Serial Number');continue;}
   if(cell('internalsn')?.numeric){errors.push('แถว '+source.number+': Serial Number เป็นตัวเลขใน Excel กรุณาจัดเป็นข้อความเพื่อรักษาศูนย์นำหน้า');continue;}
   if(seen.has(key(serial))){errors.push('Serial ซ้ำ '+serial+' (แถว '+seen.get(key(serial))+' และ '+source.number+')');continue;}seen.set(key(serial),source.number);
   const split=splitName(raw,country),saved=remembered.get(nameKey(code,raw));
   const otherCountry=countries.find(c=>c.toLowerCase()!==country.toLowerCase()&&splitName(raw,c).split);
   const needsReview=!country||!!otherCountry;
   records.push({row:source.number,serial_no:serial,customer_code:code,source_customer:raw,customer_name:saved||split.name,country_code:countryCode,country_name:country,
    remember_name:false,reviewed:!needsReview,needsReview,reason:saved?'ใช้ชื่อที่เคยแก้ไว้':otherCountry?'ประเทศท้ายชื่อไม่ตรงกับคอลัมน์ประเทศ':!country?'ไม่พบประเทศ กรุณาตรวจ หรือยืนยันเว้นว่าง':split.split?'แยกประเทศท้ายชื่อแล้ว':'คงชื่อต้นฉบับ'});
  }
  const grouped=new Map();for(const r of records){const k=nameKey(r.customer_code,r.source_customer);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);}for(const group of grouped.values())if(new Set(group.map(r=>r.customer_name)).size>1)for(const r of group){r.customer_name=r.source_customer;r.needsReview=true;r.reviewed=false;r.reason='ชื่อ SAP เดียวกันแต่ข้อมูลประเทศต่างกัน กรุณาตรวจชื่อที่ต้องการใช้';}
  if(errors.length)throw Error(errors.slice(0,12).join('\n')+(errors.length>12?'\nและอีก '+(errors.length-12)+' รายการ':''));
  if(!records.length||records.length>MAX_ROWS)throw Error('จำนวนข้อมูลต้องอยู่ระหว่าง 1–20,000 รายการ');
  return records;
 }
 function issues(row){const errors=[];
  if(!row.serial_no||row.serial_no.length>120||/[\u0000-\u001f\u007f]/.test(row.serial_no))errors.push('Serial ไม่ถูกต้อง');
  if(!text(row.source_customer)||row.source_customer.length>2000)errors.push('ชื่อจาก SAP ว่างหรือยาวเกิน 2,000 ตัวอักษร');
  if(!text(row.customer_name)||text(row.customer_name).length>200)errors.push('ชื่อลูกค้าต้องมี 1–200 ตัวอักษร');
  if(row.customer_code.length>120||row.country_code.length>16||text(row.country_name).length>120)errors.push('ข้อมูลยาวเกินกำหนด');
  if(row.needsReview&&!row.reviewed)errors.push('ยังไม่ได้ยืนยันตรวจข้อมูล');return errors;
 }
 function payload(records){return records.map(r=>({serial_no:text(r.serial_no),customer_code:text(r.customer_code),source_customer:text(r.source_customer),customer_name:text(r.customer_name),country_code:text(r.country_code),country_name:text(r.country_name),remember_name:!!r.remember_name}));}
 function uuid(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
 function friendly(error){const msg=error?.message||String(error);if(/PGRST202|function .* does not exist|schema cache/i.test(msg)||['PGRST202','42883'].includes(error?.code))return 'ยังไม่ได้ติดตั้งส่วนข้อมูล Serial กรุณารัน SQL 01_SERIAL_DIRECTORY.sql ก่อน';if(msg.includes('IMPORT_VERSION_CONFLICT'))return 'ข้อมูลถูกอัปเดตจากอีกหน้าหนึ่งแล้ว กรุณาเลือกไฟล์ใหม่เพื่อตรวจเทียบข้อมูลล่าสุด';return msg;}
 window.QASerialDirectory=Object.freeze({MAX_ROWS,MAX_FILE,text,key,nameKey,splitName,readXlsx,getHeaders,prepare,issues,payload,uuid,friendly});
})();

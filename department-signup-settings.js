(() => {
  'use strict';
  async function rpc(name, params) {
    const {data, error} = await QA.client.rpc(name, params);
    if (error) throw error;
    return data;
  }
  function describe(enabled) {
    return enabled
      ? 'เปิดอยู่ — เพิ่มแผนกแล้วสมัครสมาชิกต่อได้ทันที ไม่ต้องรออนุมัติ'
      : 'ปิดอยู่ — ผู้สมัครเลือกได้เฉพาะแผนกที่มีอยู่ ผู้ดูแลยังเพิ่มแผนกผ่าน Master Data ได้';
  }
  async function boot() {
    const toggle = document.getElementById('allowDepartmentCreation');
    const status = document.getElementById('departmentPolicyStatus');
    if (!toggle || !status) return;
    for (let n = 0; n < 160 && !window.QA?.profile; n++)
      await new Promise(resolve => setTimeout(resolve, 100));
    if (window.QA?.profile?.role !== 'system_admin') return;
    let saved = false;
    try {
      const policy = await rpc('qa_public_department_creation_policy', {});
      if (typeof policy?.allowCreation !== 'boolean') throw new Error('INVALID_POLICY');
      saved = toggle.checked = policy.allowCreation;
      status.textContent = describe(saved);
      toggle.disabled = false;
    } catch (error) {
      status.textContent = 'โหลดการตั้งค่าไม่สำเร็จ กรุณาโหลดหน้าใหม่: ' + QA.errorOf(error).message;
      return;
    }
    toggle.addEventListener('change', async () => {
      toggle.disabled = true;
      status.textContent = 'กำลังบันทึก...';
      try {
        const policy = await rpc('qa_admin_set_department_creation', {p_enabled: toggle.checked});
        if (typeof policy?.allowCreation !== 'boolean') throw new Error('INVALID_POLICY');
        saved = toggle.checked = policy.allowCreation;
        status.textContent = 'บันทึกแล้ว — ' + describe(saved);
      } catch (error) {
        toggle.checked = saved;
        status.textContent = 'บันทึกไม่สำเร็จ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบสถานะ: ' + QA.errorOf(error).message;
      } finally {
        toggle.disabled = false;
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();

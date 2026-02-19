// message-management.js
// Mesaj gönderme ile ilgili tüm fonksiyonlar

// ==================== RESİM İŞLEME FONKSİYONLARI ====================

// Resim boyut ve format kontrolü (WhatsApp standartları)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGES_COUNT = 10; // Maksimum 10 resim
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function validateImage(file) {
  if (!file) return { valid: false, error: 'Dosya seçilmedi.' };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Desteklenmeyen format. Lütfen JPG, PNG, GIF veya WEBP seçin.' };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Dosya çok büyük. Maksimum 5MB olmalı.' };
  }
  return { valid: true };
}

// Birden fazla resim doğrulama
function validateImages(files) {
  if (!files || files.length === 0) return { valid: false, error: 'Dosya seçilmedi.' };
  if (files.length > MAX_IMAGES_COUNT) {
    return { valid: false, error: `En fazla ${MAX_IMAGES_COUNT} resim seçebilirsiniz.` };
  }
  for (let i = 0; i < files.length; i++) {
    const validation = validateImage(files[i]);
    if (!validation.valid) {
      return { valid: false, error: `${files[i].name}: ${validation.error}` };
    }
  }
  return { valid: true };
}

// Dosyayı base64'e çevir
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // data:image/png;base64,xxxx formatından sadece base64 kısmını al
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Resim önizleme göster (tek resim)
function showImagePreview(previewId, file) {
  const previewDiv = document.getElementById(previewId);
  if (!previewDiv) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewDiv.innerHTML = `
      <img src="${e.target.result}" class="img-thumbnail" style="max-height:100px; max-width:150px;" />
      <small class="d-block text-muted mt-1">${file.name} (${(file.size / 1024).toFixed(1)} KB)</small>
    `;
  };
  reader.readAsDataURL(file);
}

// Çoklu resim önizleme göster
function showMultipleImagePreviews(previewId, files) {
  const previewDiv = document.getElementById(previewId);
  if (!previewDiv) return;
  previewDiv.innerHTML = '';
  
  Array.from(files).forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const imgContainer = document.createElement('div');
      imgContainer.className = 'd-inline-block me-2 mb-2 position-relative';
      imgContainer.innerHTML = `
        <img src="${e.target.result}" class="img-thumbnail" style="max-height:80px; max-width:100px;" />
        <small class="d-block text-muted text-center" style="font-size:10px;">${file.name.substring(0, 15)}${file.name.length > 15 ? '...' : ''}</small>
      `;
      previewDiv.appendChild(imgContainer);
    };
    reader.readAsDataURL(file);
  });
  
  // Toplam bilgi
  const totalSize = Array.from(files).reduce((sum, f) => sum + f.size, 0);
  const infoDiv = document.createElement('div');
  infoDiv.className = 'text-muted mt-1';
  infoDiv.innerHTML = `<small>${files.length} resim seçildi (${(totalSize / 1024).toFixed(1)} KB)</small>`;
  previewDiv.appendChild(infoDiv);
}

// Resim önizlemeyi temizle
function clearImagePreview(previewId) {
  const previewDiv = document.getElementById(previewId);
  if (previewDiv) previewDiv.innerHTML = '';
}

// Global değişken: seçilen resimler (suffix bazlı) - artık array tutacak
const selectedImages = {};

// Resim input değişikliği event listener'ı (delegated) - çoklu resim destekli
document.addEventListener('change', async (e) => {
  if (!e.target || e.target.type !== 'file') return;
  const inputId = e.target.id;
  if (!inputId) return;

  // singleMsgImage, bulkMsgImage, multiMsgImage veya instance-scoped versiyonları
  const files = e.target.files;
  if (!files || files.length === 0) return;

  // Çoklu dosya kontrolü
  const validation = validateImages(files);
  if (!validation.valid) {
    showPopupAlert(validation.error, 'danger');
    e.target.value = '';
    return;
  }

  // Suffix'i bul (örn: singleMsgImage-kk665 -> -kk665)
  let suffix = '';
  let baseId = '';
  if (inputId.startsWith('singleMsgImage')) {
    baseId = 'singleMsgImage';
    suffix = inputId.replace('singleMsgImage', '');
  } else if (inputId.startsWith('bulkMsgImage')) {
    baseId = 'bulkMsgImage';
    suffix = inputId.replace('bulkMsgImage', '');
  } else if (inputId.startsWith('multiMsgImage')) {
    baseId = 'multiMsgImage';
    suffix = inputId.replace('multiMsgImage', '');
  } else {
    return;
  }

  try {
    // Tüm dosyaları base64'e çevir
    const base64Array = await Promise.all(Array.from(files).map(f => fileToBase64(f)));
    selectedImages[inputId] = base64Array; // Artık array olarak saklıyoruz

    // Önizleme göster
    const previewId = baseId + 'Preview' + suffix;
    if (files.length === 1) {
      showImagePreview(previewId, files[0]);
    } else {
      showMultipleImagePreviews(previewId, files);
    }

    // Kaldır butonunu göster
    const clearBtn = document.getElementById(baseId + 'Clear' + suffix);
    if (clearBtn) clearBtn.style.display = '';
  } catch (err) {
    showPopupAlert('Resim yüklenirken hata: ' + err.message, 'danger');
  }
});

// Kaldır butonu event listener'ı (delegated)
document.addEventListener('click', (e) => {
  if (!e.target || !e.target.id) return;
  const btnId = e.target.id;

  let baseId = '';
  let suffix = '';
  if (btnId.startsWith('singleMsgImageClear')) {
    baseId = 'singleMsgImage';
    suffix = btnId.replace('singleMsgImageClear', '');
  } else if (btnId.startsWith('bulkMsgImageClear')) {
    baseId = 'bulkMsgImage';
    suffix = btnId.replace('bulkMsgImageClear', '');
  } else if (btnId.startsWith('multiMsgImageClear')) {
    baseId = 'multiMsgImage';
    suffix = btnId.replace('multiMsgImageClear', '');
  } else {
    return;
  }

  const inputId = baseId + suffix;
  const input = document.getElementById(inputId);
  if (input) input.value = '';

  delete selectedImages[inputId];
  clearImagePreview(baseId + 'Preview' + suffix);
  e.target.style.display = 'none';
});

// ==================== RESİM İŞLEME FONKSİYONLARI SONU ====================

// Bugün gönderilen başarılı mesaj sayısını çek ve arayüze yaz
async function fetchTodaySentCount() {
  // Önce localStorage'dan bugünkü sayaç varsa onu göster
  // Kullanıcıya özel anahtar oluştur
  const userToken = sessionStorage.getItem('user_token') || sessionStorage.getItem('token') || '';
  const todayKey = 'sentTodayCount_' + userToken;
  const todayDate = new Date().toISOString().slice(0, 10);
  let localCount = 0;
  try {
    const stored = JSON.parse(sessionStorage.getItem(todayKey) || '{}');
    if (stored.date === todayDate) {
      localCount = stored.count || 0;
    }
  } catch {}
  document.getElementById('sentToday').textContent = localCount;
  // Ayrıca backend'den de çekip localStorage'ı güncelle
  const token = sessionStorage.getItem('token') || sessionStorage.getItem('user_token');
  if (!token) return;
  try {
    const res = await fetch('http://localhost:3001/api/reports/today-sent-count', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('API hatası');
    const data = await res.json();
    // Eğer backend sayısı localden büyükse locali güncelle
    if ((data.count ?? 0) > localCount) {
      sessionStorage.setItem(todayKey, JSON.stringify({ date: todayDate, count: data.count ?? 0 }));
      document.getElementById('sentToday').textContent = data.count ?? 0;
    }
  } catch (e) {}
}

// Sayfa yüklendiğinde bugünkü gönderilen mesaj sayısını getir
window.addEventListener('DOMContentLoaded', fetchTodaySentCount);
const evoApiBaseUrl = "http://localhost:8080"; // Evolution API
const apiBaseUrl = "http://localhost:8080"; // mesaj ve instance işlemleri için
const apiKey = sessionStorage.getItem('user_token') || '';

// ✅ Test modu: true ise süreler çok kısa, false ise gerçek süreler
const testMode = false; // Test bittiğinde false yap

// Dakika → Milisaniye çevirici (gerekirse kullanılabilir)
function minuteToMs(minutes) {
  if (testMode) {
    return minutes * 1000;
  } else {
    return minutes * 60 * 1000;
  }
}

// Global message limit for user
let userMessageLimit = null;
let lastMessageTime = 0;

// Grup API sabitleri
const groupApiBaseUrl = "http://localhost:3001/api";

// Kullanıcının mesaj limiti bilgisini çeken fonksiyon
async function getUserMessageLimit() {
  const token = sessionStorage.getItem('token');
    if (!token) {
        console.error('Token bulunamadı, mesaj limiti alınamaz');
        return null;
    }

    try {
        const res = await fetch('http://localhost:3001/api/user/message-limit', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            console.error('Mesaj limiti alınamadı:', res.statusText);
            return null;
        }

        const data = await res.json();
        // Farklı backend dönüşleri için tüm olası alanları kontrol et
        return (
          data.message_limit ??
          data.messageRateLimit ??
          data.messageLimit ??
          null
        );

  } catch (err) {
    console.error('Mesaj limiti istek hatası:', err);
    return null;
  }
}

// Tarih formatlayıcı (ISO string -> gg.aa.yyyy), saat/dakika/saniye veya TZ dikkate alınmaz
function formatDateNoTZ(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// Grup API: Grupları çek
async function fetchGroups() {
  const token = sessionStorage.getItem('group_token') || sessionStorage.getItem('token') || '';
  if (!token) {
    console.warn("⚠️ Grup token bulunamadı. Giriş yapın.");
    return [];
  }
  try {
    const res = await fetch(`${groupApiBaseUrl}/groups`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      console.error("❌ Gruplar alınamadı:", res.status);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    } else if (Array.isArray(data.groups)) {
      return data.groups;
    } else {
      console.warn("⚠️ Gruplar listesi beklenmeyen formatta:", data);
      return [];
    }
  } catch (err) {
    console.error("❌ Gruplar alınırken hata:", err);
    return [];
  }
}

// Grup API: Grup üyelerini çek
async function fetchGroupMembers(groupId) {
  const token = sessionStorage.getItem('group_token') || sessionStorage.getItem('token') || '';
  if (!token) {
    console.warn("⚠️ Grup token bulunamadı. Giriş yapın.");
    return [];
  }
  try {
    const res = await fetch(`${groupApiBaseUrl}/groups/${groupId}/details`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      console.error("❌ Grup üyeleri alınamadı:", res.status);
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    } else if (Array.isArray(data.members)) {
      return data.members;
    } else if (Array.isArray(data.persons)) {
      return data.persons;
    } else {
      console.warn("⚠️ Grup üyeleri beklenmeyen formatta:", data);
      return [];
    }
  } catch (err) {
    console.error("❌ Grup üyeleri alınırken hata:", err);
    return [];
  }
}

// Aktif instance'ları kontrol et
// async function checkActiveInstances() {
  //try {
    //const res = await fetch(`${apiBaseUrl}/instance/fetchInstances`, {
    //  headers: {
    //    "Content-Type": "application/json",
    //    "apikey": apiKey
    //  }
    //});
    //const instances = await res.json();
  //  const filteredInstances = Array.isArray(instances) ? 
      //instances.filter(inst => inst.token === apiKey && inst.connectionStatus === 'open') : [];
    
    //return filteredInstances.length > 0;
  //} catch (error) {
   // console.error("Instance kontrol hatası:", error);
    //return false;
  //}
//}

// Mesaj gönderme ile ilgili modal ve butonları instance kartına ekleme


// Normal (tekli) mesaj gönderme fonksiyonu
async function sendNormalMessage(messageText, phone = null) {
  // phone parametresi verilirse o numaraya gönder, yoksa inputtan al
  let number = phone;
  if (!number) {
    // Örnek: bir input ile alınabilir veya kullanıcıdan alınır
    number = prompt("Numara girin (örn: 905xxxxxxxxx):");
    if (!number) return;
  }
  const evoToken = sessionStorage.getItem("evoApiToken");
  if (!evoToken) {
    alert("Mesaj API token yok.");
    return;
  }
  try {
    await fetch(`${evoApiBaseUrl}/message/sendText`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${evoToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ number: number, text: messageText })
    });
  } catch (err) {
    console.error("Mesaj gönderme hatası:", err);
  }
}

// Popup alert fonksiyonları
function showPopupAlert(message, type = 'info') {
  let popup = document.getElementById('popupAlert');
  let msgBox = document.getElementById('popupAlertMessage');
  if (!popup || !msgBox) {
    // Eğer popup HTML yoksa, basit bir alert ile göster
    alert(message);
    return;
  }
  popup.style.display = 'none';
  popup.className = `toast align-items-center text-bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
  msgBox.innerText = message;
  popup.style.display = 'block';
  setTimeout(() => {
    hidePopupAlert();
  }, 4000);
}

function hidePopupAlert() {
  let popup = document.getElementById('popupAlert');
  if (popup) popup.style.display = 'none';
}

// Instance listesini çekme ve ekrana basma (mesaj gönderme sayfası için)
async function fetchInstancesForMessaging() {
  try {
    const res = await fetch(`${apiBaseUrl}/instance/fetchInstances`, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      }
    });
    const instances = await res.json();
    const filteredInstances = Array.isArray(instances) ? 
      instances.filter(inst => inst.token === apiKey) : [];
    
    
    if (filteredInstances.length === 0) {
    }
    
    const activeInstances = filteredInstances.filter(inst => inst.connectionStatus === 'open');
    
    if (activeInstances.length === 0) {
    }
    
  } catch (error) {
    console.error("Instance çekme hatası:", error);
  }
}

// Tuşlara basıldığında içeriklerin görünmesini sağlayan fonksiyonlar
function toggleInlineContent(buttonId, contentId, contentHtml) {
  const button = document.getElementById(buttonId);
  if (!button) {
    console.error(`Button bulunamadı: ${buttonId}`);
    return;
  }

  button.addEventListener('click', async () => {
    // toggle: eğer zaten aktifse kapat
    const wasActive = button.classList.contains('active');
    // önce tüm panelleri kapat
    document.querySelectorAll('.inline-panel').forEach(p => p.remove());
    // diğer butonların durumunu sıfırla
    document.querySelectorAll('#singleMsgBtn, #bulkMsgBtn, #multiMsgBtn').forEach(btn => {
      if (btn.id !== buttonId) {
        btn.classList.remove('active');
        btn.classList.remove('btn-primary','btn-warning','btn-secondary');
        if (btn.id === 'singleMsgBtn') btn.classList.add('btn-outline-success');
        if (btn.id === 'bulkMsgBtn') btn.classList.add('btn-outline-warning');
        if (btn.id === 'multiMsgBtn') btn.classList.add('btn-outline-secondary');
      }
    });

    if (wasActive) {
      // kapatma davranışı: bu butonu da outline haline getir
      button.classList.remove('active');
      button.classList.remove('btn-primary','btn-warning','btn-secondary');
      if (button.id === 'singleMsgBtn') button.classList.add('btn-outline-success');
      if (button.id === 'bulkMsgBtn') button.classList.add('btn-outline-warning');
      if (button.id === 'multiMsgBtn') button.classList.add('btn-outline-secondary');
      return;
    }

    // Panel oluşturma akışı
    const inlineContainer = document.getElementById('inlineMsgContent');
    if (!inlineContainer) {
      console.error('inlineMsgContent bulunamadı');
      return;
    }

    // instance-safe suffix ekle (örn: MyInstance -> MyInstance)
    const instanceName = (await getFirstActiveInstanceName()) || 'inline';
    const instanceSafe = instanceName.replace(/\s+/g,'_').replace(/[^a-zA-Z0-9_\-]/g,'');

    // içeriğin tüm id/for etiketlerine suffix ekle
    let inner = contentHtml.replace(/id="([^"]+)"/g, (m, id) => `id="${id}-${instanceSafe}"`)
                           .replace(/for="([^"]+)"/g, (m, id) => `for="${id}-${instanceSafe}"`);

    const panel = document.createElement('div');
    panel.className = 'p-3 border rounded mt-2 inline-panel';
    panel.innerHTML = inner;
    // tek bir inline alan olacak
    inlineContainer.innerHTML = '';
    inlineContainer.appendChild(panel);

    // Bulk panel için grup doldurma ve detay gösterme
    if (contentId === 'bulkMsgContent') {
      const sel = document.getElementById(`bulkGroupSelect-${instanceSafe}`);
      const showBtn = document.getElementById(`showGroupDetailsBtn-${instanceSafe}`);
      const numbersContainer = document.getElementById(`bulkNumbersContainer-${instanceSafe}`);
      const guide = document.getElementById(`bulkGuide-${instanceSafe}`);
      const detailsDiv = document.getElementById(`bulkGroupDetails-${instanceSafe}`);
      // ensure modal exists for group details
      let modalId = `bulkGroupDetailsModal-${instanceSafe}`;
      if (!document.getElementById(modalId)) {
        const modalWrap = document.createElement('div');
        modalWrap.className = 'modal fade';
        modalWrap.id = modalId;
        modalWrap.tabIndex = -1;
        modalWrap.innerHTML = `
          <div class="modal-dialog modal-lg">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Grup Üyeleri</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
              </div>
              <div class="modal-body" id="${modalId}-body">
                <div class="text-center py-2"><span class="spinner-border spinner-border-sm"></span> Yükleniyor...</div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(modalWrap);
      }
      if (sel) {
        fetchGroups().then(groups => {
          groups.forEach(g => {
            const opt = document.createElement('option');
            opt.value = g.id || g._id || g.groupId || g.name;
            opt.textContent = g.name || g.title || g.groupName || opt.value;
            sel.appendChild(opt);
          });
        });
        sel.addEventListener('change', () => {
          if (sel.value) {
            if (numbersContainer) numbersContainer.style.display = 'none';
            if (showBtn) showBtn.style.display = '';
            if (guide) guide.style.display = 'block';
          } else {
            if (numbersContainer) numbersContainer.style.display = '';
            if (showBtn) showBtn.style.display = 'none';
            if (guide) guide.style.display = 'none';
            if (detailsDiv) detailsDiv.style.display = 'none';
          }
        });
        showBtn?.addEventListener('click', async () => {
          const gid = sel.value; if (!gid) return;
          const modalBody = document.getElementById(`${modalId}-body`);
          if (modalBody) modalBody.innerHTML = '<div class="text-center py-2"><span class="spinner-border spinner-border-sm"></span> Yükleniyor...</div>';
          try {
            const members = await fetchGroupMembers(gid);
            if (!Array.isArray(members) || members.length === 0) { if (modalBody) modalBody.innerHTML = '<div class="alert alert-info">Bu grupta üye bulunamadı.</div>'; const bsModalEmpty = new bootstrap.Modal(document.getElementById(modalId)); bsModalEmpty.show(); return; }
            // Collect all keys present in any member object (include keys even if value is empty)
            const allKeys = new Set();
            members.forEach(m => {
              if (m && typeof m === 'object') {
                Object.keys(m).forEach(k => {
                  if (k) allKeys.add(k);
                });
              }
            });
            // Ensure common aliases and custom fields exist in preferred order
            const preferredOrder = [
              'id','name','fullName','firstName','firstname','surname','soyisim','soyad','lastName','lastname','phone','telefon','gsm',
              'city','gender',
              'birthDate','birth_date','doğumtarihi','membershipDate','membership_date','üyeliktarihi','lastOrderDate','last_order_date','sonsipariştarihi'
            ];
            // include custom fields up to the highest populated custom index across members
            let maxCustomIndex = 0;
            members.forEach(m => {
              if (m && typeof m === 'object') {
                Object.keys(m).forEach(k => {
                  const mm = String(k).match(/^custom_?(\d+)$/i);
                  if (mm && mm[1]) {
                    const idx = parseInt(mm[1], 10);
                    const val = m[k];
                    if (idx > 0 && val !== null && val !== undefined && String(val).trim() !== '') {
                      if (idx > maxCustomIndex) maxCustomIndex = idx;
                    }
                  }
                });
              }
            });
            for (let i = 1; i <= maxCustomIndex; i++) preferredOrder.push('custom' + i, 'custom_' + i);
            let keys = Array.from(allKeys);
            // Remove customN keys that exceed maxCustomIndex so we only show up to the group's max populated custom fields
            if (maxCustomIndex === 0) {
              keys = keys.filter(k => !/^custom_?\d+$/i.test(k));
            } else {
              keys = keys.filter(k => {
                const mm = String(k).match(/^custom_?(\d+)$/i);
                if (!mm) return true;
                const idx = parseInt(mm[1], 10);
                return idx <= maxCustomIndex;
              });
            }
            keys.sort((a,b) => {
              const aa = String(a);
              const bb = String(b);
              const ia = preferredOrder.indexOf(aa);
              const ib = preferredOrder.indexOf(bb);
              if (ia === -1 && ib === -1) return aa.localeCompare(bb);
              if (ia === -1) return 1;
              if (ib === -1) return -1;
              return ia - ib;
            });
            let html = '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr>';
            keys.forEach(k => html += `<th>${k}</th>`);
            html += '</tr></thead><tbody>';
            members.forEach(m => {
              html += '<tr>';
              keys.forEach(k => {
                let raw = (m && m[k] !== null && m[k] !== undefined) ? m[k] : '';
                let val = '';
                // handle arrays
                if (Array.isArray(raw)) {
                  val = raw.join(', ');
                } else if (raw && typeof raw === 'object') {
                  // If object has common display keys, prefer them
                  if (raw.name) val = raw.name;
                  else if (raw.fullName) val = raw.fullName;
                  else val = JSON.stringify(raw);
                } else {
                  val = raw;
                }
                // date formatting for known keys (case-insensitive)
                const lower = String(k).toLowerCase();
                if (['birthday','birthdate','birth_date','doğumtarihi'].includes(lower) || lower.includes('birth')) {
                  val = formatDateNoTZ(val);
                }
                if (['membershipdate','membership_date','üyeliktarihi'].includes(lower) || lower.includes('membership')) {
                  val = formatDateNoTZ(val);
                }
                if (['lastorderdate','last_order_date','sonsipariştarihi'].includes(lower) || lower.includes('order')) {
                  val = formatDateNoTZ(val);
                }
                // fallback stringify
                if (val === null || val === undefined) val = '';
                // escape HTML-ish characters
                const cell = String(val).toString();
                html += `<td>${cell}</td>`;
              });
              html += '</tr>';
            });
            html += '</tbody></table></div>';
            if (modalBody) modalBody.innerHTML = html;
            const bsModal = new bootstrap.Modal(document.getElementById(modalId));
            bsModal.show();
          } catch (err) { if (modalBody) modalBody.innerHTML = '<div class="alert alert-danger">Üyeler çekilemedi.</div>'; const bsModalErr = new bootstrap.Modal(document.getElementById(modalId)); bsModalErr.show(); }
        });
      }
    }

    // Multi panel için tag-selection setup
    if (contentId === 'multiMsgContent') {
      const wrapper = document.getElementById(`multiGroupSelectWrapper-${instanceSafe}`);
      if (wrapper) {
        wrapper._allGroupsCache = [];
        wrapper._selectedGroupIds = [];
        const resultsDiv = document.getElementById(`groupSearchResults-${instanceSafe}`);
        fetchGroups().then(groups => {
          wrapper._allGroupsCache = groups;
          updateGroupTagsInline('-' + instanceSafe);
          // Directly render groups into resultsDiv (bulk-like rendering) so they are visible
          if (!Array.isArray(groups) || groups.length === 0) {
            if (resultsDiv) resultsDiv.innerHTML = '<div class="text-muted text-center py-1">Grup bulunamadı veya erişim yetkiniz yok. Tarayıcı konsolunda daha fazla bilgi var.</div>';
            console.warn('fetchGroups returned empty or invalid:', groups);
            return;
          }
          if (resultsDiv) {
            resultsDiv.innerHTML = '';
            groups.forEach(g => {
              const item = document.createElement('button');
              item.type = 'button';
              item.className = 'list-group-item list-group-item-action';
              item.textContent = g.name || g.groupName || g.title || g.id;
              item.addEventListener('click', () => {
                const gid = g.id || g._id || g.groupId || g.name;
                wrapper._selectedGroupIds = wrapper._selectedGroupIds || [];
                if (!wrapper._selectedGroupIds.includes(gid)) wrapper._selectedGroupIds.push(gid);
                wrapper._selectedGroupIds = Array.from(new Set(wrapper._selectedGroupIds));
                updateGroupTagsInline('-' + instanceSafe);
                updateMembersFromGroupsInline('-' + instanceSafe);
                // refresh search results using current search input
                updateGroupSearchResultsInline((document.getElementById(`groupSearchInput-${instanceSafe}`)?.value) || '', '-' + instanceSafe);
              });
              resultsDiv.appendChild(item);
            });
          }
        }).catch(err => {
          if (resultsDiv) resultsDiv.innerHTML = '<div class="text-muted text-center py-1">Gruplar yüklenemedi.</div>';
          console.error('fetchGroups error', err);
        });

        const ginput = document.getElementById(`groupSearchInput-${instanceSafe}`);
        ginput?.addEventListener('input', (ev) => updateGroupSearchResultsInline(ev.target.value, '-' + instanceSafe));
      }
      const multiSearch = document.getElementById(`multiSearchInput-${instanceSafe}`);
      if (multiSearch) {
        multiSearch.addEventListener('input', async (ev) => {
          const v = ev.target.value.trim().toLowerCase();
          const membersListEl = document.getElementById(`multiMembersList-${instanceSafe}`);
          if (!membersListEl) return;
          if (!v) { await updateMembersFromGroupsInline('-' + instanceSafe); return; }
          membersListEl.innerHTML = '<div class="text-center py-2">Aranıyor...</div>';
          const wrapperEl = document.getElementById(`multiGroupSelectWrapper-${instanceSafe}`);
          if (!wrapperEl) return;
          if (!wrapperEl._allGroupsCache || wrapperEl._allGroupsCache.length === 0) wrapperEl._allGroupsCache = await fetchGroups();
          let allMembers = [];
          let seen = new Set();
          for (const g of (wrapperEl._allGroupsCache || [])) {
            const ms = await fetchGroupMembers(g.id || g._id || g.groupId || g.name);
            for (const m of ms) {
              const number = (m.phone || m.telefon || m.gsm || m.number || '').toString();
              const name = (m.name || m.isim || m.fullName || m.ad || '').toLowerCase();
              const surname = (m.soyad || m.soyisim || m.surname || '').toLowerCase();
              if (number && !seen.has(number) && (number.includes(v) || name.includes(v) || surname.includes(v))) { seen.add(number); allMembers.push(m); }
            }
          }
          membersListEl.innerHTML = '';
          if (allMembers.length === 0) { membersListEl.innerHTML = '<div class="text-muted text-center py-2">Kişi bulunamadı.</div>'; return; }
          allMembers.forEach(m => {
            const label = document.createElement('label');
            label.className = 'list-group-item d-flex align-items-center';
            const cb = document.createElement('input'); cb.type = 'checkbox'; cb.setAttribute('data-member','1'); cb.value = JSON.stringify(m);
            label.appendChild(cb); label.appendChild(document.createTextNode(' ' + (m.name || m.isim || m.fullName || m.ad || m.soyad || m.phone || m.telefon || m.gsm || m.number)));
            membersListEl.appendChild(label);
          });
        });
      }
    }

    // set active style for clicked button
    button.classList.add('active');
    button.classList.remove('btn-outline-success','btn-outline-warning','btn-outline-secondary');
    if (button.id === 'singleMsgBtn') button.classList.add('btn-primary');
    if (button.id === 'bulkMsgBtn') button.classList.add('btn-warning');
    if (button.id === 'multiMsgBtn') button.classList.add('btn-secondary');
  });
}

// Tekli mesaj gönderme içeriği (modaldan birebir alınan içerik)
const singleMessageContent = `
  <form id="singleMessageForm">
    <div class="mb-3">
      <label for="singleMsgNumber" class="form-label">Telefon Numarası</label>
      <input type="text" class="form-control" id="singleMsgNumber" placeholder="905xxxxxxxxx" required />
    </div>
    <div class="mb-3">
      <label for="singleMsgText" class="form-label">Mesaj <small class="text-muted">(Resim varsa opsiyonel)</small></label>
      <textarea class="form-control" id="singleMsgText" rows="3" placeholder="Mesajınızı yazın veya sadece resim gönderin..."></textarea>
    </div>
    <div class="mb-3">
      <label class="form-label">Resim Ekle (Opsiyonel - Çoklu seçilebilir)</label>
      <div class="input-group">
        <input type="file" class="form-control" id="singleMsgImage" accept="image/jpeg,image/png,image/gif,image/webp" multiple />
        <button type="button" class="btn btn-outline-danger" id="singleMsgImageClear" style="display:none;">Kaldır</button>
      </div>
      <div class="form-text">Max 5MB/resim, en fazla 10 resim - JPG, PNG, GIF, WEBP</div>
      <div id="singleMsgImagePreview" class="mt-2"></div>
    </div>
    <button type="submit" class="btn btn-success">Gönder</button>
  </form>
  <div id="singleMsgReport" class="mt-3 d-none">
    <div class="alert alert-info mb-2 py-2 px-3" id="singleMsgReportContent" style="font-size:0.97em;"></div>
  </div>
`;

// Toplu mesaj gönderme içeriği (modaldan birebir alınan içerik)
const bulkMessageContent = `
  <form id="bulkMessageForm">
    <div class="mb-3">
      <label for="bulkGroupSelect" class="form-label">Grup Seç (opsiyonel)</label>
      <select class="form-select" id="bulkGroupSelect">
        <option value="">-- Grup seçin --</option>
      </select>
    </div>
    <div id="bulkGuide" style="display:none;">
      <div class="alert alert-info mb-3" role="alert" style="font-size:0.97em;">
        <strong>Toplu Mesaj Modülü ile Göndereceğiniz Mesajlar, Belirlemiş Olduğunuz "Saatte Gönderilecek Mesaj Miktarı" Süresi Esas Alınarak Gönderilecektir.</strong><br>
        <strong>Kişisel Alanlar Kullanımı:</strong><br>
        Mesajınızda <code>%%alanAdi%%</code> formatında yazarsanız, gönderim sırasında her alıcıya ait bilgiler otomatik olarak yerine konur.<br>
        <strong>Örnek:</strong> <span style="white-space:pre;">"Merhaba %%isim%%, üyelik tarihiniz: %%üyeliktarihi%%"</span><br>
        <strong>Desteklenen alanlar:</strong> %%isim%%, %%soyisim%%, %%telefon%%, %%şehir%%, %%cinsiyet%%, %%doğumtarihi%%, %%üyeliktarihi%%, %%sonsipariştarihi%%,
        <br> <strong>Özel Alanlar:</strong> %%özelalan1%%, %%özelalan2%%, %%özelalan3%%, %%özelalan4%%, %%özelalan5%%, %%özelalan6%%, %%özelalan7%%, %%özelalan8%%, %%özelalan9%%, %%özelalan10%%, %%özelalan11%%, %%özelalan12%%, %%özelalan13%%
      </div>
    </div>
    <button type="button" class="btn btn-primary btn-sm w-100 mt-2" id="showGroupDetailsBtn" style="display:none;">Detayları Göster</button>
    <div class="mb-3" id="bulkGroupDetails" style="display:none;"></div>
    <div class="mb-3" id="bulkNumbersContainer">
      <label for="bulkNumbers" class="form-label">Numaralar (virgülle ayrılmış)</label>
      <input type="text" class="form-control" id="bulkNumbers" placeholder="905522334455,905511112233">
    </div>
    <div class="mb-3">
      <label for="bulkMessage" class="form-label">Mesaj <small class="text-muted">(Resim varsa opsiyonel)</small></label>
      <textarea class="form-control" id="bulkMessage" rows="3" placeholder="Mesajınızı yazın veya sadece resim gönderin..."></textarea>
    </div>
    <div class="mb-3">
      <label class="form-label">Resim Ekle (Opsiyonel - Çoklu seçilebilir)</label>
      <div class="input-group">
        <input type="file" class="form-control" id="bulkMsgImage" accept="image/jpeg,image/png,image/gif,image/webp" multiple />
        <button type="button" class="btn btn-outline-danger" id="bulkMsgImageClear" style="display:none;">Kaldır</button>
      </div>
      <div class="form-text">Max 5MB/resim, en fazla 10 resim - JPG, PNG, GIF, WEBP</div>
      <div id="bulkMsgImagePreview" class="mt-2"></div>
    </div>
    <button type="submit" class="btn btn-warning">Toplu Gönder</button>
  </form>
`;

// Çoklu mesaj gönderme içeriği (modaldan birebir alınan içerik)
const multiMessageContent = `
  <form id="multiMessageForm">
    <div class="mb-3">
      <label for="multiGroupSelect" class="form-label">Grup(lar) Seç</label>
      <div id="multiGroupSelectWrapper">
        <div class="mb-2">
          <input type="text" class="form-control form-control-sm" id="groupSearchInput" placeholder="Grup ara...">
        </div>
        <div class="list-group small" id="groupSearchResults" style="max-height:140px;overflow:auto;"></div>
        <div class="mt-2" id="groupSelectedTags"></div>
      </div>
      <div class="form-text">Birden fazla grup seçebilirsiniz. Arayarak ekleyin.</div>
    </div>
    <div class="mb-3">
      <label for="multiSearchInput" class="form-label">Kişi Ara (isim, soyisim, telefon)</label>
      <input type="text" class="form-control" id="multiSearchInput" placeholder="İsim, soyisim veya telefon ile ara...">
    </div>
    <div class="mb-3" style="max-height:220px;overflow:auto;">
      <div id="multiMembersList" class="list-group small border rounded" style="min-height:60px;"></div>
    </div>
    <div id="multiGuide" style="display:none;">
      <div class="alert alert-info mb-3" role="alert" style="font-size:0.97em;">
        <strong>Çoklu Mesaj Modülü ile seçtiğiniz kişilere mesaj gönderebilirsiniz.</strong><br>
        <strong>5 Kişiden daha az -> Direkt Gönderim. / 5 Kişi ve Fazlası -> Süreli (Toplu) Gönderim.</strong><br>
        <strong>Kişisel Alanlar Kullanımı:</strong><br>
        Mesajınızda <code>%%alanAdi%%</code> formatında yazarsanız, gönderim sırasında her alıcıya ait bilgiler otomatik olarak yerine konur.<br>
        <strong>Örnek:</strong> <span style="white-space:pre;">"Merhaba %%isim%%, üyelik tarihiniz: %%üyeliktarihi%%"</span><br>
        <strong>Desteklenen alanlar:</strong> %%isim%%, %%soyisim%%, %%telefon%%, %%şehir%%, %%cinsiyet%%, %%doğumtarihi%%, %%üyeliktarihi%%, %%sonsipariştarihi%%,
        <br> <strong>Özel Alanlar:</strong> %%özelalan1%%, %%özelalan2%%, %%özelalan3%%, %%özelalan4%%, %%özelalan5%%, %%özelalan6%%, %%özelalan7%%, %%özelalan8%%, %%özelalan9%%, %%özelalan10%%, %%özelalan11%%, %%özelalan12%%, %%özelalan13%%
      </div>
    </div>
    <div class="mb-3">
      <label for="multiMsgText" class="form-label">Mesaj <small class="text-muted">(Resim varsa opsiyonel)</small></label>
      <textarea class="form-control" id="multiMsgText" rows="3" placeholder="Mesajınızı yazın veya sadece resim gönderin..."></textarea>
    </div>
    <div class="mb-3">
      <label class="form-label">Resim Ekle (Opsiyonel - Çoklu seçilebilir)</label>
      <div class="input-group">
        <input type="file" class="form-control" id="multiMsgImage" accept="image/jpeg,image/png,image/gif,image/webp" multiple />
        <button type="button" class="btn btn-outline-danger" id="multiMsgImageClear" style="display:none;">Kaldır</button>
      </div>
      <div class="form-text">Max 5MB/resim, en fazla 10 resim - JPG, PNG, GIF, WEBP</div>
      <div id="multiMsgImagePreview" class="mt-2"></div>
    </div>
    <button type="submit" class="btn btn-secondary">Seçilen Kişilere Gönder</button>
  </form>
`;

// Tuşlara içerik ekleme
window.addEventListener('DOMContentLoaded', () => {
  toggleInlineContent('singleMsgBtn', 'singleMsgContent', singleMessageContent);
  toggleInlineContent('bulkMsgBtn', 'bulkMsgContent', bulkMessageContent);
  toggleInlineContent('multiMsgBtn', 'multiMsgContent', multiMessageContent);
});

// Delegated submit handlers for inline forms
document.addEventListener('submit', async (e) => {
  // Tekli (support instance-scoped ids like singleMessageForm-instance)
  if (e.target && (e.target.id === 'singleMessageForm' || e.target.id?.startsWith('singleMessageForm-'))) {
    e.preventDefault();
    const formId = e.target.id;
    const suffix = formId === 'singleMessageForm' ? '' : '-' + formId.split('-').slice(1).join('-');
    const number = document.getElementById(`singleMsgNumber${suffix}`)?.value?.trim();
    const message = document.getElementById(`singleMsgText${suffix}`)?.value?.trim();
    
    // Resim kontrolü - artık array
    const imageInputId = `singleMsgImage${suffix}`;
    const mediaBase64Array = selectedImages[imageInputId] || null;
    
    if (!number) { showPopupAlert('Numara gerekli.', 'danger'); return; }
    if (!message && !mediaBase64Array) { showPopupAlert('Mesaj veya resim gerekli.', 'danger'); return; }
    
    // Butonu disable et
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Gönderiliyor...';
    }
    
    try {
      const instanceName = await getFirstActiveInstanceName();
      
      // Resim varsa resimli endpoint, yoksa normal endpoint
      if (mediaBase64Array && mediaBase64Array.length > 0) {
        const res = await fetch('http://localhost:3001/api/messages/single-image', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName, number, caption: message || '', mediaBase64Array })
        });
        const data = await res.json();
        if (res.ok) { 
          showPopupAlert(`${mediaBase64Array.length} resimli mesaj gönderildi.`, 'success'); 
          e.target.reset(); 
          delete selectedImages[imageInputId];
          clearImagePreview(`singleMsgImagePreview${suffix}`);
          const clearBtn = document.getElementById(`singleMsgImageClear${suffix}`);
          if (clearBtn) clearBtn.style.display = 'none';
          await fetchTodaySentCount(); 
        }
        else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
      } else {
        const res = await fetch('http://localhost:3001/api/messages/single', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName, number, message })
        });
        const data = await res.json();
        if (res.ok) { showPopupAlert('Mesaj gönderildi.', 'success'); e.target.reset(); await fetchTodaySentCount(); }
        else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
      }
    } catch (err) { showPopupAlert('Sunucu hatası: ' + err.message, 'danger'); }
    finally {
      // Butonu tekrar aktif et
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }

  // Toplu (support instance-scoped ids like bulkMessageForm-instance)
  if (e.target && (e.target.id === 'bulkMessageForm' || e.target.id?.startsWith('bulkMessageForm-'))) {
    e.preventDefault();
    const formId = e.target.id;
    const suffix = formId === 'bulkMessageForm' ? '' : '-' + formId.split('-').slice(1).join('-');
    const groupId = document.getElementById(`bulkGroupSelect${suffix}`)?.value;
    const numbersRaw = document.getElementById(`bulkNumbers${suffix}`)?.value?.trim();
    const message = document.getElementById(`bulkMessage${suffix}`)?.value?.trim();
    const numbers = numbersRaw ? numbersRaw.split(',').map(n => n.trim()) : [];
    
    // Resim kontrolü - artık array
    const imageInputId = `bulkMsgImage${suffix}`;
    const mediaBase64Array = selectedImages[imageInputId] || null;
    
    if (!message && !mediaBase64Array) { showPopupAlert('Mesaj veya resim gerekli.', 'danger'); return; }
    if (!groupId && numbers.length === 0) { showPopupAlert('Lütfen grup seçin veya numara girin.', 'danger'); return; }
    
    // Butonu disable et
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Gönderiliyor...';
    }
    
    try {
      const instanceName = await getFirstActiveInstanceName();
      
      // Resim varsa resimli endpoint, yoksa normal endpoint
      if (mediaBase64Array && mediaBase64Array.length > 0) {
        const res = await fetch('http://localhost:3001/api/messages/bulk-image', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName, groupId, numbers, caption: message || '', mediaBase64Array, testMode: false })
        });
        const data = await res.json();
        if (res.ok) { 
          showPopupAlert(`Toplu resim gönderimi başlatıldı (${mediaBase64Array.length} resim).`, 'success'); 
          e.target.reset();
          delete selectedImages[imageInputId];
          clearImagePreview(`bulkMsgImagePreview${suffix}`);
          const clearBtn = document.getElementById(`bulkMsgImageClear${suffix}`);
          if (clearBtn) clearBtn.style.display = 'none';
        }
        else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
      } else {
        const res = await fetch('http://localhost:3001/api/messages/bulk', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName, groupId, numbers, message, testMode: false })
        });
        const data = await res.json();
        if (res.ok) { showPopupAlert('Toplu gönderim başlatıldı.', 'success'); e.target.reset(); }
        else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
      }
    } catch (err) { showPopupAlert('Sunucu hatası: ' + err.message, 'danger'); }
    finally {
      // Butonu tekrar aktif et
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }

  // Çoklu (support instance-scoped ids like multiMessageForm-instance)
  if (e.target && (e.target.id === 'multiMessageForm' || e.target.id?.startsWith('multiMessageForm-'))) {
    e.preventDefault();
    const formId = e.target.id;
    const suffix = formId === 'multiMessageForm' ? '' : '-' + formId.split('-').slice(1).join('-');
    const membersSelector = document.querySelectorAll(`#multiMembersList${suffix} input[type="checkbox"][data-member]:checked`);
    const checked = Array.from(membersSelector || []);
    const members = checked.map(cb => JSON.parse(cb.value));
    const message = document.getElementById(`multiMsgText${suffix}`)?.value?.trim();
    
    // Resim kontrolü - artık array
    const imageInputId = `multiMsgImage${suffix}`;
    const mediaBase64Array = selectedImages[imageInputId] || null;
    
    if (members.length === 0) { showPopupAlert('Lütfen en az bir kişi seçin.', 'warning'); return; }
    if (!message && !mediaBase64Array) { showPopupAlert('Mesaj veya resim gerekli.', 'danger'); return; }
    
    // Butonu disable et
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Gönderiliyor...';
    }
    
    try {
      const instanceName = await getFirstActiveInstanceName();
      
      // Resim varsa
      if (mediaBase64Array && mediaBase64Array.length > 0) {
        // 5+ kişi ise toplu resimli endpoint'e yönlendir
        if (members.length >= 5) {
          const numbers = members.map(m => (m.phone || m.telefon || m.gsm || m.number || '')).map(String).map(s => s.trim()).filter(Boolean);
          if (numbers.length === 0) { 
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
            showPopupAlert('Seçilen kişilerden telefon numarası alınamadı.', 'danger'); 
            return; 
          }
          showPopupAlert(`Seçilen ${numbers.length} kişi toplu resim gönderime yönlendiriliyor (${mediaBase64Array.length} resim).`, 'info');
          const res = await fetch('http://localhost:3001/api/messages/bulk-image', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName, groupId: null, numbers, caption: message || '', mediaBase64Array, testMode: false })
          });
          const data = await res.json();
          if (res.ok) { 
            showPopupAlert(`Toplu resim gönderimi başlatıldı (${mediaBase64Array.length} resim).`, 'success'); 
            e.target.reset();
            delete selectedImages[imageInputId];
            clearImagePreview(`multiMsgImagePreview${suffix}`);
            const clearBtn = document.getElementById(`multiMsgImageClear${suffix}`);
            if (clearBtn) clearBtn.style.display = 'none';
          }
          else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
          if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
          return;
        }
        
        // 5'ten az kişiye çoklu resim gönder
        const res = await fetch('http://localhost:3001/api/messages/multi-image', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceName, members, caption: message || '', mediaBase64Array })
        });
        const data = await res.json();
        if (res.ok) { 
          showPopupAlert((data.success ? data.success + ' kişiye ' + mediaBase64Array.length + ' resim gönderildi.' : 'Resimler gönderildi.'), 'success'); 
          e.target.reset();
          delete selectedImages[imageInputId];
          clearImagePreview(`multiMsgImagePreview${suffix}`);
          const clearBtn = document.getElementById(`multiMsgImageClear${suffix}`);
          if (clearBtn) clearBtn.style.display = 'none';
        }
        else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
        return;
      }
      
      // Resim yoksa normal metin akışı
      // If selected recipients are 5 or more, route to the bulk sender which handles paced sending
      if (members.length >= 5) {
        // extract numbers from member objects
        const numbers = members.map(m => (m.phone || m.telefon || m.gsm || m.number || '') ).map(String).map(s => s.trim()).filter(Boolean);
        if (numbers.length === 0) { 
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
            showPopupAlert('Seçilen kişilerden telefon numarası alınamadı.', 'danger'); 
            return; 
          }
        showPopupAlert(`Seçilen ${numbers.length} kişi toplu göndermeye yönlendiriliyor. Gönderimler aralıklı yapılacaktır.`, 'info');
        try {
          const res = await fetch('http://localhost:3001/api/messages/bulk', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceName, groupId: null, numbers, message, testMode: false })
          });
          const data = await res.json();
          if (res.ok) { showPopupAlert('Toplu gönderim başlatıldı. İşlem arka planda devam edecektir.', 'success'); e.target.reset(); }
          else { showPopupAlert('Toplu gönderim hatası: ' + (data.error || data.message), 'danger'); }
        } catch (err) { showPopupAlert('Toplu gönderim sunucu hatası: ' + err.message, 'danger'); }
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
        return;
      }

      // fewer than 5 recipients: use direct multi endpoint for immediate send
      const res = await fetch('http://localhost:3001/api/messages/multi', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('user_token') || sessionStorage.getItem('token')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceName, members, message })
      });
      const data = await res.json();
      if (res.ok) { showPopupAlert((data.success ? data.success + ' kişiye gönderildi.' : 'Gönderildi.'), 'success'); e.target.reset(); }
      else { showPopupAlert('Gönderim hatası: ' + (data.error || data.message), 'danger'); }
    } catch (err) { showPopupAlert('Sunucu hatası: ' + err.message, 'danger'); }
    finally {
      // Butonu tekrar aktif et
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  }
});

// Helper: ilk aktif instance'ın adını döndürür
async function getFirstActiveInstanceName() {
  try {
    const res = await fetch(`${apiBaseUrl}/instance/fetchInstances`, {
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey }
    });
    if (!res.ok) return null;
    const instances = await res.json();
    if (!Array.isArray(instances)) return null;
    const inst = instances.find(i => (i.token === apiKey || i.apikey === apiKey) && i.connectionStatus === 'open');
    if (!inst) return null;
    return inst.name || inst.instanceName || inst.id || null;
  } catch (err) {
    console.error('getFirstActiveInstanceName hata:', err);
    return null;
  }
}



// --- Inline multi-group helper functions (tag select, search, members render) ---
function updateGroupSearchResultsInline(query, suffix = '') {
  const resultsDiv = document.getElementById(`groupSearchResults${suffix}`) || document.getElementById('groupSearchResults_inline');
  const wrapper = document.getElementById(`multiGroupSelectWrapper${suffix}`) || document.getElementById('multiGroupSelectWrapper');
  if (!resultsDiv || !wrapper) return;
  const all = wrapper._allGroupsCache || [];
  const selected = wrapper._selectedGroupIds || [];
  const filtered = all.filter(g => {
    const gid = String(g.id || g._id || g.groupId || g.name || '');
    const name = (g.name || g.groupName || g.title || g.id || '').toLowerCase();
    return !selected.map(String).includes(gid) && name.includes((query||'').toLowerCase());
  });
  resultsDiv.innerHTML = '';
  if (filtered.length === 0) {
    resultsDiv.innerHTML = '<div class="text-muted text-center py-1">Grup bulunamadı</div>';
    return;
  }
    filtered.forEach(g => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'list-group-item list-group-item-action';
      item.textContent = g.name || g.groupName || g.title || g.id;
      item.addEventListener('click', () => {
        wrapper._selectedGroupIds = wrapper._selectedGroupIds || [];
        const gid = String(g.id || g._id || g.groupId || g.name || '');
        if (!wrapper._selectedGroupIds.map(String).includes(gid)) wrapper._selectedGroupIds.push(gid);
        // normalize unique
        wrapper._selectedGroupIds = Array.from(new Set(wrapper._selectedGroupIds.map(String)));
        updateGroupTagsInline(suffix);
        updateMembersFromGroupsInline(suffix);
        updateGroupSearchResultsInline((document.getElementById(`groupSearchInput${suffix}`)?.value) || '', suffix);
      });
      resultsDiv.appendChild(item);
    });
}

function updateGroupTagsInline(suffix = '') {
  const tagDiv = document.getElementById(`groupSelectedTags${suffix}`) || document.getElementById('groupSelectedTags_inline');
  const wrapper = document.getElementById(`multiGroupSelectWrapper${suffix}`) || document.getElementById('multiGroupSelectWrapper');
  if (!tagDiv || !wrapper) return;
  tagDiv.innerHTML = '';
  const selected = wrapper._selectedGroupIds || [];
  selected.forEach(id => {
  const group = (wrapper._allGroupsCache||[]).find(g => String(g.id||g._id||g.groupId||g.name) == String(id));
    if (!group) return;
    const tag = document.createElement('span');
    tag.className = 'badge bg-primary me-1 mb-1';
    tag.textContent = group.name || group.groupName || group.title || id;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-close btn-close-white btn-sm ms-1';
    removeBtn.style.fontSize = '0.7em';
    removeBtn.onclick = () => {
      wrapper._selectedGroupIds = (wrapper._selectedGroupIds || []).filter(gid => String(gid) !== String(id));
      updateGroupTagsInline(suffix);
      updateMembersFromGroupsInline(suffix);
      // re-populate search results so the removed group appears again
      updateGroupSearchResultsInline((document.getElementById(`groupSearchInput${suffix}`)?.value) || '', suffix);
    };
    tag.appendChild(removeBtn);
    tagDiv.appendChild(tag);
  });
}

async function updateMembersFromGroupsInline(suffix = '') {
  const wrapper = document.getElementById(`multiGroupSelectWrapper${suffix}`) || document.getElementById('multiGroupSelectWrapper');
  const membersList = document.getElementById(`multiMembersList${suffix}`) || document.getElementById('multiMembersList');
  if (!wrapper || !membersList) return;
  const selected = wrapper._selectedGroupIds || [];
  membersList.innerHTML = '<div class="text-center py-2">Yükleniyor...</div>';
  let allMembers = [];
  const seen = new Set();
  for (const gid of selected) {
    try {
      const ms = await fetchGroupMembers(gid);
      for (const m of ms) {
        const number = (m.phone || m.telefon || m.gsm || m.number || '').toString();
        if (number && !seen.has(number)) { seen.add(number); allMembers.push(m); }
      }
    } catch (err) { /* ignore group fetch error per-group */ }
  }
  membersList.innerHTML = '';
  if (allMembers.length === 0) { membersList.innerHTML = '<div class="text-muted text-center py-2">Kişi bulunamadı.</div>'; return; }
  allMembers.forEach(m => {
    const label = document.createElement('label');
    label.className = 'list-group-item d-flex align-items-center';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.setAttribute('data-member','1'); cb.value = JSON.stringify(m);
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + (m.name || m.isim || m.fullName || m.ad || m.soyad || m.phone || m.telefon || m.gsm || m.number)));
    membersList.appendChild(label);
  });
}

// Listen for inline group search input
document.addEventListener('input', (e) => {
  if (!e.target) return;
  const id = e.target.id || '';
  if (id === 'groupSearchInput_inline') {
    updateGroupSearchResultsInline(e.target.value);
    return;
  }
  // instance-scoped input: groupSearchInput-<instance>
  const m = id.match(/^groupSearchInput-(.+)$/);
  if (m) {
    const suffix = '-' + m[1];
    updateGroupSearchResultsInline(e.target.value, suffix);
  }
});

// Yeni: butonlara tekil seçim ve inline sekme açma (modal içeriğini birebir yerleştirir)
function setupInlineMessagePanels(instance) {
  // Button selector: butonlar instance kartında oluşturulmuş olanlar
  const btns = Array.from(document.querySelectorAll(`#instancesContainer button[data-instance-id='${instance.id}']`));
  // Eğer butonlar yoksa, instance card'ına ekle ve butonlara data attributes ver
}

// Helper: başka bir sekme açıksa kapat ve buton active durumlarını yönet
function openOnlyThis(contentId, button) {
  document.querySelectorAll('.inline-panel').forEach(panel => {
    if (panel.id !== contentId) panel.remove();
  });
  document.querySelectorAll('.panel-toggle-btn').forEach(b => {
    if (b !== button) b.classList.remove('active');
  });
}

// Mevcut addMessageFeaturesToInstance içinde butonlar oluşturulduğu yerde artık data-instance-id ve panel-ids kullanılacak

// Çoklu mesaj kişi seçildiğinde guide göster/gizle
document.addEventListener('change', (e) => {
  // multiMembersList içindeki checkbox'ları dinle
  if (e.target && e.target.type === 'checkbox' && e.target.hasAttribute('data-member')) {
    // En yakın multiMembersList'i bul
    const membersList = e.target.closest('[id^="multiMembersList"]');
    if (!membersList) return;
    
    // Suffix'i çıkar
    const listId = membersList.id;
    const suffix = listId.replace('multiMembersList', '');
    
    // Guide element'ini bul
    const guide = document.getElementById(`multiGuide${suffix}`);
    if (!guide) return;
    
    // Seçili checkbox sayısını kontrol et
    const checkedCount = membersList.querySelectorAll('input[type="checkbox"][data-member]:checked').length;
    
    // En az bir kişi seçiliyse guide'ı göster
    guide.style.display = checkedCount > 0 ? 'block' : 'none';
  }
});

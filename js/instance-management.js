// instance-management.js
// Instance yönetimi ile ilgili tüm fonksiyonlar

const evoApiBaseUrl = "http://localhost:8080"; // Evolution API
const apiBaseUrl = "http://localhost:8080"; // mesaj ve instance işlemleri için
const apiKey = sessionStorage.getItem('user_token') || sessionStorage.getItem('token') || '';

// Evolution API bağlantı testi
async function testConnection() {
  const banner = document.getElementById('apiStatusBanner');
  try {
    const res = await fetch(`${apiBaseUrl}/`, {
      headers: {
        "apikey": apiKey
      }
    });
    const data = await res.json();
    banner.classList.remove('d-none', 'alert-danger');
    banner.classList.add('alert-success');
    banner.innerText = `✅ Evolution API çalışıyor! Versiyon: ${data.version}`;
  } catch (err) {
    banner.classList.remove('d-none', 'alert-success');
    banner.classList.add('alert-danger');
    banner.innerText = '❌ Evolution API bağlantısı başarısız!';
    console.error(err);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  testConnection();
  // Mesaj limiti select ve butonunu başlat
  fetchMessageLimit();
  const saveBtn = document.getElementById("saveMessageLimitBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => updateMessageLimit());
  }
});

// Giriş kontrolü ve logout işlemi
document.addEventListener('DOMContentLoaded', () => {
  const token = sessionStorage.getItem('token');
  if (!token || !apiKey) {
    return;
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  // Clear only session auth data
  sessionStorage.removeItem('user');
  sessionStorage.removeItem('user_token');
  sessionStorage.removeItem('token');
  window.location.href = "main.html"; // Ana sayfaya yönlendir
    });
  }

  testConnection();
  fetchInstances();
});

// Instance kartı altında geçici alert gösterme fonksiyonu
function showInstanceAlert(div, message, type = 'info') {
  // Deprecated: Use showPopupAlert instead.
  // This function is left for compatibility, but not used for instance actions anymore.
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show mt-2`;
  alert.role = 'alert';
  alert.innerText = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-close';
  closeBtn.setAttribute('data-bs-dismiss', 'alert');
  closeBtn.setAttribute('aria-label', 'Close');
  alert.appendChild(closeBtn);
  div.appendChild(alert);

  setTimeout(() => {
    alert.classList.remove('show');
    setTimeout(() => alert.remove(), 1000);
  }, 10000);
}

// Instance listesini çekme ve ekrana basma
async function fetchInstances() {
  const refreshBtn = document.getElementById('refreshButton');
  let container = null;
  try {
    const res = await fetch(`${apiBaseUrl}/instance/fetchInstances`, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      }
    });
    const json = await res.json();
    if (json?.response?.message === "Unauthorized") {
      console.error("Beklenmeyen yanıt:", json);
      const refreshStatus = document.getElementById('refreshStatus');
      if (refreshStatus) {
        refreshStatus.innerHTML = '❌';
        setTimeout(() => refreshStatus.innerHTML = '', 3000);
      }
      const container = document.getElementById('instanceList');
      if (container) container.innerHTML = '<div class="alert alert-warning">Instance verisi alınamadı veya bulunamadı.</div>';
      return;
    }
    const instances = json;
    if (!Array.isArray(instances)) {
      console.error("Beklenmeyen yanıt:", instances);
      const refreshStatus = document.getElementById('refreshStatus');
      if (refreshStatus) {
        refreshStatus.innerHTML = '❌';
        setTimeout(() => refreshStatus.innerHTML = '', 3000);
      }
      const container = document.getElementById('instanceList');
      if (container) container.innerHTML = '<div class="alert alert-warning">Instance verisi alınamadı.</div>';
      return;
    }
    const filteredInstances = instances.filter(inst => inst.token === apiKey);

    container = document.getElementById('instanceList');
    if (Array.isArray(filteredInstances) && filteredInstances.length > 0) {
      container.innerHTML = '';
      const refreshStatus = document.getElementById('refreshStatus');
      refreshStatus.innerHTML = '✅';
      setTimeout(() => refreshStatus.innerHTML = '', 3000);
      console.log("Fetched instances:", filteredInstances);
      filteredInstances.forEach(instance => {
        const div = document.createElement('div');
        div.className = 'card mb-3 p-3';
        div.setAttribute('data-inst', instance.name);
        div.innerHTML = `
  <div class="d-flex align-items-center mb-2">
    <img src="${instance.profilePicUrl || 'img/default-avatar.png'}" alt="Profile" class="rounded-circle me-3" width="50" height="50" onerror="this.onerror=null; this.src='img/default-avatar.png';">
    <div>
      <h5 class="mb-0">${instance.profileName || instance.name || 'İsimsiz Instance'}</h5>
      <div class="text-muted">Status: ${instance.connectionStatus || 'Unknown'}</div>
      <div class="text-muted">Owner: ${instance.ownerJid || 'Yok'}</div>
    </div>
  </div>
  <div class="ms-5">
    <div><strong>Instance ID:</strong> ${instance.id}</div>
    <div><strong>Instance Name:</strong> ${instance.name || 'Belirtilmemiş'}</div>
    <div>
      <strong>Token:</strong>
      <span class="token-blur" style="filter: blur(5px);" id="token-${instance.id}">${instance.token}</span>
      <button class="btn btn-sm btn-outline-secondary ms-2" onclick="toggleTokenVisibility('${instance.id}')">Göster</button>
    </div>
    <div class="mt-2">
  <span class="instance-count-info"><strong>Message Count:</strong> ${instance._count?.Message ?? 0}<br>
  <strong>Contact Count:</strong> ${instance._count?.Contact ?? 0}<br>
  <strong>Chat Count:</strong> ${instance._count?.Chat ?? 0}</span>
    </div>
  </div>
`;
        container.appendChild(div);
        const actionButtonsDiv = document.createElement('div');
        actionButtonsDiv.className = 'mt-3';
        actionButtonsDiv.innerHTML = `
            <button class="btn btn-danger btn-sm me-2" onclick="deleteInstance('${instance.name}')">Sil</button>
            <button class="btn btn-warning btn-sm me-2" onclick="disconnectInstance('${instance.name}')">Bağlantıyı Kes</button>
            <button class="btn btn-info btn-sm me-2" onclick="restartInstance('${instance.name}')">Yeniden Başlat</button>
            <button class="btn btn-secondary btn-sm" onclick="refreshInstance('${instance.name}')">Yenile</button>
          `;
        div.appendChild(actionButtonsDiv);

        // QR ve mesaj modal/butonları
        const qrDiv = document.createElement('div');
        qrDiv.className = 'mt-3';

        // QR kodu modalı ve butonu (eğer bağlantı açık değilse)
        if (instance.connectionStatus !== 'open') {
          const modal = document.createElement('div');
          modal.className = 'modal fade';
          modal.id = `qrModal-${instance.id}`;
          modal.tabIndex = -1;
          modal.innerHTML = `
  <div class="modal-dialog modal-dialog-end">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">QR Kodu - ${instance.name}</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Kapat"></button>
      </div>
      <div class="modal-body">
        <div id="qrContainer-${instance.id}" class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Yükleniyor...</span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
          document.body.appendChild(modal);
          modal.addEventListener('show.bs.modal', async () => {
            const qrContainer = document.getElementById(`qrContainer-${instance.id}`);
            qrContainer.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Yükleniyor...</span></div>';
            try {
              const response = await fetch(`${apiBaseUrl}/instance/connect/${instance.name}`, {
                method: 'GET',
                headers: {
                  'apikey': apiKey
                }
              });
              const json = await response.json();
              console.log("QR yanıtı:", json);

              if (json.base64 && json.base64.startsWith("data:image")) {
                qrContainer.innerHTML = `<img src="${json.base64}" alt="QR Kod" style="max-width:100%; border:1px solid #ccc; padding:10px;">`;
              } else if (json.qr && json.qr.length > 100) {
                qrContainer.innerHTML = `<img src="data:image/png;base64,${json.qr}" alt="QR Kod" style="max-width:100%; border:1px solid #ccc; padding:10px;">`;
              } else {
                qrContainer.innerHTML = '<div class="alert alert-warning">QR kodu alınamadı.</div>';
              }
            } catch (err) {
              console.error("QR kodu yüklenirken hata oluştu:", err);
              qrContainer.innerHTML = '<div class="alert alert-danger">QR kodu yüklenirken hata oluştu.</div>';
            }
          });
          const modalBtn = document.createElement('button');
          modalBtn.className = 'btn btn-outline-primary btn-sm';
          modalBtn.textContent = 'QR Kodu Göster';
          modalBtn.setAttribute('data-bs-toggle', 'modal');
          modalBtn.setAttribute('data-bs-target', `#qrModal-${instance.id}`);
          qrDiv.appendChild(modalBtn);
        }

        div.appendChild(qrDiv);
      });
    } else {
      container.innerHTML = 'Hiçbir instance bulunamadı.';
    }
  } catch (error) {
    console.error("Instance çekme hatası:", error);
    const refreshStatus = document.getElementById('refreshStatus');
    refreshStatus.innerHTML = '❌';
    setTimeout(() => refreshStatus.innerHTML = '', 3000);
  }
}

// Token göster/gizle
function toggleTokenVisibility(instanceId) {
  const span = document.getElementById(`token-${instanceId}`);
  if (!span) return;
  if (span.style.filter === 'none') {
    span.style.filter = 'blur(5px)';
  } else {
    span.style.filter = 'none';
  }
}

// Instance oluşturma formu
document.getElementById('createInstanceForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('instanceName').value.trim();
  const token = apiKey;

  const createBtn = document.querySelector('#createInstanceForm button[type="submit"]');
  createBtn.disabled = true;
  const spinner = document.createElement('span');
  spinner.className = 'spinner-border spinner-border-sm ms-2';
  createBtn.appendChild(spinner);

  if (!name) {
    showPopupAlert('❌ Instance adı gerekli.', 'danger');
    if (spinner) spinner.remove();
    createBtn.disabled = false;
    return;
  }

  try {
    // Check if user already has an instance
    const fetchRes = await fetch(`${apiBaseUrl}/instance/fetchInstances`, {
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey
      }
    });
    const existingInstances = await fetchRes.json();
    // Filter to current user's instances (by token)
    const filteredInstances = Array.isArray(existingInstances)
      ? existingInstances.filter(inst => inst.token === apiKey)
      : [];
    if (Array.isArray(filteredInstances) && filteredInstances.length >= 1) {
      showPopupAlert("❌ Zaten bir instance oluşturmuşsunuz. Sadece bir instance'a izin verilmektedir.", 'danger');
      if (spinner) spinner.remove();
      createBtn.disabled = false;
      return;
    }

    const res = await fetch(`${apiBaseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        instanceName: name,
        integration: "WHATSAPP-BAILEYS",
        token: String(token),
        qrcode: true
      })
    });

    const data = await res.json();
    if (res.ok) {
      showPopupAlert('✅ Instance başarıyla oluşturuldu.', 'success');
      fetchInstances();
    } else {
      showPopupAlert('❌ Oluşturma başarısız: ' + (data?.response?.message?.[0] || data?.error || 'Bilinmeyen hata'), 'danger');
    }
  } catch (err) {
    showPopupAlert('❌ Sunucu hatası: ' + err.message, 'danger');
  } finally {
    if (spinner) spinner.remove();
    createBtn.disabled = false;
  }
});

// Instance silme
async function deleteInstance(name) {
  if (!confirm(`${name} adlı instance silinsin mi?`)) return;
  const instCard = document.querySelector(`[data-inst="${name}"]`);
  try {
    const res = await fetch(`${apiBaseUrl}/instance/delete/${name}`, {
      method: 'DELETE',
      headers: { 'apikey': apiKey }
    });
    const data = await res.json();
    showPopupAlert(data.message || 'Instance silindi.', 'success');
    fetchInstances();
  } catch (err) {
    showInstanceAlert(instCard, 'Silme işlemi başarısız: ' + err.message, 'danger');
  }
}

// Instance bağlantı kesme
async function disconnectInstance(name) {
  const instCard = document.querySelector(`[data-inst="${name}"]`);
  try {
    const res = await fetch(`${apiBaseUrl}/instance/logout/${name}`, {
      method: 'DELETE',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    const json = await res.json();
    showPopupAlert(json.message || 'Bağlantı kesildi.', 'success');
    fetchInstances();
  } catch (err) {
    showInstanceAlert(instCard, 'Bağlantı kesme başarısız: ' + err.message, 'danger');
  }
}

// Instance yeniden başlatma
async function restartInstance(name) {
  const instCard = document.querySelector(`[data-inst="${name}"]`);
  try {
    const res = await fetch(`${apiBaseUrl}/instance/restart/${name}`, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });
    const json = await res.json();
    showPopupAlert(json.message || 'Instance yeniden başlatıldı.', 'success');
    fetchInstances();
  } catch (err) {
    showInstanceAlert(instCard, 'Yeniden başlatma başarısız: ' + err.message, 'danger');
  }
}

// Instance bağlantı durumunu yenileme
async function refreshInstance(name) {
  const instCard = document.querySelector(`[data-inst="${name}"]`);
  try {
    const res = await fetch(`${apiBaseUrl}/instance/connectionState/${name}`, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });
    const data = await res.json();
    showPopupAlert(data.message || 'Bağlantı durumu güncellendi.', 'info');
    fetchInstances();
  } catch (err) {
    showInstanceAlert(instCard, 'Yenileme başarısız: ' + err.message, 'danger');
  }
}

// --- Mesaj Limiti Fonksiyonları (settings.js'den aktarıldı) ---

/**
 * Kullanıcının mevcut mesaj limitini getirir ve bir select elementini doldurur.
 * @param {string} selectId - Select elementinin id'si
 */
async function fetchMessageLimit(selectId = "messageLimitSelect") {
  try {
    const resp = await fetch("http://localhost:3001/api/user/message-limit", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
  "Authorization": "Bearer " + (sessionStorage.getItem("token") || sessionStorage.getItem("user_token"))
      }
    });
    if (!resp.ok) throw new Error("Mesaj limiti alınamadı");
    const data = await resp.json();
    let messageLimit = data.message_limit !== undefined ? data.message_limit : "";
    // localStorage'da varsa onu kullan
  const storedLimit = sessionStorage.getItem('last_message_limit');
    if (storedLimit) messageLimit = storedLimit;
    const select = document.getElementById(selectId);
    if (select) {
      const limits = [2, 3, 4, 5, 6, 10, 12, 15, 20, 30];
      select.innerHTML = "";
      limits.forEach(lim => {
        const opt = document.createElement("option");
        opt.value = lim;
        opt.text = lim;
        if (parseInt(messageLimit, 10) === lim) opt.selected = true;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    alert("Mesaj limiti alınırken hata: " + (e.message || e));
  }
}

/**
 * Kullanıcının mesaj limitini günceller.
 * @param {string} selectId - Select elementinin id'si
 */
async function updateMessageLimit(selectId = "messageLimitSelect") {
  try {
    const select = document.getElementById(selectId);
    if (!select) throw new Error("Mesaj limiti seçici bulunamadı");
    const messageRateLimit = parseInt(select.value, 10);
    // Seçilen limiti localStorage'a kaydet
    localStorage.setItem('last_message_limit', messageRateLimit);
    const resp = await fetch("http://localhost:3001/api/user/message-limit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
  "Authorization": "Bearer " + (sessionStorage.getItem("token") || sessionStorage.getItem("user_token"))
      },
      body: JSON.stringify({ messageRateLimit }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.message || "Mesaj limiti güncellenemedi");
    alert("Mesaj limiti başarıyla güncellendi.");
  } catch (e) {
    alert("Mesaj limiti güncellenirken hata: " + (e.message || e));
  }
}
// --- Mesaj Limiti Fonksiyonları Sonu ---

// Popup alert fonksiyonları
function showPopupAlert(message, type = 'info') {
  const popup = document.getElementById('popupAlert');
  const msgBox = document.getElementById('popupAlertMessage');

  popup.style.display = 'none';
  popup.className = `toast align-items-center text-bg-${type} border-0 position-fixed bottom-0 end-0 m-3`;
  msgBox.innerText = message;
  popup.style.display = 'block';

  setTimeout(() => {
    hidePopupAlert();
  }, 4000);
}

function hidePopupAlert() {
  const popup = document.getElementById('popupAlert');
  popup.style.display = 'none';
}
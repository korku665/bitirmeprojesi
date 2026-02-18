const apiBaseUrl = "http://localhost:3001/api";
const statsContainer = document.getElementById("dashboardStats");
const chartCanvas = document.getElementById("last7DaysChart");

async function fetchDashboardStats() {
  try {
    const token = sessionStorage.getItem("token") || sessionStorage.getItem("user_token");
    const res = await fetch(`${apiBaseUrl}/reports/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("API isteği başarısız");
    const data = await res.json();
    renderStats(data);
    renderChart(data.last7_days || []);
  } catch (err) {
    if (statsContainer) statsContainer.innerHTML = `<div class='alert alert-danger'>Dashboard verileri alınamadı.</div>`;
    if (chartCanvas) chartCanvas.style.display = 'none';
  }
}

function renderStats(data) {
  if (!statsContainer) return;
  let biggestGroup = '<div>-</div>';
  if (data.biggest_group) {
    const name = data.biggest_group.name || '-';
    const count = typeof data.biggest_group.member_count === 'number' ? data.biggest_group.member_count : '-';
    biggestGroup = `<div><b>${name}</b> (${count} üye)</div>`;
  }
// chart.umd.min.js.map hatası sadece source map dosyası eksik olduğu için oluşur ve uygulamayı etkilemez. Bunu gizlemek için tarayıcıda source map'leri devre dışı bırakabilirsiniz.
  statsContainer.innerHTML = `
    <div class="col-md-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Toplam Grup</h5>
          <p class="card-text fs-3">${data.group_count ?? '-'}</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Gruplardaki Toplam Kişi</h5>
          <p class="card-text fs-3">${data.total_members ?? '-'}</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Gruplardaki Benzersiz Kişi</h5>
          <p class="card-text fs-3">${data.unique_members ?? '-'}</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Toplam Mesaj</h5>
          <p class="card-text fs-3">${data.total_messages ?? '-'}</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Toplam Rapor</h5>
          <p class="card-text fs-3">${data.total_reports ?? '-'}</p>
        </div>
      </div>
    </div>
    <div class="col-md-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Başarılı / Başarısız Mesaj</h5>
          <p class="card-text fs-5">${data.sent_messages ?? 0} / ${data.failed_messages ?? 0}</p>
        </div>
      </div>
    </div>
    <div class="col-md-6">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">En Büyük Grup</h5>
          <p class="card-text">${biggestGroup}</p>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Saat Başına Mesaj Limiti</h5>
          <p class="card-text fs-3">${data.message_rate_limit ?? '-'}</p>
        </div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card shadow-sm">
        <div class="card-body">
          <h5 class="card-title">Bugün Gönderilen</h5>
          <p class="card-text fs-3">${data.sent_today ?? '-'}</p>
        </div>
      </div>
    </div>
  `;
}

function renderChart(days) {
  if (!chartCanvas) return;
  // Türkçe gün isimleri
  const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const labels = days.map(d => {
    const dateObj = new Date(d.day);
    const gun = gunler[dateObj.getDay()];
    const gg = String(dateObj.getDate()).padStart(2, '0');
    const aa = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${gg}.${aa}.${yyyy} - ${gun}`;
  }).reverse();
  const data = days.map(d => d.sent_count).reverse();
  new Chart(chartCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Gönderilen Mesaj',
        data,
        fill: true,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.1)',
        tension: 0.3,
        pointBackgroundColor: '#0d6efd',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

document.addEventListener("DOMContentLoaded", fetchDashboardStats);

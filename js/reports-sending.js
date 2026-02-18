const apiBaseUrl = "http://localhost:3001/api";
const tableBody = document.querySelector("#reportsTableBody");
const paginationContainer = document.querySelector("#pagination");

let currentPage = 1;
const limit = 25;

async function fetchReports(page = 1) {
  try {
  const token = sessionStorage.getItem("token") || sessionStorage.getItem('user_token');
    const res = await fetch(`${apiBaseUrl}/reports/sent?page=${page}&limit=${limit}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error("API isteği başarısız");

    const data = await res.json();
    const reports = Array.isArray(data?.data) ? data.data : [];
    const totalPages = typeof data?.totalPages === "number" ? data.totalPages : 1;

    if (reports.length === 0) {
      tableBody.innerHTML = `
        <tr class="reports-empty-row">
          <td colspan="8" class="reports-empty-cell">
            <div class="reports-empty-content">
              <i class="bi bi-clipboard-x" style="font-size:2.5rem; margin-bottom: 0.5rem;"></i>
              Henüz gönderim raporu yok
            </div>
          </td>
        </tr>
      `;
      paginationContainer.innerHTML = "";
      return;
    }

    renderTable(reports);
    renderPagination(totalPages, page);
  } catch (err) {
    console.error("❌ Raporları alırken hata:", err);
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Raporlar alınamadı</td></tr>`;
    paginationContainer.innerHTML = "";
  }
}

function renderTable(reports) {
  if (!tableBody) return;
  tableBody.innerHTML = "";

  reports.forEach((report, index) => {
    const tr = document.createElement("tr");

    const sendDateFormatted = report.send_date || "-";
    const sendTimeFormatted = report.send_time || "-";
    const sendEndTimeFormatted = report.send_end_time || "-";

    tr.innerHTML = `
      <td>${(currentPage - 1) * limit + index + 1}</td>
      <td>${sendDateFormatted}</td>
      <td>${report.sending_type || '-'}</td>
      <td>${sendTimeFormatted}</td>
      <td>${sendEndTimeFormatted}</td>
      <td>
        <span class="report-link text-primary fw-bold" style="cursor:pointer;" data-type="recipients" data-id="${report.id || ""}">
          ${typeof report?.total_recipients === "number" ? report.total_recipients : 0}
        </span>
      </td>
      <td>
        <span class="report-link text-success fw-bold" style="cursor:pointer;" data-type="delivered" data-id="${report.id || ""}">
          ${typeof report?.delivered_count === "number" ? report.delivered_count : 0}
        </span>
      </td>
      <td>
        <span class="report-link text-danger fw-bold" style="cursor:pointer;" data-type="failed" data-id="${report.id || ""}">
          ${typeof report?.failed_count === "number" ? report.failed_count : 0}
        </span>
      </td>
    `;

    tableBody.appendChild(tr);
  });
}

function renderPagination(totalPages, page) {
  if (!paginationContainer) return;
  paginationContainer.innerHTML = "";
  if (typeof totalPages !== "number" || totalPages < 1) return;

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.className = `btn btn-sm ${i === page ? "btn-primary" : "btn-outline-primary"} mx-1`;
    btn.textContent = i;
    btn.disabled = i === page;
    btn.addEventListener("click", () => {
      if (i !== currentPage) {
        currentPage = i;
        fetchReports(i);
      }
    });
    paginationContainer.appendChild(btn);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const userToken = sessionStorage.getItem('user_token') || sessionStorage.getItem('token');
  if (!userToken) {
    return;
  }

  fetchReports();

  // User info and logout logic
  try {
  const userStr = sessionStorage.getItem('user') || sessionStorage.getItem('user_data');
    const user = userStr ? JSON.parse(userStr) : null;
    if (user) {
      const userNameTextElem = document.getElementById('userNameText');
      const sidebarUserNameElem = document.getElementById('sidebarUserName');
      const fullName = (user.firstName || '') + ' ' + (user.lastName || '');
      if (userNameTextElem) userNameTextElem.textContent = fullName;
      if (sidebarUserNameElem) sidebarUserNameElem.textContent = fullName;
    }
  } catch (e) {
    // fail silently
  }
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('user_token');
      sessionStorage.removeItem('token');
      window.location.href = 'main.html';
    });
  }
});

// Event delegation for .report-link clicks
tableBody.addEventListener("click", function (e) {
  const target = e.target.closest(".report-link");
  if (target) {
    const type = target.dataset.type;
    const reportId = target.dataset.id;
    if (type === "failed") {
      const failedCount = parseInt(target.textContent.trim(), 10);
      if (isNaN(failedCount) || failedCount === 0) {
        return;
      }
    }
    if (type && reportId && ["recipients", "delivered", "failed"].includes(type)) {
      showReportDetails(type, reportId);
    }
  }
});

// Modal/renderer mapping for report details
const modalMap = {
  recipients: {
    modalId: "reportRecipientsModal",
    tbodyId: "reportRecipientsTableBody",
    renderer: renderRecipients,
  },
  delivered: {
    modalId: "reportDeliveredModal",
    tbodyId: "reportDeliveredTableBody",
    renderer: renderDelivered,
  },
  failed: {
    modalId: "reportFailedModal",
    tbodyId: "reportFailedTableBody",
    renderer: renderFailed,
  }
};

function renderRecipients(items, tbody) {
  if (!Array.isArray(items) || !tbody) return;
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="text-center">Detay bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item, idx) => {
    const isimSoyisim = `${item.name || ""} ${item.surname || ""}`.trim();
    return `<tr>
      <td>${idx + 1}</td>
      <td>${item.phone ?? ""}</td>
      <td>${isimSoyisim}</td>
    </tr>`;
  }).join("");
}

function renderDelivered(items, tbody) {
  if (!Array.isArray(items) || !tbody) return;
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Detay bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item, idx) => {
    const isimSoyisim = `${item.name || ""} ${item.surname || ""}`.trim();
    return `<tr>
      <td>${idx + 1}</td>
      <td>${item.phone ?? ""}</td>
      <td>${isimSoyisim}</td>
      <td>${item.message ?? ""}</td>
      <td><span class="text-success">Gönderildi (sent)</span></td>
      <td>${item.sent_at ?? ""}</td>
    </tr>`;
  }).join("");
}

function renderFailed(items, tbody) {
  if (!Array.isArray(items) || !tbody) return;
  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Gönderilemeyen mesaj bulunamadı</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item, idx) => {
    const isimSoyisim = `${item.name || ""} ${item.surname || ""}`.trim();
    return `<tr>
      <td>${idx + 1}</td>
      <td>${item.phone ?? ""}</td>
      <td>${isimSoyisim}</td>
      <td>${item.message ?? ""}</td>
      <td><span class="text-danger">Gönderilemedi (failed)</span></td>
      <td>${item.sent_at ?? ""}</td>
    </tr>`;
  }).join("");
}

// Show report details in the correct modal and table body
async function showReportDetails(type, reportId) {
  const map = modalMap[type];
  if (!map) return;

  const { modalId, tbodyId, renderer } = map;
  const tbody = document.getElementById(tbodyId);

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center">Yükleniyor...</td></tr>`;
  }

  try {
  const token = sessionStorage.getItem("token") || sessionStorage.getItem('user_token');
    const res = await fetch(`${apiBaseUrl}/reports/messages/${reportId}?type=${type}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });
    if (!res.ok) throw new Error("Detaylar alınamadı");

    const data = await res.json();
    // Normalize response shapes: backend might return array directly or wrapped in different fields
    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (Array.isArray(data?.data)) {
      items = data.data;
    } else if (Array.isArray(data?.messages)) {
      items = data.messages;
    } else if (Array.isArray(data?.items)) {
      items = data.items;
    } else if (Array.isArray(data?.results)) {
      items = data.results;
    } else if (Array.isArray(data?.rows)) {
      items = data.rows;
    } else if (data && typeof data === 'object') {
      // try to find the first array value inside object
      for (const k of Object.keys(data)) {
        if (Array.isArray(data[k])) { items = data[k]; break; }
      }
    }
    if (renderer) {
      renderer(items || [], tbody);
    }

    const modalElem = document.getElementById(modalId);
    if (modalElem) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalElem);
      modal.show();
    }
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="10" class="text-center text-danger">Detaylar alınamadı</td></tr>`;
    }
    console.error("Detayları alırken hata:", err);
  }
}
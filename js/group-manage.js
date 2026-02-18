// Ortak fonksiyonlar
function getHeaders() {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionStorage.getItem("token") || sessionStorage.getItem('user_token')}`,
    };
}

async function parseJsonSafe(res) {
    try {
        return await res.json();
    } catch (e) {
        return null;
    }
}

function showFeedback(msg, type = 'success') {
    const fb = document.getElementById('feedbackMessage');
    if (!fb) return alert(msg);
    fb.className = `alert alert-${type} mt-3`;
    fb.textContent = msg;
    fb.classList.remove('d-none');
    setTimeout(() => {
        fb.classList.add('d-none');
    }, 3500);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return '-';
    let d = dateStr.split('T')[0];
    const parts = d.split('-');
    if (parts.length === 3) {
        return `${parts[2].padStart(2, '0')}.${parts[1].padStart(2, '0')}.${parts[0]}`;
    }
    return escapeHtml(dateStr);
}

// Grup yönetimi işlevleri
document.addEventListener("DOMContentLoaded", () => {
    const groupListContainer = document.getElementById("groupList");

    async function getGroups() {
        try {
            const res = await fetch("/api/groups", { headers: getHeaders() });
            const data = await parseJsonSafe(res);
            if (res.ok) return data?.groups || [];
            throw new Error(data?.error || "Gruplar alınamadı");
        } catch (err) {
            console.error("Grup getirme hatası:", err);
            return [];
        }
    }

    async function renderGroupList() {
        const groups = await getGroups();
        groupListContainer.innerHTML = "";

        if (!groups || groups.length === 0) {
            groupListContainer.innerHTML = "<p>Henüz grup yok.</p>";
            return;
        }

        groups.forEach((g) => {
            const div = document.createElement("div");
            div.className = "alert alert-secondary d-flex align-items-center justify-content-between flex-wrap";

            const left = document.createElement("div");
            left.className = "d-flex align-items-center";
            const nameSpan = document.createElement("strong");
            nameSpan.textContent = g.name + " ";
            left.appendChild(nameSpan);

            const personCount = g.person_count !== undefined ? g.person_count : (g.persons?.length || 0);
            const viewBtn = document.createElement("button");
            viewBtn.className = "btn btn-sm btn-link";
            viewBtn.type = "button";
            viewBtn.textContent = `${personCount} kişi – Gör`;
            viewBtn.addEventListener("click", () => showGroupDetailsById(g.id, g.name));
            left.appendChild(viewBtn);

            div.appendChild(left);

            const right = document.createElement("div");
            const exportBtn = document.createElement("button");
            exportBtn.className = "btn btn-sm btn-outline-success ms-2";
            exportBtn.type = "button";
            exportBtn.innerText = "Excel";
            exportBtn.addEventListener("click", async () => {
                let persons = g.persons;
                if (!persons) {
                    try {
                        const res = await fetch(`/api/groups/${g.id}/details`, { headers: getHeaders() });
                        const data = await parseJsonSafe(res);
                        if (res.ok) persons = data?.persons || [];
                    } catch (e) {
                        console.error('Export fetch failed', e);
                    }
                }
                exportGroupToExcel({ name: g.name, persons: persons || [] });
            });
            right.appendChild(exportBtn);

            const deleteBtn = document.createElement("button");
            deleteBtn.className = "btn btn-sm btn-danger ms-2";
            deleteBtn.type = "button";
            deleteBtn.innerText = "Sil";
            deleteBtn.addEventListener("click", () => {
                deleteGroup(g.id);
            });
            right.appendChild(deleteBtn);

            div.appendChild(right);
            groupListContainer.appendChild(div);
        });
    }

    async function deleteGroup(groupId) {
        if (!confirm("Bu grubu silmek istediğinize emin misiniz?")) return;

        try {
            const res = await fetch(`/api/groups/${groupId}`, {
                method: "DELETE",
                headers: getHeaders()
            });

            if (!res.ok) throw new Error("Grup silinemedi");

            showFeedback("Grup silindi");
            await renderGroupList();
        } catch (err) {
            console.error("Grup silme hatası:", err);
            showFeedback("Grup silinirken hata oluştu", 'danger');
        }
    }

    function exportGroupToExcel(group) {
        const ws = XLSX.utils.json_to_sheet(group.persons || []);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Kisiler");
        XLSX.writeFile(wb, `${group.name || 'group'}.xlsx`);
    }

    async function showGroupDetailsById(groupId, groupName) {
        const modalEl = document.getElementById("groupDetailsModal");
        const modal = new bootstrap.Modal(modalEl);
        const modalTitle = document.getElementById("groupModalTitle");
        const tableBody = document.getElementById("groupDetailsBody");
        const tableHead = document.getElementById("groupDetailsHead");

        tableBody.innerHTML = "";
        if (tableHead) tableHead.innerHTML = "";

        modalTitle.textContent = `📋 ${groupName}`;

        try {
            const res = await fetch(`/api/groups/${groupId}/details`, { headers: getHeaders() });
            const data = await parseJsonSafe(res);
            if (!res.ok) throw new Error(data?.error || 'Sunucu hatası');

            const persons = data?.persons || [];

            if (tableHead) {
                tableHead.innerHTML = `
                    <tr>
                        <th>İsim</th><th>Soyisim</th><th>Telefon</th><th>Şehir</th>
                        <th>Üyelik Tarihi</th><th>Cinsiyet</th><th>Doğum Tarihi</th>
                        <th>Son Sipariş Tarihi</th><th>Özel Alanlar</th><th>İşlemler</th>
                    </tr>
                `;
            }

            if (!persons.length) {
                tableBody.innerHTML = `<tr><td colspan="10">Bu grupta henüz kişi yok.</td></tr>`;
            } else {
                persons.forEach((p) => {
                    const row = document.createElement('tr');
                    let customFields = '';
                    for (let i = 1; i <= 13; i++) {
                        const val = p[`custom${i}`];
                        if (val && val.toString().trim() !== '') {
                            customFields += `<div><small>Özel Alan ${i}: ${escapeHtml(val)}</small></div>`;
                        }
                    }

                    const membershipDateFormatted = p.membership_date ? formatDateDDMMYYYY(p.membership_date) : '-';
                    const birthDateRaw = p.birthDate || p.birth_date;
                    const birthDateFormatted = birthDateRaw ? formatDateDDMMYYYY(birthDateRaw) : '-';
                    const lastOrderDateRaw = p.lastOrderDate || p.last_order_date;
                    const lastOrderDateFormatted = lastOrderDateRaw ? formatDateDDMMYYYY(lastOrderDateRaw) : '-';

                    row.innerHTML = `
                        <td>${escapeHtml(p.name || '-')}</td><td>${escapeHtml(p.surname || '-')}</td>
                        <td>${escapeHtml(p.phone || '-')}</td><td>${escapeHtml(p.city || '-')}</td>
                        <td>${membershipDateFormatted}</td><td>${escapeHtml(p.gender || '-')}</td>
                        <td>${birthDateFormatted}</td><td>${lastOrderDateFormatted}</td>
                        <td>${customFields}</td>
                        <td>
                            <button class="btn btn-sm btn-danger me-1" onclick="deletePerson(${groupId}, ${p.id})">Sil</button>
                            <button class="btn btn-sm btn-warning" onclick="editPerson(${groupId}, ${p.id})">Düzenle</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }

            modal.show();
        } catch (err) {
            console.error('Grup detay hatası:', err);
            tableBody.innerHTML = `<tr><td colspan="9" style="color:red">Grup bilgileri alınamadı.</td></tr>`;
            modal.show();
        }
    }

    async function deletePerson(groupId, personId) {
        if (!confirm("Bu kişiyi silmek istediğinizden emin misiniz?")) return;
        try {
            const res = await fetch(`/api/groups/${groupId}/person/${personId}`, {
                method: 'DELETE',
                headers: getHeaders(),
            });
            const data = await parseJsonSafe(res);
            if (!res.ok) throw new Error(data?.error || 'Silinemedi');
            
            showFeedback('Kişi silindi.');
            await renderGroupList();
            const modal = bootstrap.Modal.getInstance(document.getElementById('groupDetailsModal'));
            if (modal) modal.hide();
        } catch (err) {
            console.error('Kişi silme hatası:', err);
            showFeedback('Kişi silinemedi.', 'danger');
        }
    }

    async function editPerson(groupId, personId) {
        let personData;
        try {
            const res = await fetch(`/api/groups/${groupId}/person/${personId}`, {
                method: 'GET',
                headers: getHeaders(),
            });
            const data = await parseJsonSafe(res);
            if (!res.ok) throw new Error(data?.error || 'Kişi bilgileri alınamadı');
            personData = data && data.person ? data.person : data;
        } catch (err) {
            alert('Kişi bilgileri alınamadı.');
            return;
        }

        let modalEl = document.getElementById('editPersonModal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'editPersonModal';
            modalEl.className = 'modal fade';
            modalEl.tabIndex = -1;
            modalEl.innerHTML = `
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Kişiyi Güncelle</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="editPersonForm">
                            <div class="modal-body" id="editPersonFormBody"></div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">İptal</button>
                                <button type="submit" class="btn btn-primary">Kaydet</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }

        const formBody = modalEl.querySelector('#editPersonFormBody');
        const editForm = modalEl.querySelector('#editPersonForm');
        
        const fields = [
            { key: 'name', label: 'İsim', type: 'text', required: true },
            { key: 'surname', label: 'Soyisim', type: 'text', required: true },
            { key: 'phone', label: 'Telefon', type: 'text' },
            { key: 'city', label: 'Şehir', type: 'text' },
            { key: 'membershipDate', label: 'Üyelik Tarihi', type: 'date' },
            { key: 'gender', label: 'Cinsiyet', type: 'select', options: ['', 'Erkek', 'Kadın'] },
            { key: 'birthDate', label: 'Doğum Tarihi', type: 'date' },
            { key: 'lastOrderDate', label: 'Son Sipariş Tarihi', type: 'date' },
        ];
        for (let i = 1; i <= 13; i++) {
            fields.push({ key: `custom${i}`, label: `Özel Alan ${i}`, type: 'text' });
        }

        function getFieldValue(key) {
            if (key === 'membershipDate') return personData.membershipDate || personData.membership_date || '';
            if (key === 'birthDate') return personData.birthDate || personData.birth_date || '';
            if (key === 'lastOrderDate') return personData.lastOrderDate || personData.last_order_date || '';
            return personData[key] ?? '';
        }

        formBody.innerHTML = fields.map(field => {
            const value = getFieldValue(field.key);
            if (field.type === 'select') {
                return `
                    <div class="mb-3">
                        <label class="form-label">${field.label}</label>
                        <select class="form-select" name="${field.key}">
                            ${field.options.map(opt =>
                                `<option value="${opt}"${opt === value ? ' selected' : ''}>${opt || 'Seçiniz'}</option>`
                            ).join('')}
                        </select>
                    </div>
                `;
            } else {
                let v = value;
                if (field.type === 'date' && v) {
                    try {
                        const d = new Date(v);
                        if (!isNaN(d)) v = d.toISOString().slice(0, 10);
                    } catch (e) {}
                }
                return `
                    <div class="mb-3">
                        <label class="form-label">${field.label}${field.required ? ' *' : ''}</label>
                        <input type="${field.type}" class="form-control" name="${field.key}" 
                               value="${v ? String(v).replace(/"/g, '&quot;') : ''}"${field.required ? ' required' : ''}>
                    </div>
                `;
            }
        }).join('');

        const modal = new bootstrap.Modal(modalEl);
        modal.show();

        editForm.onsubmit = async function(e) {
            e.preventDefault();
            const formData = new FormData(editForm);
            const payload = {};
            for (let [key, val] of formData.entries()) {
                if (['birthDate', 'membershipDate', 'lastOrderDate'].includes(key)) {
                    payload[key] = val === '' ? null : val;
                } else {
                    payload[key] = val;
                }
            }
            
            try {
                const saveBtn = editForm.querySelector('button[type="submit"]');
                saveBtn.disabled = true;
                const res = await fetch(`/api/groups/${groupId}/person/${personId}`, {
                    method: 'PUT',
                    headers: getHeaders(),
                    body: JSON.stringify(payload),
                });
                const data = await parseJsonSafe(res);
                if (!res.ok) throw new Error(data?.error || 'Güncellenemedi');
                
                modal.hide();
                showFeedback('Kişi güncellendi.');
                await renderGroupList();
            } catch (err) {
                alert('Kişi güncellenemedi.');
                console.error('Kişi güncelleme hatası:', err);
            }
        };
    }

    // Global fonksiyonlar
    window.deletePerson = deletePerson;
    window.editPerson = editPerson;
    window.showGroupDetailsById = showGroupDetailsById;

    // İlk render
    renderGroupList();
}); 
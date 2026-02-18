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

// Grup oluşturma işlevleri
document.addEventListener("DOMContentLoaded", () => {
    const groupNameInput = document.getElementById("groupName");
    const createGroupBtn = document.getElementById("createGroupBtn");
    const excelInput = document.getElementById("excelUpload");

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

    createGroupBtn.addEventListener("click", async () => {
        const name = groupNameInput.value.trim();
        if (!name) return alert("Grup adı boş olamaz");

        createGroupBtn.disabled = true;
        if (createGroupBtn.dataset.creating === "true") return;
        createGroupBtn.dataset.creating = "true";
        
        try {
            const groups = await getGroups();
            if (groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
                alert("Bu isimde bir grup zaten var.");
                createGroupBtn.disabled = false;
                return;
            }

            const res = await fetch("/api/groups", {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify({ name }),
            });
            const data = await parseJsonSafe(res);
            if (!res.ok) throw new Error(data?.error || "Grup oluşturulamadı");

            groupNameInput.value = "";
            showFeedback('Grup başarıyla oluşturuldu.');
        } catch (err) {
            console.error("Grup oluşturma hatası:", err);
            showFeedback('Grup oluşturulamadı.', 'danger');
        } finally {
            createGroupBtn.disabled = false;
            createGroupBtn.dataset.creating = "false";
        }
    });

    // Excel yükleme işlevleri
    excelInput?.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const headerMap = {
            "telefon": "phone", "isim": "name", "ad": "name", "soyisim": "surname", "soyad": "surname",
            "doğum tarihi": "birthDate", "dogum tarihi": "birthDate", "üyelik tarihi": "membershipDate",
            "uyelik tarihi": "membershipDate", "şehir": "city", "sehir": "city", "cinsiyet": "gender",
            "son sipariş tarihi": "lastOrderDate", "son siparis tarihi": "lastOrderDate",
            "özel alan 1": "custom1", "özel alan 2": "custom2", "özel alan 3": "custom3",
            "özel alan 4": "custom4", "özel alan 5": "custom5", "özel alan 6": "custom6",
            "özel alan 7": "custom7", "özel alan 8": "custom8", "özel alan 9": "custom9",
            "özel alan 10": "custom10", "özel alan 11": "custom11", "özel alan 12": "custom12",
            "özel alan 13": "custom13",
        };

        function normalizeHeader(h) {
            return h ? h.toString().trim().toLowerCase() : "";
        }

        function formatDate(val) {
            if (!val) return null;
            if (typeof val === "number") {
                return XLSX.SSF.format("yyyy-mm-dd", val);
            }
            const d = new Date(val);
            return isNaN(d) ? null : d.toISOString().slice(0, 10);
        }

        let groupName = file.name.replace(/\.[^/.]+$/, "").trim();
        if (!groupName) {
            showFeedback("Excel dosyasının adı geçerli bir grup adı içermiyor.", "danger");
            return;
        }

        let targetGroupId;
        try {
            const groups = await getGroups();
            let group = groups.find(g => g.name.trim().toLowerCase() === groupName.toLowerCase());
            if (!group) {
                const res = await fetch("/api/groups", {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({ name: groupName }),
                });
                const data = await parseJsonSafe(res);
                if (!res.ok) throw new Error(data?.error || "Grup oluşturulamadı");
                group = data.group || data;
            }
            targetGroupId = group.id;
        } catch (err) {
            console.error("Grup bulma/oluşturma hatası:", err);
            showFeedback("Grup oluşturulamadı veya bulunamadı.", "danger");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

            const persons = [];
            for (const row of json) {
                const person = { ...row };
                for (const [colName, value] of Object.entries(row)) {
                    const key = headerMap[normalizeHeader(colName)];
                    if (key) {
                        if (["birthDate", "membershipDate", "lastOrderDate"].includes(key)) {
                            person[key] = formatDate(value);
                        } else {
                            person[key] = value;
                        }
                    }
                }
                if (person.name && person.surname && person.phone) {
                    persons.push(person);
                }
            }

            for (const person of persons) {
                try {
                    const res = await fetch(`/api/groups/${targetGroupId}/person`, {
                        method: "POST",
                        headers: getHeaders(),
                        body: JSON.stringify(person),
                    });
                    await parseJsonSafe(res);
                } catch (e) {
                    console.error("Excel satır ekleme hatası", e);
                }
            }
            
            showFeedback("Excel'den kişiler başarıyla yüklendi.");
            excelInput.value = "";
        };
        reader.readAsArrayBuffer(file);
    });
});
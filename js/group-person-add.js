// Ortak fonksiyonlar
function getHeaders() {
    return {
        "Content-Type": "application/json",
    Authorization: `Bearer ${sessionStorage.getItem("token")}`,
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

// Kişi ekleme işlevleri
document.addEventListener("DOMContentLoaded", () => {
    const groupSelect = document.getElementById("groupSelect");
    const addPersonForm = document.getElementById("addPersonForm");

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

    async function loadGroups() {
        const groups = await getGroups();
        if (groupSelect) {
            groupSelect.innerHTML = "<option value=''>Bir grup seçin</option>";
            groups.forEach((g) => {
                const option = document.createElement("option");
                option.value = g.id;
                option.textContent = g.name;
                groupSelect.appendChild(option);
            });
        }
    }

    addPersonForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(addPersonForm);
        const person = Object.fromEntries(formData.entries());
        
        if (!person.phone || person.phone.trim() === "") {
            alert("Telefon numarası zorunludur.");
            return;
        }
        
        const selectedGroupId = groupSelect.value;
        if (!selectedGroupId) return alert("Lütfen geçerli bir grup seçin.");

        if (person.birthDate === "") person.birthDate = null;
        if (person.membershipDate === "") person.membershipDate = null;
        if (person.lastOrderDate === "") person.lastOrderDate = null;

        const submitBtn = addPersonForm.querySelector("button[type='submit']");
        submitBtn.disabled = true;
        
        try {
            const res = await fetch(`/api/groups/${selectedGroupId}/person`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(person),
            });
            const data = await parseJsonSafe(res);
            if (!res.ok) throw new Error(data?.error || "Kişi eklenemedi");

            showFeedback('Kişi başarıyla eklendi.');
            addPersonForm.reset();
        } catch (err) {
            console.error("Kişi ekleme hatası:", err);
            showFeedback('Kişi eklenemedi.', 'danger');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // Sayfa yüklendiğinde grupları yükle
    loadGroups();
});
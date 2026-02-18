async function fetchUserInfo() {
  try {
  const userData = JSON.parse(sessionStorage.getItem("user_data") || sessionStorage.getItem('user') || 'null');
    if (!userData || !userData.email) throw new Error("LocalStorage'ta kullanıcı yok");

    // Debug log
    console.log("API'ye gönderilen email:", userData.email);

    const response = await fetch("http://localhost:3001/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userData.email }),
    });

    console.log("Response status:", response.status);

    if (!response.ok) throw new Error("Sunucudan kullanıcı bilgisi alınamadı");

    const result = await response.json();
    console.log("API dönüşü:", result);
    return result.user || result;
  } catch (e) {
    console.error("Kullanıcı bilgisi alınamadı:", e);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    const user = await fetchUserInfo();

    // Hedef span'ları doldur
    document.getElementById("userFirstName").innerText = user?.firstName || "-";
    document.getElementById("userLastName").innerText = user?.lastName || "-";
    document.getElementById("userEmail").innerText = user?.email || "-";
    document.getElementById("userPhone").innerText = user?.phone || "-";
    document.getElementById("userCreatedAt").innerText = user?.created_at
      ? new Date(user.created_at).toLocaleDateString("tr-TR")
      : "-";

    // --- Message Limit Section ---
    try {
      // Fetch current message limit
      const resp = await fetch("http://localhost:3001/api/user/message-limit", {
        method: "GET",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": "Bearer " + (sessionStorage.getItem("token") || sessionStorage.getItem('user_token'))
        }
      });
      if (!resp.ok) throw new Error("Mesaj limiti alınamadı");
      const data = await resp.json();
      const messageLimit = data.message_limit !== undefined ? data.message_limit : "";
      // Populate select element
      const select = document.getElementById("messageLimitSelect");
      if (select) {
        // Updated allowed limits
        const limits = [2, 3, 4, 5, 6, 10, 12, 15, 20, 30];
        select.innerHTML = ""; // Clear
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
    // --- End Message Limit Section ---
  })();

  // Mesaj limiti kaydetme
  const saveMsgBtn = document.getElementById("saveMessageLimitBtn");
  if (saveMsgBtn) {
    saveMsgBtn.addEventListener("click", async () => {
      try {
        const select = document.getElementById("messageLimitSelect");
        if (!select) throw new Error("Mesaj limiti seçici bulunamadı");
        const messageRateLimit = parseInt(select.value, 10);
        // Log the value being sent
        console.log("Gönderilecek mesaj limiti:", messageRateLimit);
        const resp = await fetch("http://localhost:3001/api/user/message-limit", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (sessionStorage.getItem("token") || sessionStorage.getItem('user_token'))
          },
          body: JSON.stringify({ messageRateLimit }),
        });
        // Log the response status
        console.log("Mesaj limiti update response status:", resp.status);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || "Mesaj limiti güncellenemedi");
        alert("Mesaj limiti başarıyla güncellendi.");
      } catch (e) {
        alert("Mesaj limiti güncellenirken hata: " + (e.message || e));
      }
    });
  }

  // Şifre değiştirme butonları
  const passwordSection = document.getElementById("passwordSection");
  document.getElementById("showChangePasswordBtn").addEventListener("click", () => {
    passwordSection.style.display = "block";
  });

  document.getElementById("sendCodeBtn").addEventListener("click", async () => {
  const userEmail = JSON.parse(sessionStorage.getItem("user_data") || sessionStorage.getItem('user') || 'null')?.email;
    if (!userEmail) return alert("Email bulunamadı");

    try {
      const response = await fetch("http://localhost:3001/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      const result = await response.json();
      alert(result.message || "Kod gönderildi");
    } catch {
      alert("Kod gönderilemedi");
    }
  });

  document.getElementById("changePasswordBtn").addEventListener("click", async () => {
  const email = JSON.parse(sessionStorage.getItem("user_data") || sessionStorage.getItem('user') || 'null')?.email;
    const code = document.getElementById("resetCode").value;
    const newPass = document.getElementById("newPassword").value;
    const newPass2 = document.getElementById("newPassword2").value;

    if (!code || !newPass || !newPass2) return alert("Tüm alanları doldurun");
    if (newPass !== newPass2) return alert("Şifreler uyuşmuyor");

    try {
      const response = await fetch("http://localhost:3001/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: newPass }),
      });
      const result = await response.json();
      if (response.ok) {
        alert("Şifre değişti");
        passwordSection.style.display = "none";
      } else {
        alert(result.message || "Şifre değiştirilemedi");
      }
    } catch {
      alert("Bir hata oluştu");
    }
  });
});
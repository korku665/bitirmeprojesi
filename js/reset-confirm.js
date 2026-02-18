// Sadece kod doğrulandıysa bu sayfa açılır, aksi halde 401.html'e yönlendir
if (window.location.pathname.endsWith('password-confirm.html')) {
  const resetEmail = sessionStorage.getItem('reset_email');
  const codeVerified = sessionStorage.getItem('reset_code_verified');
  if (!resetEmail || codeVerified !== '1') {
    window.location.href = '401.html';
  }
}
// js/reset-confirm.js

document.addEventListener("DOMContentLoaded", () => {
  const emailInput = document.getElementById("emailInput");
  const resetForm = document.getElementById("resetConfirmForm");
  const resetError = document.getElementById("resetError");
  const resetSuccess = document.getElementById("resetSuccess");

  const storedEmail = sessionStorage.getItem("reset_email");
  if (!storedEmail) {
    return;
  }

  emailInput.value = storedEmail;

  // Şifre sıfırlama formu
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetError.style.display = "none";
    resetSuccess.style.display = "none";

    const newPassword = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!newPassword || !confirmPassword) {
      resetError.textContent = "Lütfen tüm alanları doldurun.";
      resetError.style.display = "block";
      return;
    }

    if (newPassword !== confirmPassword) {
      resetError.textContent = "Şifreler eşleşmiyor.";
      resetError.style.display = "block";
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: storedEmail,
          newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        resetSuccess.textContent = "✅ Şifreniz başarıyla sıfırlandı. Giriş sayfasına yönlendiriliyorsunuz...";
        resetSuccess.style.display = "block";
  sessionStorage.removeItem("reset_email");
  sessionStorage.removeItem("reset_code_sent");
  sessionStorage.removeItem("reset_code_verified");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 3000);
      } else {
        resetError.textContent = data.message || "❌ Şifre sıfırlama başarısız.";
        resetError.style.display = "block";
      }
    } catch (err) {
      console.error("Şifre sıfırlama hatası:", err);
      resetError.textContent = "❌ Sunucu hatası. Lütfen tekrar deneyin.";
      resetError.style.display = "block";
    }

  });
});


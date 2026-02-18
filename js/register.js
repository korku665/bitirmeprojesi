document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const firstName = document.getElementById('inputFirstName').value.trim();
  const lastName = document.getElementById('inputLastName').value.trim();
  const email = document.getElementById('inputEmail').value.trim();
  const phone = document.getElementById('inputPhone').value.trim();
  const password = document.getElementById('inputPassword').value;
  const confirmPassword = document.getElementById('inputPasswordConfirm').value;

  if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
    alert("Lütfen tüm alanları doldurun.");
    return;
  }

  if (password !== confirmPassword) {
    alert("Şifreler eşleşmiyor.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("Geçerli bir e-posta adresi girin.");
    return;
  }

  const payload = {
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    password,
    created_at: new Date().toISOString()
  };

  try {
    const response = await fetch('http://localhost:3001/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    let data = {};
    try {
      data = await response.json();
    } catch (err) {
      console.error("JSON parse hatası:", err);
    }

    if (response.ok) {
      alert("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz.");
      window.location.href = 'login.html';
    } else {
      alert(data.message || "Kayıt başarısız.");
    }
  } catch (error) {
    console.error("Kayıt hatası:", error);
    alert("Sunucu hatası oluştu.");
  }
});
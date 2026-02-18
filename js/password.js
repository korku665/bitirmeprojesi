document.addEventListener('DOMContentLoaded', () => {
  // Eğer sayfa password-confirm.html ise, koruma kodunu uygula
  if (window.location.pathname.endsWith('password-confirm.html')) {
  const resetEmail = sessionStorage.getItem('reset_email');
  const codeVerified = sessionStorage.getItem('reset_code_verified');
    if (!resetEmail || codeVerified !== '1') {
      window.location.href = 'password.html';
      return;
    }
  }

  // Sadece password.html sayfasında aşağıdaki kodlar çalışsın
  if (window.location.pathname.endsWith('password.html')) {
    const resetForm = document.getElementById('resetForm');
    const emailInput = document.getElementById('inputEmail');
    const resetError = document.getElementById('resetError');
    const resetSuccess = document.getElementById('resetSuccess');
    const codeSection = document.getElementById('codeSection');
    const inputCode = document.getElementById('inputCode');
    const verifyCodeBtn = document.getElementById('verifyCodeBtn');
    const codeError = document.getElementById('codeError');

    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      resetError.style.display = 'none';
      resetSuccess.style.display = 'none';

      const email = emailInput.value.trim();

      if (!email) {
        resetError.textContent = 'Lütfen geçerli bir e-posta adresi girin.';
        resetError.style.display = 'block';
        return;
      }

      try {
        const response = await fetch('http://localhost:3001/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
          // sessionStorage'a email ve kod gönderildi bilgisini kaydet (sekme/sesyon bazlı)
          sessionStorage.setItem('reset_email', email);
          sessionStorage.setItem('reset_code_sent', '1');

          resetSuccess.textContent = '✅ Kod e-posta adresinize gönderildi. Lütfen kontrol edin.';
          resetSuccess.style.display = 'block';

          // Kod girme alanını aç
          codeSection.style.display = 'block';
          // Email input ve butonları devre dışı bırak
          emailInput.disabled = true;
          document.getElementById('resetPasswordBtn').disabled = true;

          // 2 dakikalık sayaç başlat
          const timerText = document.getElementById('timerText');
          const resendCodeBtn = document.getElementById('resendCodeBtn');
          let remaining = 120; // saniye
          inputCode.disabled = false;
          verifyCodeBtn.disabled = false;
          resendCodeBtn.disabled = true;
          timerText.textContent = `Kalan süre: 02:00`;
          const interval = setInterval(() => {
            remaining--;
            const min = String(Math.floor(remaining / 60)).padStart(2, '0');
            const sec = String(remaining % 60).padStart(2, '0');
            timerText.textContent = `Kalan süre: ${min}:${sec}`;
            if (remaining <= 0) {
              clearInterval(interval);
              timerText.textContent = 'Kodun süresi doldu. Lütfen tekrar kod isteyin.';
              inputCode.disabled = true;
              verifyCodeBtn.disabled = true;
              resendCodeBtn.disabled = false;
            }
          }, 1000);

          // Yeniden kod gönderme butonu
          resendCodeBtn.addEventListener('click', async () => {
            resendCodeBtn.disabled = true;
            timerText.textContent = 'Yeni kod gönderiliyor...';
            try {
              const response = await fetch('http://localhost:3001/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
              });
              const data = await response.json();
              if (response.ok) {
                // Sayaç ve alanları sıfırla
                inputCode.value = '';
                inputCode.disabled = false;
                verifyCodeBtn.disabled = false;
                let newRemaining = 120;
                timerText.textContent = `Kalan süre: 02:00`;
                let resendInterval = setInterval(() => {
                  newRemaining--;
                  const min = String(Math.floor(newRemaining / 60)).padStart(2, '0');
                  const sec = String(newRemaining % 60).padStart(2, '0');
                  timerText.textContent = `Kalan süre: ${min}:${sec}`;
                  if (newRemaining <= 0) {
                    clearInterval(resendInterval);
                    timerText.textContent = 'Kodun süresi doldu. Lütfen tekrar kod isteyin.';
                    inputCode.disabled = true;
                    verifyCodeBtn.disabled = true;
                    resendCodeBtn.disabled = false;
                  }
                }, 1000);
              } else {
                timerText.textContent = data.message || 'Kod gönderilemedi.';
                resendCodeBtn.disabled = false;
              }
            } catch (err) {
              timerText.textContent = 'Sunucu hatası. Lütfen tekrar deneyin.';
              resendCodeBtn.disabled = false;
            }
          });
        } else {
          resetError.textContent = data.message || '❌ İşlem başarısız.';
          resetError.style.display = 'block';
        }
      } catch (error) {
        console.error('Şifre sıfırlama hatası:', error);
        resetError.textContent = '❌ Sunucu hatası. Lütfen tekrar deneyin.';
        resetError.style.display = 'block';
      }
    });

    // Kod doğrulama butonu
    if (verifyCodeBtn) {
      verifyCodeBtn.addEventListener('click', async () => {
        codeError.style.display = 'none';
  const email = sessionStorage.getItem('reset_email');
        const code = inputCode.value.trim();
        if (!code) {
          codeError.textContent = 'Lütfen e-posta ile gelen kodu girin.';
          codeError.style.display = 'block';
          return;
        }
        try {
          const response = await fetch('http://localhost:3001/auth/verify-reset-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
          });
          const data = await response.json();
          if (response.ok && data.valid) {
            // Kod doğruysa flag koy ve yönlendir
            sessionStorage.setItem('reset_code_verified', '1');
            window.location.href = 'password-confirm.html';
          } else {
            codeError.textContent = data.message || 'Kod yanlış veya süresi dolmuş.';
            codeError.style.display = 'block';
          }
        } catch (err) {
          codeError.textContent = 'Sunucu hatası. Lütfen tekrar deneyin.';
          codeError.style.display = 'block';
        }
      });
    }
  }
});
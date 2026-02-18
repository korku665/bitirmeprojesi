// auth-guard.js
// Redirect to main.html if sessionStorage does not contain auth token.
(function(){
  function isAuthenticated(){
    try {
      return !!sessionStorage.getItem('user_token') || !!sessionStorage.getItem('token');
    } catch (e) {
      return false;
    }
  }

  // Run on DOMContentLoaded so pages have a chance to initialize
  document.addEventListener('DOMContentLoaded', function(){
    // Allow main.html, login.html, register and public pages
    var publicPages = ['main.html','login.html','register.html','password.html','password-confirm.html','404.html','500.html'];
    var current = window.location.pathname.split('/').pop();
    if (publicPages.indexOf(current) !== -1) return;

    if (!isAuthenticated()) {
      // Not authenticated — force redirect to main.html (public landing)
      window.location.replace('main.html');
    } else {
      // Authenticated in this session — reveal the body (some pages hide body to prevent flash)
      try { document.body.style.display = 'block'; } catch(e){}
    }
  });
})();

/**
 * CapacitaTE - Tela de Login (card central, logos CECATE, e-mail + senha, esqueci minha senha)
 * Versão: v.3.8.6
 */

window.CapacitaTE = window.CapacitaTE || {};

(function () {
  const ICON = 'viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

  let overlay = null;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'auth-overlay';
    overlay.id = 'auth-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'auth-title');
    overlay.innerHTML = `
      <div class="auth-card glass-card">
        <div class="auth-brand">
          <img src="assets/CECATE_Centro-Oeste_Logo_Negativo_Horizontal_Completa-PNG.png" alt="Logo CECATE Centro-Oeste" class="brand-logo-img logo-dark">
          <img src="assets/CECATE_Centro-Oeste_Logo_Colorida_Horizontal_Completa-PNG.png" alt="Logo CECATE Centro-Oeste" class="brand-logo-img logo-light">
        </div>
        <h2 id="auth-title" class="auth-title">CapacitaTE</h2>
        <p class="auth-subtitle">Plataforma de Gestão de Capacitações em Transporte Escolar — CECATE Centro-Oeste</p>

        <form id="auth-login-form" class="auth-form" novalidate>
          <div class="form-group">
            <label class="form-label" for="auth-email">E-mail</label>
            <input type="email" id="auth-email" class="form-control" autocomplete="username" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="auth-password">Senha</label>
            <input type="password" id="auth-password" class="form-control" autocomplete="current-password" required>
          </div>
          <button type="submit" class="btn btn-primary auth-submit" id="auth-submit-btn">
            <svg ${ICON}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
            Entrar
          </button>
          <button type="button" class="auth-link" id="auth-forgot-btn">Esqueci minha senha</button>
        </form>

        <form id="auth-recovery-form" class="auth-form" style="display:none;" novalidate>
          <div class="form-group">
            <label class="form-label" for="auth-new-password">Senha (mínimo 8 caracteres)</label>
            <input type="password" id="auth-new-password" class="form-control" autocomplete="new-password" minlength="8" required>
          </div>
          <button type="submit" class="btn btn-primary auth-submit">Salvar nova senha</button>
        </form>

        <p class="auth-message" id="auth-message" role="status" aria-live="polite"></p>

        <div class="auth-transition" id="auth-transition" style="display:none;">
          <button type="button" class="btn btn-secondary btn-sm" id="auth-continue-btn">Continuar sem login (modo transição)</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const msg = (text, type) => api.setMessage(text, type);
    overlay.querySelector('#auth-login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#auth-email').value;
      const password = overlay.querySelector('#auth-password').value;
      if (!email || !password) return msg('Informe e-mail e senha.', 'error');
      const btn = overlay.querySelector('#auth-submit-btn');
      btn.disabled = true;
      msg('Entrando...', 'info');
      try {
        await CapacitaTE.auth.signIn(email, password);
      } catch (err) {
        msg(err.message || 'Não foi possível entrar.', 'error');
      } finally {
        btn.disabled = false;
      }
    });
    overlay.querySelector('#auth-forgot-btn').addEventListener('click', async () => {
      const email = overlay.querySelector('#auth-email').value;
      if (!email) return msg('Digite o seu e-mail acima e clique de novo em "Esqueci minha senha".', 'info');
      try {
        await CapacitaTE.auth.resetPassword(email);
        msg('Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.', 'success');
      } catch (err) {
        msg(err.message, 'error');
      }
    });
    overlay.querySelector('#auth-recovery-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pwd = overlay.querySelector('#auth-new-password').value;
      if (pwd.length < 8) return msg('A senha precisa ter pelo menos 8 caracteres.', 'error');
      try {
        await CapacitaTE.auth.updatePassword(pwd);
        msg('Senha alterada. Entrando...', 'success');
        setTimeout(() => window.location.reload(), 900);
      } catch (err) {
        msg(err.message, 'error');
      }
    });
    overlay.querySelector('#auth-continue-btn').addEventListener('click', () => CapacitaTE.auth.continueWithoutLogin());
    return overlay;
  }

  const api = {
    show({ allowTransition = false, message = '' } = {}) {
      build();
      document.body.classList.add('auth-locked');
      overlay.classList.add('active');
      overlay.querySelector('#auth-transition').style.display = allowTransition ? 'flex' : 'none';
      if (message) api.setMessage(message, 'info');
      setTimeout(() => overlay.querySelector('#auth-email').focus(), 50);
    },

    showRecovery(type = 'recovery') {
      api.show();
      overlay.querySelector('#auth-login-form').style.display = 'none';
      overlay.querySelector('#auth-recovery-form').style.display = 'block';
      overlay.querySelector('#auth-transition').style.display = 'none';
      api.setMessage(type === 'invite' ? 'Bem-vindo(a) ao CapacitaTE! Crie a sua senha para concluir o cadastro.' : 'Defina a sua nova senha.', 'info');
    },

    hide() {
      document.body.classList.remove('auth-locked');
      if (overlay) overlay.classList.remove('active');
    },

    setMessage(text, type = 'info') {
      build();
      const el = overlay.querySelector('#auth-message');
      el.textContent = text || '';
      el.className = `auth-message auth-message-${type}`;
    }
  };

  CapacitaTE.loginView = api;
})();

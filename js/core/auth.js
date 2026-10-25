/**
 * CapacitaTE - Login, Sessão, Perfil e Permissões do Usuário Atual (Supabase Auth)
 * Versão: v.3.8.3
 */

window.CapacitaTE = window.CapacitaTE || {};

(function () {
  const PERMS_CACHE_KEY = 'capacitate_auth_cache';       // perfil e permissões do último login (uso offline)
  const AUTH_REQUIRED_KEY = 'capacitate_auth_required';  // já existe admin: login obrigatório neste navegador

  const storage = {
    get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* armazenamento indisponível */ } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) { /* armazenamento indisponível */ } }
  };

  const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);

  // Links de redefinição de senha (#...type=recovery) e de convite (#...type=invite) exigem definir a senha;
  // o app limpa o hash depois, então guarda agora
  const linkType = ((window.location.hash || '').match(/type=(recovery|invite)/) || [])[1] || null;
  const openedFromRecoveryLink = !!linkType;

  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  const auth = {
    /**
     * mode:
     *  'authenticated' → logado, permissões carregadas do servidor (ou do cache, se offline)
     *  'transition'    → login ainda não configurado no Supabase (sem migração 0002 ou sem admin): tudo liberado
     *  'local'         → sem biblioteca do Supabase: app funciona só com os dados locais, tudo liberado
     */
    mode: null,
    user: null,
    profile: null,       // { is_admin }
    permissions: [],     // [{ module_key, action, training_id }]
    setup: null,         // { installed, has_admin, offline }

    ready: () => ready,

    client() {
      return CapacitaTE.supabaseClient ? CapacitaTE.supabaseClient.get() : null;
    },

    /**
     * Consulta se o login já está configurado no servidor (migração 0002 aplicada e admin definido)
     */
    async checkSetup() {
      const client = this.client();
      if (!client) return { installed: false, has_admin: false, offline: true };
      try {
        const { data, error } = await withTimeout(client.rpc('auth_setup_status'), 8000);
        if (error) {
          // Função inexistente = migração 0002 ainda não aplicada
          if (error.code === 'PGRST202' || /auth_setup_status|schema cache|not find/i.test(error.message || '')) {
            return { installed: false, has_admin: false, offline: false };
          }
          return { installed: false, has_admin: false, offline: true };
        }
        return { installed: !!data?.installed, has_admin: !!data?.has_admin, offline: false };
      } catch (e) {
        return { installed: false, has_admin: false, offline: true };
      }
    },

    /**
     * Decide o modo de acesso. Resolve ready() quando o painel pode ser exibido.
     */
    async init() {
      // Chamado depois de db.init(), quando o endereço da nuvem (.env ou navegador) já foi aplicado
      const client = this.client();
      if (!client) return this.finish('local');

      // Link de "Esqueci minha senha": o Supabase volta com type=recovery no endereço e pede a nova senha
      client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' && CapacitaTE.loginView) CapacitaTE.loginView.showRecovery();
        if (event === 'SIGNED_OUT' && this.mode === 'authenticated') window.location.reload();
      });

      this.setup = await this.checkSetup();
      if (this.setup.has_admin) storage.set(AUTH_REQUIRED_KEY, '1');

      let session = null;
      try { session = (await client.auth.getSession()).data.session; } catch (e) { session = null; }

      if (session && openedFromRecoveryLink) {
        CapacitaTE.loginView.showRecovery(linkType);
        return ready;
      }

      if (session) {
        const ok = await this.loadProfile(session.user, { offline: this.setup.offline });
        if (ok) return this.finish('authenticated');
      }

      // Sem login válido: decide se o login é obrigatório
      const required = this.setup.has_admin || (this.setup.offline && storage.get(AUTH_REQUIRED_KEY) === '1');
      CapacitaTE.loginView.show({
        allowTransition: !required,
        message: this.setup.offline && required
          ? 'Sem conexão com a nuvem. Entre quando a conexão voltar.'
          : (!this.setup.installed && !this.setup.offline
            ? 'O login ainda não foi configurado no Supabase (migração 0002). Você pode continuar sem login por enquanto.'
            : '')
      });
      return ready;
    },

    finish(mode) {
      this.mode = mode;
      document.body.classList.toggle('auth-logged-in', mode === 'authenticated');
      if (CapacitaTE.loginView) CapacitaTE.loginView.hide();
      this.renderUserChip();
      const hint = document.getElementById('auth-setup-hint');
      if (hint) hint.style.display = this.setup && !this.setup.offline && !this.setup.has_admin ? 'block' : 'none';
      resolveReady(mode);
      return ready;
    },

    /**
     * Carrega perfil e permissões (my_permissions). Offline, usa o cache do último login deste usuário.
     */
    async loadProfile(user, { offline = false } = {}) {
      this.user = user;
      if (offline) {
        const cache = JSON.parse(storage.get(PERMS_CACHE_KEY) || 'null');
        if (cache && cache.userId === user.id) {
          this.profile = cache.profile;
          this.permissions = cache.permissions;
          return true;
        }
        return false;
      }
      const client = this.client();
      const { data, error } = await client.rpc('my_permissions');
      if (error) {
        // Migração 0002 ainda não aplicada: login funciona, mas não há perfis; segue em modo transição
        if (!this.setup?.installed) { this.profile = { is_admin: false }; this.permissions = []; return true; }
        throw error;
      }
      if (!data || data.length === 0) {
        // Sem perfil ativo: usuário desativado
        await client.auth.signOut();
        this.user = null;
        CapacitaTE.loginView && CapacitaTE.loginView.setMessage('Este usuário está desativado. Procure um admin.', 'error');
        return false;
      }
      this.profile = { is_admin: !!data[0].is_admin, email: user.email };
      this.permissions = data.filter(r => r.module_key).map(r => ({ module_key: r.module_key, action: r.action, training_id: r.training_id }));
      storage.set(PERMS_CACHE_KEY, JSON.stringify({ userId: user.id, profile: this.profile, permissions: this.permissions }));
      return true;
    },

    async signIn(email, password) {
      const client = this.client();
      if (!client) throw new Error('A nuvem não está configurada. Use Configurações > Conexão com a Nuvem.');
      const { data, error } = await client.auth.signInWithPassword({ email: String(email).trim(), password });
      if (error) {
        if (/confirm/i.test(error.message)) throw new Error('Confirme o seu e-mail pelo link enviado antes de entrar.');
        if (/invalid/i.test(error.message)) throw new Error('E-mail ou senha incorretos.');
        throw new Error(error.message);
      }
      const ok = await this.loadProfile(data.user);
      if (!ok) return false;
      if (this.setup?.installed && CapacitaTE.audit) CapacitaTE.audit.log('login');
      this.finish(this.setup?.installed ? 'authenticated' : 'transition');
      return true;
    },

    async resetPassword(email) {
      const client = this.client();
      const redirectTo = window.location.href.split('#')[0];
      const { error } = await client.auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
      if (error) throw new Error(error.message);
    },

    async updatePassword(password) {
      const { error } = await this.client().auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },

    continueWithoutLogin() {
      this.profile = null;
      this.permissions = [];
      this.finish('transition');
    },

    async signOut() {
      const client = this.client();
      storage.remove(PERMS_CACHE_KEY);
      try { if (client) await client.auth.signOut(); } catch (e) { /* sessão já encerrada */ }
      window.location.hash = '';
      window.location.reload();
    },

    isAdmin() {
      return this.mode !== 'authenticated' || !!(this.profile && this.profile.is_admin);
    },

    /**
     * Mostra o usuário logado e o botão Sair na barra superior
     */
    renderUserChip() {
      const chip = document.getElementById('auth-user-chip');
      if (!chip) return;
      if (this.mode === 'authenticated' && this.user) {
        chip.style.display = 'inline-flex';
        const name = document.getElementById('auth-user-name');
        if (name) name.textContent = this.user.email + (this.profile?.is_admin ? ' · admin' : '');
      } else {
        chip.style.display = 'none';
      }
    }
  };

  CapacitaTE.auth = auth;
})();

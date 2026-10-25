/**
 * CapacitaTE - Administração › Usuários (convidar, admin, ativo, definir nova senha)
 * Versão: v.3.8.1
 */

(function () {
  CapacitaTE.adminViews = CapacitaTE.adminViews || {};

  CapacitaTE.adminViews.usuarios = async function (body) {
    const { el, toast, client, fmtDateTime, errorMessage, permissionColumns, loadUsersAndPerms, ACTION_LABELS, reload } = CapacitaTE.adminUI;
    const { users, perms } = await loadUsersAndPerms();
    const me = CapacitaTE.auth.user && CapacitaTE.auth.user.id;
    body.textContent = '';

    // Lista
    const modulesOf = (uid) => [...new Set(perms.filter(p => p.user_id === uid).map(p => p.module_key))];
    const rows = users.map(u => {
      const adminBox = el('input', { type: 'checkbox', checked: u.is_admin, 'aria-label': `Admin: ${u.email}` });
      const activeBox = el('input', { type: 'checkbox', checked: u.is_active, 'aria-label': `Ativo: ${u.email}` });
      const update = async (patch, box) => {
        box.disabled = true;
        const { error } = await client().rpc('admin_update_profile', { p_user: u.user_id, ...patch });
        box.disabled = false;
        if (error) {
          box.checked = !box.checked;
          return toast(errorMessage(error), 'error');
        }
        toast('Usuário atualizado.', 'success');
      };
      adminBox.addEventListener('change', () => update({ p_is_admin: adminBox.checked }, adminBox));
      activeBox.addEventListener('change', () => update({ p_is_active: activeBox.checked }, activeBox));
      const chips = u.is_admin
        ? [el('span', { class: 'admin-chip', text: 'todos (admin)' })]
        : modulesOf(u.user_id).map(m => el('span', { class: 'admin-chip', text: m }));
      return el('tr', {}, [
        el('td', { text: u.full_name || '—' }),
        el('td', { text: u.email }),
        el('td', { class: 'perm-col' }, adminBox),
        el('td', { class: 'perm-col' }, activeBox),
        el('td', { text: fmtDateTime(u.last_seen) }),
        el('td', {}, chips.length ? chips : el('span', { class: 'admin-muted', text: 'nenhum' }))
      ]);
    });
    body.appendChild(el('div', { class: 'glass-card', style: 'margin-bottom:1.5rem;' }, [
      el('h3', { style: 'margin:0 0 0.75rem; font-size:1rem;', text: `Usuários (${users.length})` }),
      el('div', { class: 'data-table-container' }, el('table', { class: 'data-table admin-table' }, [
        el('thead', {}, el('tr', {}, ['Nome', 'E-mail', 'Admin', 'Ativo', 'Último acesso', 'Módulos'].map((h, i) => el('th', { class: i === 2 || i === 3 ? 'perm-col' : null, text: h })))),
        el('tbody', {}, rows)
      ])),
      el('p', { class: 'admin-muted', style: 'margin:0.75rem 0 0;', text: 'Desativar bloqueia o acesso sem apagar nada. Não há exclusão de usuário pela tela. O último admin ativo não pode ser rebaixado nem desativado.' })
    ]));

    // Convidar
    const name = el('input', { type: 'text', class: 'form-control', id: 'admin-invite-name', autocomplete: 'off' });
    const email = el('input', { type: 'email', class: 'form-control', id: 'admin-invite-email', autocomplete: 'off' });
    const permBoxes = permissionColumns().map(c => {
      const box = el('input', { type: 'checkbox', 'data-module': c.module_key, 'data-action': c.action });
      return { c, box, label: el('label', { style: 'display:inline-flex; align-items:center; gap:0.35rem; margin-right:1rem; font-size:0.85rem;' }, [box, `${c.moduleTitle}: ${ACTION_LABELS[c.action] || c.action}`]) };
    });
    const inviteMsg = el('p', { class: 'auth-message', style: 'text-align:left;' });
    const inviteBtn = el('button', { type: 'submit', class: 'btn btn-primary btn-sm', text: 'Enviar convite' });
    const inviteForm = el('form', { novalidate: true }, [
      el('div', { class: 'admin-form-grid' }, [
        el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: 'admin-invite-name', text: 'Nome' }), name]),
        el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: 'admin-invite-email', text: 'E-mail' }), email])
      ]),
      el('p', { class: 'form-label', style: 'margin:1rem 0 0.4rem;', text: 'Permissões iniciais' }),
      el('div', {}, permBoxes.map(p => p.label)),
      el('div', { style: 'margin-top:1rem;' }, inviteBtn),
      inviteMsg
    ]);
    inviteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        inviteMsg.className = 'auth-message auth-message-error';
        inviteMsg.textContent = 'Informe um e-mail válido.';
        return;
      }
      inviteBtn.disabled = true;
      inviteMsg.className = 'auth-message';
      inviteMsg.textContent = 'Enviando convite...';
      const { data, error } = await client().functions.invoke('admin-invite-user', {
        body: {
          action: 'invite', email: email.value.trim(), full_name: name.value.trim(),
          redirect_to: window.location.href.split('#')[0],
          permissions: permBoxes.filter(p => p.box.checked).map(p => ({ module_key: p.c.module_key, action: p.c.action }))
        }
      });
      inviteBtn.disabled = false;
      if (error || (data && data.error)) {
        inviteMsg.className = 'auth-message auth-message-error';
        inviteMsg.textContent = (data && data.error) || 'Não foi possível enviar o convite. Se a Edge Function admin-invite-user ainda não foi publicada, crie a conta em Supabase > Authentication > Users e depois atribua as permissões na aba Permissões.';
        return;
      }
      toast('Convite enviado.', 'success');
      reload('usuarios');
    });
    body.appendChild(el('div', { class: 'glass-card', style: 'margin-bottom:1.5rem;' }, [
      el('h3', { style: 'margin:0 0 0.35rem; font-size:1rem;', text: 'Convidar usuário' }),
      el('p', { class: 'admin-muted', style: 'margin:0 0 1rem;', text: 'O convidado recebe um e-mail e define a própria senha.' }),
      inviteForm
    ]));

    // Definir nova senha (as senhas nunca são exibidas: o Supabase guarda apenas o hash)
    const userSel = el('select', { class: 'form-control', id: 'admin-pwd-user' }, users.map(u => el('option', { value: u.user_id, text: `${u.full_name || u.email} (${u.email})` })));
    const pwd = el('input', { type: 'password', class: 'form-control', id: 'admin-pwd-value', autocomplete: 'new-password', minlength: '8' });
    const pwdMsg = el('p', { class: 'auth-message', style: 'text-align:left;' });
    const pwdForm = el('form', { novalidate: true }, [
      el('div', { class: 'admin-form-grid' }, [
        el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: 'admin-pwd-user', text: 'Usuário' }), userSel]),
        el('div', { class: 'form-group', style: 'margin:0;' }, [el('label', { class: 'form-label', for: 'admin-pwd-value', text: 'Nova senha (mínimo 8 caracteres)' }), pwd])
      ]),
      el('div', { style: 'margin-top:1rem;' }, el('button', { type: 'submit', class: 'btn btn-secondary btn-sm', text: 'Definir nova senha' })),
      pwdMsg
    ]);
    pwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (pwd.value.length < 8) {
        pwdMsg.className = 'auth-message auth-message-error';
        pwdMsg.textContent = 'A senha precisa ter pelo menos 8 caracteres.';
        return;
      }
      const { data, error } = await client().functions.invoke('admin-invite-user', {
        body: { action: 'set_password', user_id: userSel.value, password: pwd.value }
      });
      if (error || (data && data.error)) {
        pwdMsg.className = 'auth-message auth-message-error';
        pwdMsg.textContent = (data && data.error) || 'Não foi possível definir a senha. Verifique se a Edge Function admin-invite-user foi publicada.';
        return;
      }
      pwd.value = '';
      pwdMsg.className = 'auth-message auth-message-success';
      pwdMsg.textContent = 'Senha definida. Informe a nova senha ao usuário por um canal seguro.';
    });
    body.appendChild(el('div', { class: 'glass-card' }, [
      el('h3', { style: 'margin:0 0 0.35rem; font-size:1rem;', text: 'Definir nova senha' }),
      el('p', { class: 'admin-muted', style: 'margin:0 0 1rem;', text: 'As senhas não podem ser visualizadas (o Supabase guarda só uma versão cifrada). O admin pode definir uma nova senha para o usuário.' }),
      pwdForm
    ]));
    if (me) userSel.value = me;
  };
})();

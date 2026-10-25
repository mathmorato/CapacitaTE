/**
 * CapacitaTE - Tema das páginas públicas (claro por padrão; escuro por escolha, lembrada neste navegador)
 * Versão: v.4.3.4
 * Carregado no <head>, antes da página aparecer, para não piscar o tema errado.
 */
(function () {
  const KEY = 'capacitate_pub_theme';
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* armazenamento indisponível */ } };

  const apply = (theme) => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#161616' : '#F6A800');
    const btn = document.getElementById('pub-theme-btn');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀ Modo claro' : '☾ Modo escuro';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro');
    }
  };

  let current = read() === 'dark' ? 'dark' : 'light';
  apply(current);

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'pub-theme-btn';
    btn.className = 'pub-theme-btn';
    btn.addEventListener('click', () => {
      current = current === 'dark' ? 'light' : 'dark';
      save(current);
      apply(current);
    });
    document.body.appendChild(btn);
    apply(current);
  });
})();

/* ═══════════════════════════════════════════════════════════════════
   MultiView — interactions de la page de présentation
   Aucune dépendance : Vanilla JS, dégradation douce si une API manque.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Thème clair / sombre, mémorisé ───────────────────────────── */
  const btnTheme = $('#btn-theme');
  if (btnTheme) {
    const sync = () => btnTheme.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'light'));
    sync();
    btnTheme.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('multiview:theme', next); } catch (e) { /* stockage indisponible */ }
      sync();
    });
  }

  /* ── Menu mobile ──────────────────────────────────────────────── */
  const burger = $('#btn-burger');
  const nav = $('#site-nav');
  if (burger && nav) {
    const close = () => { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); };
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ── En-tête collant + barre de progression ───────────────────── */
  const header = $('#header');
  const bar = $('#scroll-bar');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (header) header.classList.toggle('is-stuck', y > 8);
      if (bar) bar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
      ticking = false;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Révélations à l'entrée dans le viewport ──────────────────── */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('is-in'));
  }

  /* ── Lien de navigation correspondant à la section visible ─────── */
  const links = $$('.site-nav a[href^="#"]');
  const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + visible.target.id));
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.6] });
    sections.forEach((s) => spy.observe(s));
  }

  /* ── Toast + bouton copier ────────────────────────────────────── */
  const toast = $('#toast');
  let toastTimer = null;
  const say = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
  };

  $$('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const src = $(btn.dataset.copy);
      if (!src) return;
      const text = src.textContent.trim();
      try {
        await navigator.clipboard.writeText(text);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); } catch (err) { /* copie refusée */ }
        ta.remove();
      }
      btn.classList.add('is-done');
      setTimeout(() => btn.classList.remove('is-done'), 1400);
      say('Copié dans le presse-papiers');
    });
  });

  /* ── Onglets des préréglages d'encodeur ───────────────────────── */
  const tabs = $$('.tabs [role="tab"]');
  if (tabs.length) {
    const select = (tab) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = $('#' + t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const next = tabs[(i + dir + tabs.length) % tabs.length];
        select(next); next.focus();
      });
    });
  }

  /* ── Accordéon FAQ : un seul volet ouvert ─────────────────────── */
  const accItems = $$('#acc details');
  accItems.forEach((d) => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      accItems.filter((o) => o !== d && o.open).forEach((o) => { o.open = false; });
    });
  });

  /* ── Visionneuse de capture ───────────────────────────────────── */
  const lightbox = $('#lightbox');
  const shotOpen = $('#shot-open');
  if (lightbox && shotOpen) {
    let lastFocus = null;
    const open = () => {
      lastFocus = document.activeElement;
      lightbox.hidden = false;
      document.body.classList.add('has-lightbox');
      $('#lightbox-close').focus();
    };
    const close = () => {
      lightbox.hidden = true;
      document.body.classList.remove('has-lightbox');
      if (lastFocus) lastFocus.focus();
    };
    shotOpen.addEventListener('click', open);
    $('#lightbox-close').addEventListener('click', close);
    // Clic sur l'image ou sur le fond : on ferme dans les deux cas.
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox || e.target.tagName === 'IMG') close();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lightbox.hidden) close(); });
  }

  /* ── Synchronisation avec le dépôt : version, installeur, étoiles ─
     La page lit la release la plus récente de MultiView à chaque visite.
     Les valeurs écrites dans le HTML restent le repli si l'API est
     indisponible (hors ligne, bloqueur, limite 60 requêtes/h par IP). */
  const GH = 'https://api.github.com/repos/Aeternoxx/Multiview';
  const setText = (sel, text) => { const el = $(sel); if (el && text) el.textContent = text; };

  if ('fetch' in window) {
    fetch(GH + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))))
      .then((rel) => {
        const tag = rel.tag_name || '';
        setText('#chip-version', tag);
        setText('#hero-ver', tag);

        const date = rel.published_at
          ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(rel.published_at))
          : '';
        setText('#kv-release', [tag, date].filter(Boolean).join(' · '));

        // Le seul installeur publié : c'est lui que l updater remplacera.
        const setup = (rel.assets || []).find((a) => /-setup\.exe$/i.test(a.name || ''));
        if (setup) {
          const size = Math.round(setup.size / 1048576) + ' Mo';
          setText('#kv-size', size + ' · ' + setup.name);
          setText('#cta-size', size);
          setText('#fact-size', size);
          setText('#cta-file', setup.name);
          const btn = $('#btn-dl');
          if (btn && setup.browser_download_url) btn.href = setup.browser_download_url;
        }
      })
      .catch(() => { /* valeurs du HTML conservées */ });

    fetch(GH, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('http'))))
      .then((d) => setText('#star-count [data-stars]', String(d.stargazers_count)))
      .catch(() => { /* on garde la valeur du HTML */ });
  }

  /* ── Maquette d'overlay : fenêtres flottantes de démonstration ── */
  const stage = $('#stage');
  if (stage) {
    stage.addEventListener('click', (e) => {
      const tool = e.target.closest('.tool');
      if (!tool) return;
      const card = tool.closest('.stream-card');
      if (!card) return;
      const act = tool.dataset.act;

      if (act === 'pin') {
        const on = !tool.classList.contains('is-on');
        tool.classList.toggle('is-on', on);
        tool.setAttribute('aria-pressed', String(on));
        say(on ? 'Flux épinglé au premier plan' : 'Flux désépinglé');
      }

      if (act === 'mute' || act === 'solo') {
        const on = !tool.classList.contains('is-on');
        tool.classList.toggle('is-on', on);
        tool.setAttribute('aria-pressed', String(on));
        say(act === 'mute' ? (on ? 'Son coupé' : 'Son rétabli') : (on ? 'Solo audio' : 'Solo désactivé'));
      }

      if (act === 'fs') {
        const on = !card.classList.contains('is-fs');
        card.classList.toggle('is-fs', on);
        tool.classList.toggle('is-on', on);
        tool.setAttribute('aria-pressed', String(on));
        tool.title = on ? 'Quitter le plein écran' : 'Plein écran';
        say(on ? 'Plein écran — les contrôles s’estompent' : 'Retour à la taille habituelle');
      }

      if (act === 'back') {
        const docked = card.classList.toggle('is-docked');
        tool.classList.toggle('is-on', docked);
        tool.setAttribute('aria-pressed', String(docked));
        say(docked ? 'Flux remis dans la grille Live' : 'Flux détaché sur le bureau');
      }
    });

    const btnFocus = $('#btn-focus');
    if (btnFocus) {
      btnFocus.addEventListener('click', () => {
        const on = stage.classList.toggle('is-game-focus');
        btnFocus.setAttribute('aria-pressed', String(on));
        btnFocus.textContent = on ? 'Rendre le focus à MultiView' : 'Simuler le focus du jeu';
        say(on ? 'Le jeu a le focus : fenêtres transparentes aux clics' : 'MultiView a le focus : les fenêtres sont pilotables');
      });
    }

    /* Statistiques animées : débit, i/s, gigue, images perdues. */
    const stat = {
      br: $('#stat-br'), fps: $('#stat-fps'), jit: $('#stat-jit'), drop: $('#stat-drop'), hud: $('#hud-fps')
    };
    if (!reduced && Object.values(stat).every(Boolean)) {
      const fmt = (n, d) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
      let br = 6240, fps = 60, jit = 14, drop = 0.2;
      setInterval(() => {
        br = Math.max(2800, Math.min(9000, br + (Math.random() - 0.5) * 900));
        fps = Math.max(55, Math.min(60, fps + (Math.random() - 0.5) * 1.4));
        jit = Math.max(4, Math.min(48, jit + (Math.random() - 0.5) * 7));
        drop = Math.max(0, Math.min(4, drop + (Math.random() - 0.5) * 0.5));
        stat.br.textContent = fmt(br, 0).replace(/\u202f|\u00a0/g, ' ');
        stat.fps.textContent = fmt(fps, 1);
        stat.jit.textContent = fmt(jit, 0);
        stat.drop.textContent = fmt(drop, 1);
        stat.hud.textContent = Math.round(120 + Math.random() * 48) + ' i/s';
      }, 1500);
    }
  }

  /* ── Année du pied de page ─────────────────────────────────────── */
  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();

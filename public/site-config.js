// Yasal sayfalarda gösterilen bilgiler. src/config.js ile aynı tutun.
window.SITE = {
  appName: 'TuvaletimGeldi',
  contactEmail: '', // İsteğe bağlı: e-posta yazarsanız bağlantılar e-postaya döner
  contactUrl: 'https://github.com/sinekvalesii/tuvaletimgeldi/issues',
  owner: 'TuvaletimGeldi', // TODO(yayın): adınız veya şirket unvanınız
  updated: '3 Kasım 2026',
  updatedEn: 'November 3, 2026',
};
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-site]').forEach((el) => {
    const v = window.SITE[el.dataset.site];
    if (el.tagName === 'A' && el.dataset.site === 'contactEmail') {
      const S = window.SITE;
      if (S.contactEmail) {
        el.href = 'mailto:' + S.contactEmail;
        el.textContent = S.contactEmail;
      } else {
        el.href = S.contactUrl;
        el.target = '_blank';
        el.rel = 'noopener';
        el.textContent = S.contactUrl.replace(/^https?:\/\//, '');
      }
      return;
    }
    el.textContent = v;
  });
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang') || localStorage.getItem('tg_lang') || ((navigator.language || 'tr').startsWith('tr') ? 'tr' : 'en');
  const show = (l) => {
    document.documentElement.lang = l;
    document.querySelectorAll('[data-lang]').forEach((el) => (el.hidden = el.dataset.lang !== l));
    document.querySelectorAll('[data-switch]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.switch === l)));
  };
  document.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => show(b.dataset.switch)));
  show(lang === 'en' ? 'en' : 'tr');
});

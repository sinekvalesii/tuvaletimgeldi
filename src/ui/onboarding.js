// İlk açılışta 3 adımlık tanıtım. Bittiğinde true döner (ilk açılış).
import { t } from '../i18n.js';
import { esc } from './ui.js';

const KEY = 'tg_onboarded_v1';

export function showOnboardingIfNeeded() {
  let done = false;
  try { done = localStorage.getItem(KEY) === '1'; } catch {}
  if (done) return Promise.resolve(false);

  const slides = [
    { art: '🚻', title: 'ob1Title', text: 'ob1Text' },
    { art: '🗺️', title: 'ob2Title', text: 'ob2Text' },
    { art: '📍', title: 'ob3Title', text: 'ob3Text' },
  ];
  let i = 0;
  const el = document.getElementById('onboarding');

  return new Promise((resolve) => {
    const finish = () => {
      try { localStorage.setItem(KEY, '1'); } catch {}
      el.classList.add('hidden');
      el.innerHTML = '';
      resolve(true);
    };
    const render = () => {
      const s = slides[i];
      const last = i === slides.length - 1;
      el.innerHTML = `
        <div style="display:flex;justify-content:flex-end;min-height:44px">
          ${last ? '' : `<button data-skip style="background:none;border:0;color:#fff;font-weight:600;font-size:15px;padding:10px">${esc(t('skip'))}</button>`}
        </div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;max-width:460px;margin:0 auto;width:100%">
          <div class="ob-art" aria-hidden="true">${s.art}</div>
          <h2>${esc(t(s.title))}</h2>
          <p>${esc(t(s.text))}</p>
        </div>
        <div style="max-width:460px;margin:0 auto;width:100%">
          <div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <button data-next class="btn block" style="background:#fff;color:#047857;border:0;min-height:56px;font-size:17px;border-radius:16px">${esc(last ? t('start') : t('next'))}</button>
        </div>`;
      el.querySelector('[data-skip]')?.addEventListener('click', finish);
      el.querySelector('[data-next]').addEventListener('click', () => {
        if (last) finish();
        else {
          i++;
          render();
        }
      });
    };
    el.classList.remove('hidden');
    render();
  });
}

// Ortak arayüz yardımcıları: kaçış, bildirim, diyalog, alt sayfa yığını
import { t } from '../i18n.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// ---------- Bildirim ----------
export function toast(msg, type = 'info', ms = 2800) {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ---------- Diyalog ----------
let dialogResolve = null;

export function closeDialog(value = null) {
  const d = $('#dialog');
  if (d.classList.contains('hidden')) return false;
  d.classList.add('hidden');
  d.innerHTML = '';
  const r = dialogResolve;
  dialogResolve = null;
  r?.(value);
  return true;
}

export function confirmDialog(message, { okText = t('yes'), danger = false } = {}) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    const d = $('#dialog');
    d.innerHTML = `<div class="box">
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5">${esc(message)}</p>
      <div style="display:flex;gap:10px">
        <button class="btn" style="flex:1" data-v="0">${esc(t('cancel'))}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" style="flex:1" data-v="1">${esc(okText)}</button>
      </div></div>`;
    d.classList.remove('hidden');
    d.onclick = (e) => {
      const b = e.target.closest('[data-v]');
      if (b) closeDialog(b.dataset.v === '1');
      else if (e.target === d) closeDialog(false);
    };
    d.querySelector('[data-v="1"]').focus();
  });
}

export function promptDialog(message, { type = 'text', okText = t('send'), danger = false } = {}) {
  return new Promise((resolve) => {
    dialogResolve = resolve;
    const d = $('#dialog');
    d.innerHTML = `<form class="box">
      <p style="margin:0 0 14px;font-size:16px;line-height:1.5">${esc(message)}</p>
      <input class="input" type="${type}" required style="margin-bottom:16px" autocomplete="current-password">
      <div style="display:flex;gap:10px">
        <button type="button" class="btn" style="flex:1" data-cancel>${esc(t('cancel'))}</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" style="flex:1">${esc(okText)}</button>
      </div></form>`;
    d.classList.remove('hidden');
    const form = d.querySelector('form');
    const input = form.querySelector('input');
    form.onsubmit = (e) => {
      e.preventDefault();
      closeDialog(input.value);
    };
    form.querySelector('[data-cancel]').onclick = () => closeDialog(null);
    input.focus();
  });
}

// ---------- Alt sayfa yığını ----------
// Her öğe: { render: (body) => void, onClose?: () => void }
const stack = [];

export function sheetDepth() {
  return stack.length;
}

function renderTop() {
  const body = $('#modal-body');
  const top = stack[stack.length - 1];
  if (!top) return;
  body.innerHTML = '';
  body.onclick = null; // önceki ekranın işleyicisi kalmasın
  body.scrollTop = 0;
  top.render(body);
}

export function pushSheet(view) {
  stack.push(view);
  $('#modal-sheet').classList.add('open');
  $('#backdrop').classList.add('show');
  renderTop();
}

export function replaceSheet(view) {
  if (stack.length) {
    const old = stack.pop();
    old.onClose?.();
  }
  pushSheet(view);
}

export function rerenderSheet() {
  renderTop();
}

export function popSheet() {
  const v = stack.pop();
  v?.onClose?.();
  if (stack.length) renderTop();
  else hideSheet();
}

export function closeAllSheets() {
  while (stack.length) stack.pop().onClose?.();
  hideSheet();
}

function hideSheet() {
  $('#modal-sheet').classList.remove('open');
  $('#backdrop').classList.remove('show');
  setTimeout(() => {
    if (!stack.length) $('#modal-body').innerHTML = '';
  }, 300);
}

export function sheetHeader(title, { back = false } = {}) {
  return `<div style="display:flex;align-items:center;gap:8px;margin:2px 0 14px">
    ${back ? `<button class="icon-btn" data-sheet-back aria-label="${esc(t('close'))}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>` : ''}
    <h2 style="flex:1;margin:0;font-size:20px;font-weight:800">${esc(title)}</h2>
    <button class="icon-btn" data-sheet-close aria-label="${esc(t('close'))}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
  </div>`;
}

// Genel tıklama: kapat / geri
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-sheet-close]')) closeAllSheets();
  else if (e.target.closest('[data-sheet-back]')) popSheet();
});

export function setBusy(btn, busy) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.label || btn.innerHTML;
    btn.disabled = false;
  }
}

// Fotoğrafı küçültüp JPEG'e çevirir (yükleme boyutunu azaltır)
export async function compressImage(file, maxSize = 1280, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

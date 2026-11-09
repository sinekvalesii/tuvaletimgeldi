// Alt sayfa ekranları: detay, yorum, ekleme/düzenleme, giriş, profil, bildir
import { t, getLang, setLang, applyI18n } from '../i18n.js';
import { APP, FEATURES } from '../config.js';
import { authErrorKey } from '../services/backend.js';
import { osmEditUrl } from '../services/osm.js';
import { formatDistance, walkMinutes } from '../services/geo.js';
import { navigateTo, share, haptic, isNative, platform, openExternal } from '../services/native.js';
import { adPrivacyAvailable, showAdPrivacyOptions } from '../services/ads.js';
import {
  esc,
  toast,
  pushSheet,
  popSheet,
  replaceSheet,
  closeAllSheets,
  rerenderSheet,
  sheetHeader,
  confirmDialog,
  promptDialog,
  setBusy,
  compressImage,
} from './ui.js';

export const TYPES = ['public', 'cafe', 'mall', 'station', 'mosque', 'fuel', 'park', 'other'];
const EMOJI = { public: '🚻', cafe: '☕', mosque: '🕌', mall: '🛍️', station: '🚉', fuel: '⛽', park: '🌳', other: '📍' };
export const typeEmoji = (type) => EMOJI[type] || EMOJI.other;
export const typeLabel = (type) => t('type_' + (EMOJI[type] ? type : 'other'));

const stars = (n) =>
  `<span style="color:#f59e0b" aria-label="${n}/5">${'★'.repeat(Math.round(n))}</span><span style="color:var(--border)">${'★'.repeat(5 - Math.round(n))}</span>`;

const fmtDate = (ms) =>
  ms ? new Date(ms).toLocaleDateString(getLang() === 'tr' ? 'tr-TR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Uygulama içinde yasal sayfalar web sitesinden açılır (yerel dosya harici tarayıcıda açılamaz)
const legalBase = () => (isNative ? APP.webUrl.replace(/\/$/, '') + '/' : '');
const legalHtml = (html) => html.replace(/href="(privacy|terms)\.html"/g, (_, p) => `href="${legalBase()}${p}.html"`);

function placeId(x) {
  return x.source === 'osm' ? x.id : 'c-' + x.id;
}

function canEdit(app, x) {
  const u = app.state.user;
  return !!u && x.source === 'community' && (u.isAdmin || x.addedBy === u.uid);
}

// ==================================================================
//  Detay
// ==================================================================
export function openDetail(app, x, onClose) {
  const view = {
    reviews: null,
    reviewsError: false,
    onClose,
    render(body) {
      const d = app.distanceTo(x);
      const name = x.name || typeLabel(x.type);
      const u = app.state.user;
      const attrs = [];
      if (x.fee === 'no') attrs.push(`<span class="badge good">💸 ${esc(t('free'))}</span>`);
      else if (x.fee === 'yes') attrs.push(`<span class="badge warn">💰 ${esc(t('paid'))}</span>`);
      else attrs.push(`<span class="badge">💸 ${esc(t('feeUnknown'))}</span>`);
      if (x.wheelchair === 'yes') attrs.push(`<span class="badge good">♿ ${esc(t('accessible'))}</span>`);
      if (x.wheelchair === 'no') attrs.push(`<span class="badge bad">♿ ${esc(t('notAccessible'))}</span>`);
      if (x.baby) attrs.push(`<span class="badge good">🍼 ${esc(t('babyChange'))}</span>`);

      const reviews = this.reviews;
      const avg = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
      const mine = reviews?.find((r) => r.uid === u?.uid);

      body.innerHTML = `
        <div style="display:flex;gap:12px;align-items:flex-start;margin:4px 0 14px">
          <span class="type-icon" style="width:52px;height:52px;font-size:26px" aria-hidden="true">${typeEmoji(x.type)}</span>
          <div style="flex:1;min-width:0">
            <h2 style="margin:0;font-size:21px;font-weight:800;line-height:1.25">${esc(name)}</h2>
            <div class="muted" style="font-size:14px;margin-top:3px">${esc(typeLabel(x.type))}${
              reviews?.length ? ` · ${stars(avg)} <span>${avg.toFixed(1)} (${reviews.length})</span>` : ''
            }</div>
          </div>
          <button class="icon-btn" data-sheet-close aria-label="${esc(t('close'))}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
        </div>

        <button class="btn primary block" data-act="nav" style="min-height:56px;font-size:17px;border-radius:16px">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.7 11.3 12.7 2.3a1 1 0 0 0-1.4 0l-9 9a1 1 0 0 0 0 1.4l9 9a1 1 0 0 0 1.4 0l9-9a1 1 0 0 0 0-1.4zM14 14.5V12h-4v3H8v-4a1 1 0 0 1 1-1h5V7.5l3.5 3.5z"/></svg>
          ${esc(t('navigate'))} · ${esc(formatDistance(d, t))} · ${esc(t('minWalk', { n: walkMinutes(d) }))}
        </button>

        <div style="display:flex;gap:8px;margin:10px 0 16px" class="detail-actions">
          <button class="btn" style="flex:1" data-act="share">↗ ${esc(t('share'))}</button>
          <button class="btn" style="flex:1" data-act="report">⚑ ${esc(t('report'))}</button>
          ${canEdit(app, x) ? `<button class="btn" style="flex:1" data-act="edit">✎ ${esc(t('edit'))}</button>` : ''}
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${attrs.join('')}</div>
        ${x.customersOnly ? `<p class="badge warn" style="margin:0 0 12px">${getLang() === 'tr' ? 'Sadece müşterilere açık olabilir' : 'May be for customers only'}</p>` : ''}
        ${x.openingHours ? `<p style="margin:0 0 10px;font-size:14px"><b>${esc(t('openingHours'))}:</b> <span class="muted">${esc(x.openingHours)}</span></p>` : ''}
        ${x.description ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.5;white-space:pre-line">${esc(x.description)}</p>` : ''}
        ${x.photoUrl ? `<img src="${esc(x.photoUrl)}" alt="" loading="lazy" style="width:100%;max-height:260px;object-fit:cover;border-radius:14px;margin-bottom:12px">` : ''}
        <p class="muted" style="font-size:12px;margin:0 0 18px">
          ${x.source === 'osm'
            ? `${esc(t('source_osm'))} · <a href="${esc(osmEditUrl(x))}" target="_blank" rel="noopener">${getLang() === 'tr' ? 'OSM\'de görüntüle' : 'View on OSM'}</a>`
            : `${esc(t('source_community'))}${x.addedByName ? ' · ' + esc(x.addedByName) : ''}${x.createdAt ? ' · ' + esc(fmtDate(x.createdAt)) : ''}`}
        </p>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <h3 style="margin:0;font-size:17px;font-weight:800">${esc(t('reviews'))}</h3>
          <button class="btn" style="min-height:40px" data-act="review">${esc(mine ? t('editReview') : t('writeReview'))}</button>
        </div>
        <div id="reviews">${
          reviews == null
            ? this.reviewsError
              ? `<p class="muted">${esc(t('authErr_network'))}</p>`
              : '<div style="padding:16px;text-align:center"><span class="spinner muted"></span></div>'
            : reviews.length
              ? reviews.map((r) => reviewHtml(app, r)).join('')
              : `<p class="muted" style="font-size:14px">${esc(t('noReviews'))}</p>`
        }</div>`;

      body.onclick = async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        const rv = e.target.closest('[data-review]');
        if (act === 'nav') {
          haptic('heavy');
          navigateTo(x.lat, x.lng, name);
        } else if (act === 'share') {
          const url = `${APP.webUrl}/?place=${encodeURIComponent(x.id)}&lat=${x.lat}&lng=${x.lng}`;
          try {
            const r = await share({ title: name, text: t('shareText', { name }), url });
            if (r === 'copied') toast(getLang() === 'tr' ? 'Bağlantı kopyalandı' : 'Link copied', 'success');
          } catch {}
        } else if (act === 'report') {
          openReport(app, { placeId: placeId(x), label: name });
        } else if (act === 'edit') {
          openToiletForm(app, x);
        } else if (act === 'review') {
          app.requireLogin(() => openReviewForm(app, x, mine, () => this.load()));
        } else if (rv) {
          const r = this.reviews.find((y) => y.uid === rv.dataset.review);
          if (rv.dataset.op === 'delete') {
            if (!(await confirmDialog(t('confirmDelete'), { okText: t('delete'), danger: true }))) return;
            try {
              await app.backend.deleteReview(placeId(x), r.uid);
              toast(t('reviewDeleted'), 'success');
              this.load();
            } catch {
              toast(t('authErr_generic'), 'error');
            }
          } else if (rv.dataset.op === 'report') {
            openReport(app, { placeId: placeId(x), reviewUid: r.uid, label: `${name}: ${r.comment || ''}` });
          }
        }
      };
    },
    async load() {
      try {
        this.reviews = await app.backend.getReviews(placeId(x));
        this.reviewsError = false;
      } catch (e) {
        console.warn(e);
        this.reviewsError = true;
      }
      if (current === this) rerenderSheet();
    },
  };
  let current = view;
  const origClose = view.onClose;
  view.onClose = () => {
    current = null;
    origClose?.();
  };
  replaceOrPush(view);
  view.load();
}

// Detay zaten açıksa üstüne yığmak yerine değiştir
let lastWasDetail = false;
function replaceOrPush(view) {
  closeAllSheets();
  pushSheet(view);
  lastWasDetail = true;
}

function reviewHtml(app, r) {
  const u = app.state.user;
  const mineOrAdmin = u && (u.uid === r.uid || u.isAdmin);
  const initials = (r.userName || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return `<div style="padding:12px 0;border-top:1px solid var(--border)">
    <div style="display:flex;gap:10px;align-items:center">
      <span class="avatar" style="width:34px;height:34px;font-size:13px">${esc(initials)}</span>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px">${esc(r.userName || '—')}</div>
        <div class="muted" style="font-size:12px">${stars(r.rating)} · ${esc(fmtDate(r.createdAt))}</div>
      </div>
      ${r.clean === 'yes' ? `<span class="badge good">✓ ${esc(t('clean'))}</span>` : r.clean === 'no' ? `<span class="badge bad">✗ ${esc(t('dirty'))}</span>` : ''}
    </div>
    ${r.comment ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.45;white-space:pre-line">${esc(r.comment)}</p>` : ''}
    <div style="display:flex;gap:14px;margin-top:6px;font-size:13px">
      ${mineOrAdmin ? `<button class="btn ghost" style="min-height:32px;padding:0;color:var(--urgent)" data-review="${esc(r.uid)}" data-op="delete">${esc(t('delete'))}</button>` : ''}
      ${u?.uid !== r.uid ? `<button class="btn ghost muted" style="min-height:32px;padding:0;font-weight:500" data-review="${esc(r.uid)}" data-op="report">${esc(t('report'))}</button>` : ''}
    </div>
  </div>`;
}

// ==================================================================
//  Yorum formu
// ==================================================================
function openReviewForm(app, x, existing, onSaved) {
  let rating = existing?.rating || 0;
  let clean = existing?.clean || null;
  pushSheet({
    render(body) {
      body.innerHTML = `${sheetHeader(existing ? t('editReview') : t('writeReview'), { back: true })}
        <p class="muted" style="margin:-8px 0 16px">${esc(x.name || typeLabel(x.type))}</p>
        <form id="review-form">
          <div class="field"><span>${esc(t('yourRating'))}</span>
            <div class="stars" role="radiogroup">${[1, 2, 3, 4, 5]
              .map((n) => `<button type="button" role="radio" aria-checked="${n === rating}" aria-label="${n}" data-star="${n}" class="${n <= rating ? 'on' : ''}">★</button>`)
              .join('')}</div>
          </div>
          <div class="field"><span>${esc(t('wasClean'))}</span>
            <div class="seg" data-seg="clean">
              <button type="button" data-v="yes" aria-pressed="${clean === 'yes'}">${esc(t('yes'))}</button>
              <button type="button" data-v="no" aria-pressed="${clean === 'no'}">${esc(t('no'))}</button>
            </div>
          </div>
          <label class="field"><span>${esc(t('yourComment'))}</span>
            <textarea class="input" name="comment" maxlength="500" placeholder="${esc(t('commentPlaceholder'))}">${esc(existing?.comment || '')}</textarea>
          </label>
          <button class="btn primary block" style="min-height:52px">${esc(t('send'))}</button>
        </form>`;
      const form = body.querySelector('#review-form');
      form.onclick = (e) => {
        const s = e.target.closest('[data-star]');
        if (s) {
          rating = +s.dataset.star;
          haptic('light');
          form.querySelectorAll('[data-star]').forEach((b) => {
            b.classList.toggle('on', +b.dataset.star <= rating);
            b.setAttribute('aria-checked', String(+b.dataset.star === rating));
          });
        }
        const seg = e.target.closest('[data-seg="clean"] [data-v]');
        if (seg) {
          clean = clean === seg.dataset.v ? null : seg.dataset.v;
          form.querySelectorAll('[data-seg="clean"] [data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === clean)));
        }
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (!rating) return toast(t('ratingRequired'), 'error');
        const btn = form.querySelector('button.primary');
        setBusy(btn, true);
        try {
          await app.backend.saveReview(placeId(x), { rating, comment: form.comment.value.trim().slice(0, 500), clean });
          toast(t('reviewSaved'), 'success');
          popSheet();
          onSaved();
        } catch (err) {
          console.warn(err);
          toast(t('authErr_generic'), 'error');
          setBusy(btn, false);
        }
      };
    },
  });
}

// ==================================================================
//  Bildir
// ==================================================================
function openReport(app, target) {
  const reasons = ['wrong', 'closed', 'spam', 'offensive'];
  pushSheet({
    render(body) {
      body.innerHTML = `${sheetHeader(t('reportTitle'), { back: true })}
        <div style="display:flex;flex-direction:column;gap:8px">
          ${reasons.map((r) => `<button class="btn block" style="justify-content:flex-start" data-reason="${r}">${esc(t('reason_' + r))}</button>`).join('')}
        </div>`;
      body.onclick = async (e) => {
        const b = e.target.closest('[data-reason]');
        if (!b) return;
        setBusy(b, true);
        try {
          await app.backend.report({ ...target, reason: b.dataset.reason });
          toast(t('reportSent'), 'success');
          popSheet();
        } catch (err) {
          console.warn(err);
          toast(t('authErr_generic'), 'error');
          setBusy(b, false);
        }
      };
    },
  });
}

// ==================================================================
//  Tuvalet ekle / düzenle
// ==================================================================
export async function openAddFlow(app) {
  const loc = await app.pickLocation(app.state.userPos);
  if (loc) openToiletForm(app, null, loc);
}

function openToiletForm(app, existing, loc) {
  const data = existing
    ? { name: existing.name, type: existing.type, lat: existing.lat, lng: existing.lng, fee: existing.fee, wheelchair: existing.wheelchair, baby: existing.baby, description: existing.description }
    : { name: '', type: 'public', lat: loc.lat, lng: loc.lng, fee: null, wheelchair: null, baby: false, description: '' };
  let photo = null;
  let photoPreview = existing?.photoUrl || '';

  const view = {
    render(body) {
      const seg = (key, opts) =>
        `<div class="seg" data-seg="${key}">${opts
          .map(([v, label]) => `<button type="button" data-v="${v}" aria-pressed="${String(data[key]) === String(v)}">${esc(label)}</button>`)
          .join('')}</div>`;
      body.innerHTML = `${sheetHeader(existing ? t('editTitle') : t('addTitle'))}
        <form id="toilet-form" novalidate>
          <label class="field"><span>${esc(t('name'))} *</span>
            <input class="input" name="name" maxlength="80" required value="${esc(data.name)}" placeholder="${esc(t('namePlaceholder'))}">
          </label>
          <div class="field"><span>${esc(t('type'))}</span>
            <div style="display:flex;flex-wrap:wrap;gap:6px" data-types>
              ${TYPES.map((ty) => `<button type="button" class="chip" style="box-shadow:none" data-type="${ty}" aria-pressed="${data.type === ty}">${typeEmoji(ty)} ${esc(typeLabel(ty))}</button>`).join('')}
            </div>
          </div>
          <div class="field"><span>${esc(t('fee'))}</span>${seg('fee', [['no', t('feeFree')], ['yes', t('feePaid')], ['null', t('feeUnknownShort')]])}</div>
          <div class="field"><span>${esc(t('accessibleQ'))}</span>${seg('wheelchair', [['yes', t('yes')], ['no', t('no')], ['null', t('feeUnknownShort')]])}</div>
          <div class="field"><span>${esc(t('babyQ'))}</span>${seg('baby', [['true', t('yes')], ['false', t('no')]])}</div>
          <label class="field"><span>${esc(t('description'))}</span>
            <textarea class="input" name="description" maxlength="500" placeholder="${esc(t('descriptionPlaceholder'))}">${esc(data.description)}</textarea>
          </label>
          <div class="field ${FEATURES.photos ? '' : 'hidden'}"><span>${esc(t('photo'))}</span>
            <label class="btn block" style="border-style:dashed">
              <input type="file" accept="image/*" name="photo" class="hidden">
              📷 ${esc(t('addPhoto'))}
            </label>
            <img id="photo-prev" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:12px;margin-top:8px" class="${photoPreview ? '' : 'hidden'}" src="${esc(photoPreview)}">
          </div>
          <div class="field">
            <span>📍 ${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}</span>
            ${existing ? `<button type="button" class="btn block" data-act="move">${getLang() === 'tr' ? 'Konumu değiştir' : 'Change location'}</button>` : ''}
          </div>
          <button class="btn primary block" style="min-height:52px">${esc(existing ? t('save') : t('send'))}</button>
          ${existing ? `<button type="button" class="btn danger block" style="margin-top:10px" data-act="delete">${esc(t('delete'))}</button>` : ''}
        </form>`;

      const form = body.querySelector('#toilet-form');
      const syncFromForm = () => {
        data.name = form.name.value;
        data.description = form.description.value;
      };
      form.onclick = async (e) => {
        const ty = e.target.closest('[data-type]');
        if (ty) {
          data.type = ty.dataset.type;
          form.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === data.type)));
        }
        const sb = e.target.closest('[data-seg] [data-v]');
        if (sb) {
          const key = sb.parentElement.dataset.seg;
          const v = sb.dataset.v;
          data[key] = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : v;
          sb.parentElement.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b === sb)));
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'move') {
          syncFromForm();
          const p = await app.pickLocation({ lat: data.lat, lng: data.lng });
          if (p) Object.assign(data, p);
          pushSheet(view);
        } else if (act === 'delete') {
          if (!(await confirmDialog(t('confirmDelete'), { okText: t('delete'), danger: true }))) return;
          try {
            await app.backend.deleteToilet(existing);
            app.state.community = app.state.community.filter((c) => c.id !== existing.id);
            toast(t('toiletDeleted'), 'success');
            closeAllSheets();
            app.refresh(true);
          } catch (err) {
            console.warn(err);
            toast(t('authErr_generic'), 'error');
          }
        }
      };
      form.photo.onchange = async () => {
        const f = form.photo.files[0];
        if (!f) return;
        photo = await compressImage(f, 1280, 0.8);
        photoPreview = URL.createObjectURL(photo);
        const img = body.querySelector('#photo-prev');
        img.src = photoPreview;
        img.classList.remove('hidden');
      };
      form.onsubmit = async (e) => {
        e.preventDefault();
        syncFromForm();
        const name = data.name.trim();
        if (!name) {
          form.name.focus();
          return toast(t('nameRequired'), 'error');
        }
        const payload = {
          name: name.slice(0, 80),
          type: data.type,
          lat: data.lat,
          lng: data.lng,
          fee: data.fee,
          wheelchair: data.wheelchair,
          baby: !!data.baby,
          description: data.description.trim().slice(0, 500),
        };
        const btn = form.querySelector('button.primary');
        setBusy(btn, true);
        try {
          if (existing) {
            await app.backend.updateToilet(existing.id, payload, photo, existing.addedBy);
            toast(t('toiletUpdated'), 'success');
          } else {
            await app.backend.addToilet(payload, photo);
            toast(t('toiletAdded'), 'success');
            haptic('heavy');
          }
          closeAllSheets();
          app.refresh(true);
        } catch (err) {
          console.warn(err);
          toast(err?.message === 'storage-full' ? (getLang() === 'tr' ? 'Cihaz depolaması dolu' : 'Device storage full') : t('authErr_generic'), 'error');
          setBusy(btn, false);
        }
      };
    },
  };
  if (existing) pushSheet(view);
  else replaceSheet(view);
}

// ==================================================================
//  Giriş / kayıt
// ==================================================================
export function openAuth(app, next) {
  let mode = 'login';
  const view = {
    render(body) {
      body.innerHTML = `${sheetHeader(mode === 'login' ? t('login') : t('register'))}
        <div class="seg" style="margin-bottom:18px">
          <button type="button" data-mode="login" aria-pressed="${mode === 'login'}">${esc(t('login'))}</button>
          <button type="button" data-mode="register" aria-pressed="${mode === 'register'}">${esc(t('register'))}</button>
        </div>
        ${app.backend.mode === 'demo' ? `<p class="badge warn" style="margin:0 0 14px;white-space:normal">${esc(t('demoMode'))}</p>` : ''}
        <form id="auth-form" novalidate>
          ${mode === 'register' ? `<label class="field"><span>${esc(t('displayName'))}</span><input class="input" name="name" maxlength="40" autocomplete="nickname" required></label>` : ''}
          <label class="field"><span>${esc(t('email'))}</span><input class="input" name="email" type="email" autocomplete="email" inputmode="email" required></label>
          <label class="field"><span>${esc(t('password'))}</span><input class="input" name="password" type="password" minlength="6" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required placeholder="${mode === 'register' ? esc(t('passwordHint')) : ''}"></label>
          ${mode === 'register' ? `<label style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px;font-size:14px;line-height:1.45"><input type="checkbox" name="terms" style="width:20px;height:20px;margin-top:1px;accent-color:var(--brand)"><span>${legalHtml(t('acceptTerms'))}</span></label>` : ''}
          <button class="btn primary block" style="min-height:52px">${esc(mode === 'login' ? t('login') : t('register'))}</button>
          ${mode === 'login' ? `<button type="button" class="btn ghost block" data-forgot style="margin-top:6px">${esc(t('forgotPassword'))}</button>` : ''}
        </form>`;

      body.querySelectorAll('[data-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          mode = b.dataset.mode;
          rerenderSheet();
        }),
      );
      const form = body.querySelector('#auth-form');
      body.querySelector('[data-forgot]')?.addEventListener('click', async () => {
        const email = form.email.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
          form.email.focus();
          return toast(t('authErr_email'), 'error');
        }
        try {
          await app.backend.resetPassword(email);
          toast(t('resetSent'), 'success', 4000);
        } catch (err) {
          toast(t(authErrorKey(err)), 'error');
        }
      });
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = form.email.value.trim();
        const pw = form.password.value;
        if (mode === 'register' && !form.name.value.trim()) return toast(t('authErr_name'), 'error');
        if (!/^\S+@\S+\.\S+$/.test(email)) return toast(t('authErr_email'), 'error');
        if (pw.length < 6) return toast(t('authErr_weak'), 'error');
        if (mode === 'register' && !form.terms.checked) return toast(t('mustAcceptTerms'), 'error');
        const btn = form.querySelector('button.primary');
        setBusy(btn, true);
        try {
          const u =
            mode === 'login'
              ? await app.backend.login(email, pw)
              : await app.backend.register(form.name.value.trim().slice(0, 40), email, pw);
          app.state.user = u;
          app.renderAvatar();
          toast(t('welcome', { name: u.displayName }), 'success');
          closeAllSheets();
          next?.();
        } catch (err) {
          console.warn(err);
          toast(t(authErrorKey(err)), 'error');
          setBusy(btn, false);
        }
      };
    },
  };
  closeAllSheets();
  pushSheet(view);
}

// ==================================================================
//  Profil ve ayarlar
// ==================================================================
const THEME_KEY = 'tg_theme';
export function applyTheme() {
  let pref = 'auto';
  try { pref = localStorage.getItem(THEME_KEY) || 'auto'; } catch {}
  const dark = pref === 'dark' || (pref === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1210' : '#059669');
  return pref;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

export function openProfile(app) {
  const view = {
    stats: null,
    reports: null,
    render(body) {
      const u = app.state.user;
      let theme = 'auto';
      try { theme = localStorage.getItem(THEME_KEY) || 'auto'; } catch {}
      const initials = u ? (u.displayName || '?').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() : '';
      const link = (href, label, ext = true) =>
        `<a class="row" href="${esc(href)}" ${ext ? 'target="_blank" rel="noopener"' : ''} style="text-decoration:none;color:inherit"><span style="flex:1">${esc(label)}</span><span class="muted">›</span></a>`;

      body.innerHTML = `${sheetHeader(t('profile'))}
        ${u
          ? `<div style="display:flex;gap:14px;align-items:center;margin-bottom:16px">
              <span class="avatar" style="width:60px;height:60px;font-size:22px">${esc(initials)}</span>
              <div style="min-width:0">
                <div style="font-weight:800;font-size:18px">${esc(u.displayName)} ${u.isAdmin ? `<span class="badge warn">${esc(t('admin'))}</span>` : ''}</div>
                <div class="muted" style="font-size:14px;overflow:hidden;text-overflow:ellipsis">${esc(u.email)}</div>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:18px">
              <div style="flex:1;background:var(--surface-2);border-radius:14px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800">${this.stats ? this.stats.toilets : '–'}</div><div class="muted" style="font-size:13px">${esc(t('toiletsAdded'))}</div></div>
              <div style="flex:1;background:var(--surface-2);border-radius:14px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800">${this.stats ? this.stats.reviews : '–'}</div><div class="muted" style="font-size:13px">${esc(t('reviewsWritten'))}</div></div>
            </div>`
          : `<div style="background:var(--surface-2);border-radius:16px;padding:16px;margin-bottom:18px">
              <div style="font-weight:800;font-size:17px;margin-bottom:4px">${esc(t('guest'))}</div>
              <p class="muted" style="margin:0 0 12px;font-size:14px">${esc(t('guestHint'))}</p>
              <button class="btn primary block" data-act="login">${esc(t('login'))} / ${esc(t('register'))}</button>
            </div>`}

        ${u?.isAdmin ? `<h3 style="font-size:15px;margin:0 0 8px">${esc(t('reportsTitle'))}</h3><div id="reports" style="margin-bottom:18px">${renderReports(this.reports)}</div>` : ''}

        <h3 style="font-size:15px;margin:0 0 8px">${esc(t('settings'))}</h3>
        <div class="field"><span>${esc(t('language'))}</span>
          <div class="seg" data-seg="lang">
            <button type="button" data-v="tr" aria-pressed="${getLang() === 'tr'}">Türkçe</button>
            <button type="button" data-v="en" aria-pressed="${getLang() === 'en'}">English</button>
          </div>
        </div>
        <div class="field"><span>${esc(t('theme'))}</span>
          <div class="seg" data-seg="theme">
            <button type="button" data-v="auto" aria-pressed="${theme === 'auto'}">${esc(t('themeAuto'))}</button>
            <button type="button" data-v="light" aria-pressed="${theme === 'light'}">${esc(t('themeLight'))}</button>
            <button type="button" data-v="dark" aria-pressed="${theme === 'dark'}">${esc(t('themeDark'))}</button>
          </div>
        </div>

        <div style="margin:6px -8px 12px">
          ${adPrivacyAvailable() ? `<button class="row" data-act="adprivacy"><span style="flex:1">${esc(t('adPrivacy'))}</span><span class="muted">›</span></button>` : ''}
          ${link(legalBase() + 'privacy.html', t('privacyPolicy'))}
          ${link(legalBase() + 'terms.html', t('terms'))}
          ${APP.contactEmail ? link('mailto:' + APP.contactEmail, t('contact'), false) : link(APP.contactUrl, t('contact'))}
          ${isNative && platform === 'android' ? `<button class="row" data-act="rate"><span style="flex:1">${esc(t('rateApp'))} ⭐</span><span class="muted">›</span></button>` : ''}
        </div>

        ${u
          ? `<button class="btn block" data-act="logout" style="margin-bottom:10px">${esc(t('logout'))}</button>
             <button class="btn danger block" data-act="delete">${esc(t('deleteAccount'))}</button>`
          : ''}
        <p class="muted" style="text-align:center;font-size:12px;margin:18px 0 0">${esc(APP.name)} · ${esc(t('version'))} ${esc(APP.version)}${app.backend.mode === 'demo' ? ' · DEMO' : ''}<br>Harita verisi © OpenStreetMap katkıcıları</p>`;

      body.onclick = async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        const segBtn = e.target.closest('[data-seg] [data-v]');
        if (segBtn) {
          const which = segBtn.parentElement.dataset.seg;
          if (which === 'lang') {
            setLang(segBtn.dataset.v);
            applyI18n();
            app.renderNearby();
          } else if (which === 'theme') {
            try { localStorage.setItem(THEME_KEY, segBtn.dataset.v); } catch {}
            applyTheme();
          }
          rerenderSheet();
          return;
        }
        const rep = e.target.closest('[data-report]');
        if (rep) return handleReport(app, this, rep.dataset.report, rep.dataset.op);
        if (act === 'login') openAuth(app);
        else if (act === 'adprivacy') showAdPrivacyOptions();
        else if (act === 'rate') openExternal(APP.playStoreUrl);
        else if (act === 'logout') {
          await app.backend.logout();
          app.state.user = null;
          app.renderAvatar();
          toast(t('loggedOut'));
          closeAllSheets();
        } else if (act === 'delete') {
          if (!(await confirmDialog(t('deleteAccountConfirm'), { okText: t('deleteAccount'), danger: true }))) return;
          const pw = await promptDialog(t('deleteAccountPassword'), { type: 'password', okText: t('delete'), danger: true });
          if (!pw) return;
          try {
            await app.backend.deleteAccount(pw);
            app.state.user = null;
            app.renderAvatar();
            closeAllSheets();
            toast(t('accountDeleted'), 'success', 4000);
            app.refresh(true);
          } catch (err) {
            console.warn(err);
            toast(t(authErrorKey(err)), 'error');
          }
        }
      };
    },
  };
  closeAllSheets();
  pushSheet(view);
  if (app.state.user) {
    app.backend.myStats().then((s) => {
      view.stats = s;
      rerenderSheet();
    }).catch(() => {});
    if (app.state.user.isAdmin) {
      app.backend.listReports().then((r) => {
        view.reports = r;
        rerenderSheet();
      }).catch((e) => {
        console.warn(e);
        view.reports = [];
        rerenderSheet();
      });
    }
  }
}

function renderReports(reports) {
  if (reports == null) return '<span class="spinner muted"></span>';
  if (!reports.length) return `<p class="muted" style="font-size:14px;margin:0">${esc(t('noReports'))}</p>`;
  return reports
    .map(
      (r) => `<div style="background:var(--surface-2);border-radius:12px;padding:10px 12px;margin-bottom:8px">
      <div style="font-weight:700;font-size:14px">${esc(t('reason_' + r.reason))}${r.reviewUid ? ' · ' + esc(t('reviews')) : ''}</div>
      <div class="muted" style="font-size:13px;margin:2px 0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.label || r.placeId)}</div>
      <div style="display:flex;gap:6px">
        <button class="btn" style="min-height:36px;flex:1;font-size:13px" data-report="${esc(r.id)}" data-op="show">${getLang() === 'tr' ? 'Göster' : 'Show'}</button>
        <button class="btn danger" style="min-height:36px;flex:1;font-size:13px" data-report="${esc(r.id)}" data-op="remove">${r.reviewUid || r.placeId.startsWith('c-') ? esc(t('delete')) : getLang() === 'tr' ? 'Gizle' : 'Hide'}</button>
        <button class="btn" style="min-height:36px;flex:1;font-size:13px" data-report="${esc(r.id)}" data-op="dismiss">${esc(t('dismiss'))}</button>
      </div></div>`,
    )
    .join('');
}

async function handleReport(app, view, id, op) {
  const r = view.reports.find((x) => x.id === id);
  if (!r) return;
  const toiletId = r.placeId.startsWith('c-') ? r.placeId.slice(2) : r.placeId;
  try {
    if (op === 'show') {
      const x = app.findToilet(toiletId) || (r.placeId.startsWith('c-') ? await app.backend.getToilet(toiletId) : null);
      if (x) {
        closeAllSheets();
        app.focusOn(x.lat, x.lng, 18);
      } else toast(getLang() === 'tr' ? 'İçerik bulunamadı (silinmiş olabilir)' : 'Not found (may be deleted)');
      return;
    }
    if (op === 'remove') {
      if (!(await confirmDialog(t('confirmDelete'), { okText: t('delete'), danger: true }))) return;
      if (r.reviewUid) await app.backend.deleteReview(r.placeId, r.reviewUid);
      else if (r.placeId.startsWith('c-')) {
        const x = (await app.backend.getToilet(toiletId)) || { id: toiletId };
        await app.backend.deleteToilet(x);
        app.state.community = app.state.community.filter((c) => c.id !== toiletId);
      } else {
        await app.backend.hidePlace(r.placeId);
        app.state.hidden.add(r.placeId);
      }
      app.refresh(true);
    }
    await app.backend.resolveReport(id);
    view.reports = view.reports.filter((x) => x.id !== id);
    rerenderSheet();
  } catch (e) {
    console.warn(e);
    toast(t('authErr_generic'), 'error');
  }
}

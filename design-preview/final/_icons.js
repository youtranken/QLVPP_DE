window.ICONS = {
  pen: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 38 40 8l8 8-30 30H10z"/><path d="M36 12l8 8"/></svg>',
  note: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M14 8h36v26l-8 8H14z"/><path d="M42 42v-8h8"/><path d="M22 20h20M22 28h12"/></svg>',
  clip: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M40 14 22 32a6 6 0 0 0 8 8l20-20a10 10 0 0 0-14-14L16 26a14 14 0 0 0 20 20l12-12"/></svg>',
  tape: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="30" cy="24" r="16"/><circle cx="30" cy="24" r="6"/><path d="M46 24h10v8H40"/></svg>',
  paper: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M18 6h22l8 8v28H18z"/><path d="M40 6v8h8"/><path d="M24 24h16M24 32h16"/></svg>',
  book: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M14 8h26a6 6 0 0 1 6 6v28H20a6 6 0 0 1-6-6z"/><path d="M14 36a6 6 0 0 1 6-6h26"/></svg>',
  stapler: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M10 34h44v6H10z"/><path d="M12 34 46 14l6 6-24 14"/></svg>',
  marker: '<svg viewBox="0 0 64 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M14 30h26l10-6v-8H14z"/><path d="M14 30v6h26v-6"/></svg>',
};
window.ITEMS = [
  { name: 'Bút bi xanh Thiên Long', unit: 'cây', icon: 'pen', qty: 10, max: 20 },
  { name: 'Giấy note vàng 3×3', unit: 'xếp', icon: 'note', qty: 3, max: 20 },
  { name: 'Kẹp giấy 33 mm', unit: 'hộp', icon: 'clip', qty: 2, max: 10 },
  { name: 'Băng keo trong 5 cm', unit: 'cuộn', icon: 'tape', qty: 0, max: 20 },
  { name: 'Sổ lò xo A5', unit: 'cuốn', icon: 'book', qty: 0, max: 5 },
  { name: 'Bấm kim số 10', unit: 'cái', icon: 'stapler', qty: 0, max: 2 },
  { name: 'Bút dạ quang', unit: 'cây', icon: 'marker', qty: 0, max: 20 },
  { name: 'Hồ sơ lưu A4', unit: 'cái', icon: 'paper', qty: 0, max: 10 },
];
window.wireSteppers = function (root, onChange) {
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const out = b.parentElement.querySelector('output'); const max = Number(out.dataset.max || 20);
    const v = Math.min(max, Math.max(0, Number(out.textContent) + Number(b.dataset.d)));
    out.textContent = v; b.closest('[data-item]').classList.toggle('is-picked', v > 0); onChange && onChange();
  });
};

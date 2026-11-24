// Keep the light under the pointer even when a card wraps onto another line.
(() => {
  const motion = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  document.querySelectorAll('.cardLight').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!motion.matches || event.pointerType === 'touch') return;
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--light-x', (event.clientX - bounds.left) + 'px');
      card.style.setProperty('--light-y', (event.clientY - bounds.top) + 'px');
      card.dataset.lit = '';
    }, {passive: true});
    card.addEventListener('pointerleave', () => delete card.dataset.lit);
    card.addEventListener('pointercancel', () => delete card.dataset.lit);
  });
})();

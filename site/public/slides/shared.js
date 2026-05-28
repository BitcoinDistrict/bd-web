const slides = document.querySelectorAll('.slide');
let current = 0;

function showSlide(n) {
  slides[current].classList.remove('active');
  // scroll slide back to top when leaving
  slides[current].scrollTop = 0;
  current = Math.max(0, Math.min(n, slides.length - 1));
  slides[current].classList.add('active');
  document.getElementById('prevBtn').disabled = current === 0;
  document.getElementById('nextBtn').disabled = current === slides.length - 1;
  document.getElementById('slideCounter').textContent = (current + 1) + ' / ' + slides.length;
  // hide swipe hint after first navigation
  if (n !== 0) {
    const hint = document.getElementById('swipeHint');
    if (hint) hint.style.opacity = '0';
  }
}

function navigate(dir) {
  showSlide(current + dir);
}

function revealAnswer(box) {
  box.classList.add('revealed-box');
  box.querySelector('.answer-text').classList.add('revealed');
  const hint = box.querySelector('.answer-hint');
  if (hint) hint.classList.add('revealed');
}

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') navigate(1);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate(-1);
});

// Touch/swipe — only fires when horizontal motion dominates vertical
let touchStartX = 0;
let touchStartY = 0;
document.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
  const diffX = touchStartX - e.changedTouches[0].clientX;
  const diffY = touchStartY - e.changedTouches[0].clientY;
  // require horizontal motion to dominate and exceed threshold
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
    navigate(diffX > 0 ? 1 : -1);
  }
}, { passive: true });

showSlide(0);

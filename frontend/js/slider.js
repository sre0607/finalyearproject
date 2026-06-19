/*
 * Slider.js - Home Page Hero Slider Animation Controller
 * Purpose: Manages interval slides, fade transitions, and dot selections on the main dashboard banner.
 */

document.addEventListener('DOMContentLoaded', () => {
  const slides = document.querySelectorAll('.hero-slide');
  let currentSlide = 0;
  const slideIntervalTime = 6000; // 6 seconds auto-transition
  let slideInterval;

  if (slides.length > 1) {
    // Start automatic interval
    startSlideShow();

    // Create slider indicators dynamically
    createSliderDots();
  }

  function startSlideShow() {
    slideInterval = setInterval(nextSlide, slideIntervalTime);
  }

  function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slides.length;
    slides[currentSlide].classList.add('active');
    updateActiveDot();
  }

  function createSliderDots() {
    const sliderContainer = document.querySelector('.hero-slider');
    if (!sliderContainer) return;

    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'slider-dots';
    dotsContainer.style.position = 'absolute';
    dotsContainer.style.bottom = '20px';
    dotsContainer.style.left = '50%';
    dotsContainer.style.transform = 'translateX(-50%)';
    dotsContainer.style.display = 'flex';
    dotsContainer.style.gap = '10px';
    dotsContainer.style.zIndex = '10';

    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '50%';
      dot.style.backgroundColor = idx === 0 ? 'var(--secondary)' : 'rgba(255,255,255,0.5)';
      dot.style.cursor = 'pointer';
      dot.style.transition = 'background-color 0.3s';

      dot.addEventListener('click', () => {
        clearInterval(slideInterval);
        goToSlide(idx);
        startSlideShow();
      });

      dotsContainer.appendChild(dot);
    });

    sliderContainer.appendChild(dotsContainer);
  }

  function goToSlide(index) {
    slides[currentSlide].classList.remove('active');
    currentSlide = index;
    slides[currentSlide].classList.add('active');
    updateActiveDot();
  }

  function updateActiveDot() {
    const dots = document.querySelectorAll('.slider-dot');
    dots.forEach((dot, idx) => {
      dot.style.backgroundColor = idx === currentSlide ? 'var(--secondary)' : 'rgba(255,255,255,0.5)';
    });
  }
});

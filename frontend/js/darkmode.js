/*
 * Darkmode.js - Dark Mode State Controller for Florish
 * Purpose: Toggles the dark theme class on the body element and keeps choice synced with browser localStorage.
 */

// Apply theme immediately on script load to prevent light theme flash
(function initTheme() {
  const currentTheme = localStorage.getItem('florish_theme');
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
  }
})();

document.addEventListener('DOMContentLoaded', () => {
  const currentTheme = localStorage.getItem('florish_theme');
  updateToggleBtnIcon(currentTheme === 'dark');

  // Use event delegation to avoid race conditions with asynchronously loaded navbar components
  document.addEventListener('click', (e) => {
    const themeToggleBtn = e.target.closest('#theme-toggle-btn');
    if (themeToggleBtn) {
      document.documentElement.classList.toggle('dark-theme');
      
      const isDark = document.documentElement.classList.contains('dark-theme');
      localStorage.setItem('florish_theme', isDark ? 'dark' : 'light');
      updateToggleBtnIcon(isDark);
    }
  });
});

/**
 * Updates UI toggle button symbol or label
 * @param {boolean} isDark - Active theme state
 */
function updateToggleBtnIcon(isDark) {
  const iconSpan = document.querySelector('#theme-toggle-btn .toggle-icon');
  if (iconSpan) {
    iconSpan.textContent = isDark ? '☀️' : '🌙';
  }
}

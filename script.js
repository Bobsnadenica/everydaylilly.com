document.addEventListener('DOMContentLoaded', () => {
    // === Utility Functions ===
    const query = selector => document.querySelector(selector);
    const queryAll = selector => document.querySelectorAll(selector);

    const warnMissingElement = (name) => console.warn(`${name} element not found`);

    // === Constants: DOM Elements ===
    const elements = {
        titleEl: query('h1.font-display'),
        subtitleEl: query('header p'),
        androidBtnEl: query('.btn-primary span'),
        iosBtnEl: query('.btn-secondary'),
        section1Title: query('section:nth-of-type(1) h2'),
        section1Text: query('section:nth-of-type(1) p'),
        featureTitles: queryAll('.grid > div h3'),
        featureTexts: queryAll('.grid > div p'),
        galleryTitle: query('section:nth-of-type(2) h2'),
        galleryText: query('section:nth-of-type(2) p'),
        langSwitcher: query('#language-switcher'),
        btnEn: query('#lang-en'),
        btnBg: query('#lang-bg'),
        galleryItems: queryAll('.gallery-item'),
        galleryContainer: query('.gallery-container'),
        dotsContainer: query('.gallery-dots'),
        aboutTitle: query('#about-section h2'),
        aboutText: query('#about-section p'),
        faqQuestions: queryAll('#faq-section .faq-question'),
        faqAnswers: queryAll('#faq-section .faq-answer'),
        contactTitle: query('#contact-section h2'),
        contactText: query('#contact-section p'),
    };

    // === Language Button Navigation ===
    const langButtonsContainer = query('#language-buttons');
    if (langButtonsContainer) {
        langButtonsContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.id === 'lang-en') {
                window.location.href = 'index.html';
            } else if (target && target.id === 'lang-bg') {
                window.location.href = 'index-bg.html';
            }
        });
    } else {
        if (elements.btnEn) {
            elements.btnEn.addEventListener('click', () => window.location.href = 'index.html');
        }
        if (elements.btnBg) {
            elements.btnBg.addEventListener('click', () => window.location.href = 'index-bg.html');
        }
    }

    // === Lightbox Setup ===
    const galleryItems = elements.galleryItems;
    const galleryContainer = elements.galleryContainer;
    const dotsContainer = elements.dotsContainer;

    let currentIndex = 0;

    // Create lightbox elements
    const lightbox = document.createElement('div');
    lightbox.classList.add('lightbox');
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-label', 'Image lightbox');
    lightbox.setAttribute('aria-hidden', 'true');

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('lightbox-content');

    const imageElement = document.createElement('img');

    const closeBtn = document.createElement('button');
    closeBtn.classList.add('close-btn');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close lightbox');

    const lbPrev = document.createElement('button');
    lbPrev.classList.add('lightbox-nav', 'prev');
    lbPrev.innerHTML = '&#10094;';
    lbPrev.setAttribute('aria-label', 'Previous image');

    const lbNext = document.createElement('button');
    lbNext.classList.add('lightbox-nav', 'next');
    lbNext.innerHTML = '&#10095;';
    lbNext.setAttribute('aria-label', 'Next image');

    contentWrapper.appendChild(lbPrev);
    contentWrapper.appendChild(lbNext);
    contentWrapper.appendChild(imageElement);
    contentWrapper.appendChild(closeBtn);
    lightbox.appendChild(contentWrapper);
    document.body.appendChild(lightbox);

    // === Lightbox Functions ===
    function openLightbox(index) {
        currentIndex = index;
        imageElement.src = galleryItems[index].src;
        imageElement.alt = galleryItems[index].alt || '';
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        closeBtn.focus();
        updateLightboxNav();
    }

    function closeLightbox() {
        lightbox.classList.remove('open');
        lightbox.setAttribute('aria-hidden', 'true');
        imageElement.src = '';
    }

    function updateLightboxNav() {
        lbPrev.style.display = currentIndex === 0 ? 'none' : 'block';
        lbNext.style.display = currentIndex === galleryItems.length - 1 ? 'none' : 'block';
    }

    function scrollToImage(index) {
        currentIndex = index;
        const scrollLeft = galleryItems[index].offsetLeft - (galleryContainer.offsetWidth - galleryItems[index].offsetWidth) / 2;
        galleryContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        updateDots();
        updateLightboxNav();
    }

    // === Gallery Dots Setup ===
    const dots = [];
    galleryItems.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.classList.add('gallery-dot');
        if (index === 0) dot.classList.add('active');
        dot.setAttribute('aria-label', `Go to image ${index + 1}`);
        dotsContainer.appendChild(dot);
        dots.push(dot);
    });

    // Event delegation for dots
    dotsContainer.addEventListener('click', (e) => {
        const clickedDot = e.target.closest('.gallery-dot');
        if (!clickedDot) return;
        const index = dots.indexOf(clickedDot);
        if (index !== -1) scrollToImage(index);
    });

    function updateDots() {
        dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    }

    // === Gallery Item Click & Keyboard ===
    galleryItems.forEach((item, index) => {
        item.setAttribute('tabindex', '0');
        item.addEventListener('click', () => openLightbox(index));
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLightbox(index);
            }
        });
    });

    // === Lightbox Navigation ===
    lbPrev.addEventListener('click', () => {
        if (currentIndex > 0) openLightbox(currentIndex - 1);
    });

    lbNext.addEventListener('click', () => {
        if (currentIndex < galleryItems.length - 1) openLightbox(currentIndex + 1);
    });

    closeBtn.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', e => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowRight' && currentIndex < galleryItems.length - 1) openLightbox(currentIndex + 1);
        else if (e.key === 'ArrowLeft' && currentIndex > 0) openLightbox(currentIndex - 1);
    });

    // === Scroll Snap Active Dot Update ===
    if (galleryContainer) {
        galleryContainer.addEventListener('scroll', () => {
            const containerCenter = galleryContainer.scrollLeft + galleryContainer.offsetWidth / 2;
            let closestIndex = 0;
            let closestDistance = Infinity;

            galleryItems.forEach((item, i) => {
                const itemCenter = item.offsetLeft + item.offsetWidth / 2;
                const distance = Math.abs(containerCenter - itemCenter);
                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestIndex = i;
                }
            });

            if (closestIndex !== currentIndex) {
                currentIndex = closestIndex;
                updateDots();
                updateLightboxNav();
            }
        });
    } else warnMissingElement('Gallery container');

    // === Resize: Recalculate scroll positions ===
window.addEventListener('resize', () => scrollToImage(currentIndex));

// === App Carousel Logic ===
const cards = document.querySelectorAll('.app-card');
const nextBtn = document.getElementById('carousel-next');
const prevBtn = document.getElementById('carousel-prev');
let current = 0;

function updateCarousel() {
  cards.forEach((card, index) => {
    card.classList.remove('active', 'prev', 'next');
    if (index === current) {
      card.classList.add('active');
    } else if (index === (current + 1) % cards.length) {
      card.classList.add('next');
    } else if (index === (current - 1 + cards.length) % cards.length) {
      card.classList.add('prev');
    }
  });
}

nextBtn?.addEventListener('click', () => {
  current = (current + 1) % cards.length;
  updateCarousel();
});

prevBtn?.addEventListener('click', () => {
  current = (current - 1 + cards.length) % cards.length;
  updateCarousel();
});

// Touch support
let startX = 0;
const carousel = document.querySelector('.app-carousel');
carousel?.addEventListener('touchstart', e => startX = e.touches[0].clientX);
carousel?.addEventListener('touchend', e => {
  const endX = e.changedTouches[0].clientX;
  if (endX - startX > 50) prevBtn?.click();
  if (startX - endX > 50) nextBtn?.click();
});

// Keyboard arrow support
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') nextBtn?.click();
  if (e.key === 'ArrowLeft') prevBtn?.click();
});

updateCarousel();
});
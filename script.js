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
        dotsContainer: query('.gallery-dots')
    };

    // === Translations ===
    const translations = {
        en: {
            title: "Everyday Lilly",
            subtitle: "Capture the daily bloom of your lily. A simple, beautiful way to watch life unfold.",
            androidBtn: "Download on Android",
            iosBtn: "Coming Soon on iOS!",
            section1Title: "A Digital Flower Journal",
            section1Text: "Everyday Lilly helps you create a beautiful photographic diary of your plant's life, from sprout to full bloom.",
            feature1Title: "Daily Photo Capture",
            feature1Text: "Take a picture every day with our simple, intuitive camera interface.",
            feature2Title: "Automatic Time-lapses",
            feature2Text: "Watch your lily grow before your eyes with automatically generated time-lapse videos.",
            feature3Title: "Helpful Reminders",
            feature3Text: "Set daily notifications so you never miss a moment of your lily's growth.",
            galleryTitle: "Your Personal Gallery",
            galleryText: "All your photos are organized in a beautiful, easy-to-browse gallery. Click on any picture to view a larger version. Scroll through the days and relive your lily's journey from a tiny sprout to a magnificent flower. Add notes to each photo to remember special moments."
        },
        bg: {
            title: "Всеки ден Лили",
            subtitle: "Записвайте ежедневното разцъфтяване на вашата лилия. Прост и красив начин да наблюдавате живота.",
            androidBtn: "Изтеглете за Android",
            iosBtn: "Скоро за iOS!",
            section1Title: "Дигитален цветен дневник",
            section1Text: "Всеки ден Лили ви помага да създадете красив фотографски дневник на живота на вашето растение, от пъпка до пълноцъфтеж.",
            feature1Title: "Ежедневно снимане",
            feature1Text: "Правете снимка всеки ден с нашия прост и интуитивен интерфейс.",
            feature2Title: "Автоматични таймлапси",
            feature2Text: "Наблюдавайте как вашата лилия расте с автоматично генерирани таймлапс видеа.",
            feature3Title: "Полезни напомняния",
            feature3Text: "Настройте ежедневни известия, за да не изпуснете нито един момент от растежа на лилията.",
            galleryTitle: "Вашата лична галерия",
            galleryText: "Всички ваши снимки са организирани в красива и лесна за разглеждане галерия. Кликнете върху всяка снимка, за да видите по-голяма версия. Прелиствате през дните и преживейте пътя на лилията от малка пъпка до величествен цвят. Добавяйте бележки към всяка снимка, за да запомните специални моменти."
        }
    };

    // Cache translation keys for features
    const featureTitleKeys = ['feature1Title', 'feature2Title', 'feature3Title'];
    const featureTextKeys = ['feature1Text', 'feature2Text', 'feature3Text'];

    // === Language Switcher ===
    function switchLanguage(lang) {
        const t = translations[lang];
        if (!t) {
            console.warn(`No translations found for language: ${lang}`);
            return;
        }

        if (elements.titleEl) elements.titleEl.textContent = t.title;
        else warnMissingElement('Title');

        if (elements.subtitleEl) elements.subtitleEl.textContent = t.subtitle;
        else warnMissingElement('Subtitle');

        if (elements.androidBtnEl) elements.androidBtnEl.textContent = t.androidBtn;
        else warnMissingElement('Android button');

        if (elements.iosBtnEl) elements.iosBtnEl.textContent = t.iosBtn;
        else warnMissingElement('iOS button');

        if (elements.section1Title) elements.section1Title.textContent = t.section1Title;
        else warnMissingElement('Section 1 title');

        if (elements.section1Text) elements.section1Text.textContent = t.section1Text;
        else warnMissingElement('Section 1 text');

        elements.featureTitles.forEach((el, i) => {
            if (el) {
                const key = featureTitleKeys[i];
                if (t[key]) el.textContent = t[key];
                else console.warn(`Missing translation for ${key}`);
            } else {
                console.warn(`Feature title element ${i + 1} not found`);
            }
        });

        elements.featureTexts.forEach((el, i) => {
            if (el) {
                const key = featureTextKeys[i];
                if (t[key]) el.textContent = t[key];
                else console.warn(`Missing translation for ${key}`);
            } else {
                console.warn(`Feature text element ${i + 1} not found`);
            }
        });

        if (elements.galleryTitle) elements.galleryTitle.textContent = t.galleryTitle;
        else warnMissingElement('Gallery title');

        if (elements.galleryText) elements.galleryText.textContent = t.galleryText;
        else warnMissingElement('Gallery text');
    }

    // Event delegation for language buttons
    const langButtonsContainer = query('#language-buttons');
    if (langButtonsContainer) {
        langButtonsContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.id && target.id.startsWith('lang-')) {
                const lang = target.id.slice(5);
                switchLanguage(lang);
            }
        });
    } else {
        // fallback to individual buttons if container not found
        if (elements.btnEn) {
            elements.btnEn.addEventListener('click', () => switchLanguage('en'));
        } else warnMissingElement('English language button');

        if (elements.btnBg) {
            elements.btnBg.addEventListener('click', () => switchLanguage('bg'));
        } else warnMissingElement('Bulgarian language button');
    }

    // Set default language
    switchLanguage('bg');

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
});
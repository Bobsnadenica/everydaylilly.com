document.addEventListener('DOMContentLoaded', async () => {
    const query = selector => document.querySelector(selector);
    const queryAll = selector => document.querySelectorAll(selector);

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
        btnEn: queryAll('#lang-en, #lang-en-mobile'),
        btnBg: queryAll('#lang-bg, #lang-bg-mobile'),
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
        elements.btnEn.forEach(button => {
            button.addEventListener('click', () => window.location.href = 'index.html');
        });
        elements.btnBg.forEach(button => {
            button.addEventListener('click', () => window.location.href = 'index-bg.html');
        });
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

    const dots = [];
    galleryItems.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.classList.add('gallery-dot');
        if (index === 0) dot.classList.add('active');
        dot.setAttribute('aria-label', `Go to image ${index + 1}`);
        dotsContainer.appendChild(dot);
        dots.push(dot);
    });

    dotsContainer.addEventListener('click', (e) => {
        const clickedDot = e.target.closest('.gallery-dot');
        if (!clickedDot) return;
        const index = dots.indexOf(clickedDot);
        if (index !== -1) scrollToImage(index);
    });

    function updateDots() {
        dots.forEach((dot, i) => dot.classList.toggle('active', i === currentIndex));
    }

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
    }

window.addEventListener('resize', () => scrollToImage(currentIndex));

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

let startX = 0;
const carousel = document.querySelector('.app-carousel');
if (window.innerWidth > 640) {
    carousel?.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    carousel?.addEventListener('touchend', e => {
      const endX = e.changedTouches[0].clientX;
      if (endX - startX > 50) prevBtn?.click();
      if (startX - endX > 50) nextBtn?.click();
    });
}

document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('open')) return;
  if (loginModal?.style.display === 'flex') return;
  if (e.key === 'ArrowRight') nextBtn?.click();
  if (e.key === 'ArrowLeft') prevBtn?.click();
});

const auth = window.EverydayLillyAuth;
const profileButtons = [...document.querySelectorAll('[data-profile-trigger]')];
const profileLabels = [...document.querySelectorAll('[data-profile-label]')];
const loginModal = document.getElementById('login-modal');
const modalClose = document.getElementById('modal-close');
const modalBackdrop = document.getElementById('modal-backdrop');
const loginForm = document.getElementById('login-form');
const loginPanel = document.getElementById('login-panel');
const accountPanel = document.getElementById('account-panel');
const accountEmail = document.getElementById('account-email');
const accountClose = document.getElementById('account-close');
const accountSignout = document.getElementById('account-signout');
const rememberMe = document.getElementById('remember-me');
const forgotPasswordButton = document.querySelector('[data-login-placeholder="forgot-password"]');
const loginSubmit = document.getElementById('login-submit');
const loginEmailInput = document.getElementById('login-email');
const loginFeedback = document.getElementById('login-feedback');
const loginSubmitIdleLabel =
  loginSubmit?.dataset.idleText || loginSubmit?.textContent?.trim() || 'Sign In';
const loginSubmitLoadingLabel =
  loginSubmit?.dataset.loadingText || 'Redirecting…';
const signedOutProfileLabel =
  profileButtons[0]?.dataset.signedOutText || profileLabels[0]?.textContent?.trim() || 'Sign In';
const signedInProfileLabel =
  profileButtons[0]?.dataset.signedInText || 'Vault';
let lastFocusedElement = null;
let currentAuthSession = null;
const HERO_MANIFEST_CACHE_MS = 10 * 60 * 1000;
const HERO_MANIFEST_CACHE_PREFIX = 'everyday-lilly.hero-manifest.';

function getHeroManifestUrl() {
    const baseDomain = document.body.dataset.galleryDomain || '';
    if (!baseDomain) return '';
    return `${baseDomain.replace(/\/+$/, '')}/api/gallery/manifest`;
}

function getHeroManifestCacheKey(session) {
    const identity = session?.claims?.sub || session?.claims?.email || 'active';
    return `${HERO_MANIFEST_CACHE_PREFIX}${identity}`;
}

function readCachedHeroManifest(session) {
    try {
        const cached = localStorage.getItem(getHeroManifestCacheKey(session));
        if (!cached) return null;

        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp > HERO_MANIFEST_CACHE_MS) return null;

        return parsed.manifest || null;
    } catch (error) {
        return null;
    }
}

function writeCachedHeroManifest(session, manifest) {
    try {
        localStorage.setItem(getHeroManifestCacheKey(session), JSON.stringify({
            timestamp: Date.now(),
            manifest,
        }));
    } catch (error) {
    }
}

function escapeCssUrl(value) {
    return String(value ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
}

function inferHeroMediaKind(photo) {
    const explicit = String(photo?.kind || '').trim().toLowerCase();
    if (explicit === 'picture' || explicit === 'gif' || explicit === 'movie') {
        return explicit;
    }

    const key = String(photo?.key || photo?.url || '').split('?')[0];
    if (/\.gif$/i.test(key)) return 'gif';
    if (/\.(m4v|mov|mp4|webm)$/i.test(key)) return 'movie';
    return 'picture';
}

function isHeroBackgroundCandidate(photo) {
    return Boolean(photo?.url) && inferHeroMediaKind(photo) !== 'movie';
}

function pickRandomHeroPhoto(manifest) {
    const heroPhotos = Array.isArray(manifest?.heroPhotos) ? manifest.heroPhotos : [];
    const photos = Array.isArray(manifest?.photos) ? manifest.photos : [];
    const candidates = [...heroPhotos, ...photos].filter(isHeroBackgroundCandidate);

    if (!candidates.length) return null;

    return candidates[Math.floor(Math.random() * candidates.length)];
}

function preloadHeroImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(src);
        image.onerror = reject;
        image.src = src;
    });
}

async function fetchHeroManifest(session) {
    const cached = readCachedHeroManifest(session);
    if (cached) return cached;

    const manifestUrl = getHeroManifestUrl();
    const token = session?.tokens?.id_token || '';
    if (!manifestUrl || !token) return null;

    const response = await fetch(manifestUrl, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
    });

    const manifest = await response.json().catch(() => null);
    if (!response.ok || !manifest) return null;

    writeCachedHeroManifest(session, manifest);
    return manifest;
}

async function applyGalleryHeroBackground(session) {
    const hero = document.querySelector('[data-gallery-hero]');
    if (!hero || !session?.tokens?.id_token) return;

    try {
        const manifest = await fetchHeroManifest(session);
        const photo = pickRandomHeroPhoto(manifest);
        if (!photo?.url) return;

        await preloadHeroImage(photo.url);
        hero.style.setProperty('--hero-bg-image', `url("${escapeCssUrl(photo.url)}")`);
        hero.classList.add('hero-has-gallery-photo');
        hero.dataset.galleryHeroSource = photo.key || 'signed-gallery-photo';
    } catch (error) {
    }
}

function setLoginFeedback(message) {
    if (!loginFeedback) return;
    if (!message) {
        loginFeedback.hidden = true;
        loginFeedback.textContent = '';
        return;
    }

    loginFeedback.hidden = false;
    loginFeedback.textContent = message;
}

function getLoginModalFocusableElements() {
    if (!loginModal) return [];
    return [...loginModal.querySelectorAll('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        .filter(element => element.offsetParent !== null);
}

function setLoginMode(mode) {
    if (loginPanel) {
        loginPanel.style.display = mode === 'login' ? 'block' : 'none';
    }

    if (accountPanel) {
        accountPanel.style.display = mode === 'account' ? 'block' : 'none';
    }
}

function updateProfileButton(session) {
    if (!profileButtons.length || !profileLabels.length) return;

    if (session) {
        profileLabels.forEach(label => {
            label.textContent = signedInProfileLabel;
        });
        profileButtons.forEach(button => {
            button.setAttribute('aria-label', signedInProfileLabel);
        });
        return;
    }

    profileLabels.forEach(label => {
        label.textContent = signedOutProfileLabel;
    });
    profileButtons.forEach(button => {
        button.setAttribute('aria-label', signedOutProfileLabel);
    });
}

function renderAuthSession(session) {
    currentAuthSession = session || null;
    updateProfileButton(currentAuthSession);

    if (accountEmail) {
        accountEmail.textContent = currentAuthSession?.claims?.email || '';
    }
}

function openLoginModal() {
    if (currentAuthSession && auth) {
        window.location.assign(auth.getGalleryDestination(currentAuthSession));
        return;
    }

    lastFocusedElement = document.activeElement;
    setLoginMode(currentAuthSession ? 'account' : 'login');
    loginModal.style.display = 'flex';
    loginModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (currentAuthSession) {
        accountClose?.focus();
        return;
    }

    setLoginFeedback('');
    loginEmailInput?.focus();
}

function closeLoginModal() {
    loginModal.style.display = 'none';
    loginModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    setLoginMode('login');

    if (loginSubmit) {
        loginSubmit.textContent = loginSubmitIdleLabel;
        loginSubmit.style.background = '#10b981';
        loginSubmit.disabled = false;
    }

    setLoginFeedback('');

    lastFocusedElement?.focus?.();
}

async function beginHostedLogin() {
    if (!auth || !loginSubmit) return;

    setLoginFeedback('');
    loginSubmit.textContent = loginSubmitLoadingLabel;
    loginSubmit.style.background = '#059669';
    loginSubmit.disabled = true;

    try {
        const result = await auth.startLogin({
            loginHint: loginEmailInput?.value?.trim() || '',
            remember: rememberMe?.checked,
            returnTo: `${window.location.pathname}${window.location.search}${window.location.hash}`,
            popup: true,
        });

        if (result?.session) {
            const session = auth.completePopupLogin(result);
            renderAuthSession(session);
            closeLoginModal();
            window.location.assign(auth.getGalleryDestination(session));
            return;
        }
    } catch (error) {
        console.error(error);
        setLoginFeedback(error.message || 'We could not finish secure sign-in.');
        loginSubmit.textContent = loginSubmitIdleLabel;
        loginSubmit.style.background = '#10b981';
        loginSubmit.disabled = false;
    }
}

profileButtons.forEach(button => {
    button.addEventListener('click', openLoginModal);
});
modalClose?.addEventListener('click', closeLoginModal);
modalBackdrop?.addEventListener('click', closeLoginModal);
accountClose?.addEventListener('click', closeLoginModal);

accountSignout?.addEventListener('click', () => {
    if (!auth) return;

    accountSignout.disabled = true;
    auth.signOut();
});

loginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    await beginHostedLogin();
});

forgotPasswordButton?.addEventListener('click', async () => {
    await beginHostedLogin();
});

document.addEventListener('keydown', e => {
    if (loginModal?.style.display !== 'flex') return;

    if (e.key === 'Escape') {
        closeLoginModal();
        return;
    }

    if (e.key !== 'Tab') return;

    const focusable = getLoginModalFocusableElements();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
        return;
    }

    if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
});

let initialSession = null;
if (auth) {
    try {
        initialSession = await auth.getSession();
    } catch (error) {
    }
}
renderAuthSession(initialSession);
applyGalleryHeroBackground(initialSession);
updateCarousel();
});

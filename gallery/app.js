(function () {
  const ROUTES = {
    months: "/gallery/months/",
    test: "/gallery/test/",
  };

  const FILTERS = [
    { id: "all", label: "Everything" },
    { id: "picture", label: "Pictures" },
    { id: "gif", label: "GIFs" },
    { id: "movie", label: "Movies" },
  ];

  const MEDIA_LABELS = {
    all: "everything",
    picture: "pictures",
    gif: "GIFs",
    movie: "movies",
  };

  const STORAGE_KEYS = {
    refresh: "everyday-lilly.gallery-refresh.",
    manifest: "everyday-lilly.gallery-manifest.",
  };

  function getStorageKey(type, collection) {
    return `${STORAGE_KEYS[type]}${collection}`;
  }

  function readCachedManifest(collection) {
    try {
      const data = localStorage.getItem(getStorageKey("manifest", collection));
      if (!data) return null;
      const parsed = JSON.parse(data);
      // Cache for 1 hour
      if (Date.now() - parsed.timestamp > 3600000) return null;
      if (!parsed.manifest?.user || typeof parsed.manifest.user.canUpload !== "boolean") return null;
      return parsed.manifest;
    } catch (e) {
      return null;
    }
  }

  function writeCachedManifest(collection, manifest) {
    try {
      localStorage.setItem(getStorageKey("manifest", collection), JSON.stringify({
        timestamp: Date.now(),
        manifest
      }));
    } catch (e) {}
  }

  function clearCachedManifest(collection) {
    try {
      localStorage.removeItem(getStorageKey("manifest", collection));
    } catch (e) {}
  }

  function normalizeCollection(value) {
    return value === "test" ? "test" : "months";
  }

  function getRequestedCollection() {
    return normalizeCollection(document.body.dataset.galleryMode || "months");
  }

  function getManifestUrl() {
    const baseDomain = document.body.dataset.galleryDomain || "";
    return `${baseDomain.replace(/\/+$/, "")}/api/gallery/manifest`;
  }

  function getUploadUrl() {
    const baseDomain = document.body.dataset.galleryDomain || "";
    return `${baseDomain.replace(/\/+$/, "")}/api/gallery/upload-url`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeCssUrl(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
  }

  function getPhotoStem(photo) {
    if (photo?.label) {
      return String(photo.label);
    }

    const key = String(photo?.key || "");
    const filename = key.split("/").pop() || key;
    return filename.replace(/\.[^.]+$/, "");
  }

  function getMonthBucket(photo) {
    const key = String(photo?.key || "");
    const nestedMonthMatch = key.match(/\/([0-9]|1[01])\/[^/]+$/);

    if (nestedMonthMatch) {
      return Number.parseInt(nestedMonthMatch[1], 10);
    }

    const stem = getPhotoStem(photo);
    const match = stem.match(/\d+/);
    return match ? Number.parseInt(match[0], 10) : 0;
  }

  function getHeroMonthBucket(photo) {
    const key = String(photo?.key || "");
    const nestedHeroMatch = key.match(/\/hero\/([0-9]|1[01])\/[^/]+$/);

    if (nestedHeroMatch) {
      return Number.parseInt(nestedHeroMatch[1], 10);
    }

    const stem = getPhotoStem(photo);
    if (/^(?:[0-9]|0[0-9]|1[01])$/.test(stem)) {
      return Number.parseInt(stem, 10);
    }

    return null;
  }

  function canUploadToGallery(state) {
    return state.actualCollection === "months" && Boolean(state.manifest?.user?.canUpload);
  }

  function getMonthHero(state, month) {
    return (state.manifest?.heroPhotos || []).find((photo) => getHeroMonthBucket(photo) === month) || null;
  }

  function getMonthPhotos(state, month) {
    return (state.manifest?.photos || [])
      .filter((photo) => getMonthBucket(photo) === month)
      .sort(comparePhotosByDate);
  }

  function comparePhotoNames(left, right) {
    const leftStem = getPhotoStem(left);
    const rightStem = getPhotoStem(right);
    const leftNumber = Number.parseInt(leftStem, 10);
    const rightNumber = Number.parseInt(rightStem, 10);
    const leftIsNumber = Number.isFinite(leftNumber);
    const rightIsNumber = Number.isFinite(rightNumber);

    if (leftIsNumber && rightIsNumber && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return leftStem.localeCompare(rightStem, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  function getPhotoTimestamp(photo) {
    const timestamp = Date.parse(photo?.lastModified || "");
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function comparePhotosByDate(left, right) {
    const leftTimestamp = getPhotoTimestamp(left);
    const rightTimestamp = getPhotoTimestamp(right);

    if (leftTimestamp !== null && rightTimestamp !== null && leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    if (leftTimestamp !== null || rightTimestamp !== null) {
      return leftTimestamp !== null ? -1 : 1;
    }

    return comparePhotoNames(left, right);
  }

  function compareMonthsPhotos(left, right) {
    const leftBucket = getMonthBucket(left);
    const rightBucket = getMonthBucket(right);

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

    return comparePhotosByDate(left, right);
  }

  function buildMonthGroups(photos) {
    const groups = new Map();

    for (let i = 0; i < 12; i++) {
      groups.set(i, []);
    }

    [...photos].sort(compareMonthsPhotos).forEach((photo) => {
      const bucket = getMonthBucket(photo);
      if (bucket >= 0 && bucket < 12) {
        groups.get(bucket).push(photo);
      }
    });

    return [...groups.entries()].map(([month, items]) => ({ month, items }));
  }

  function pickTestCardStyle(index) {
    const palette = [
      { col: 6, row: 2, tilt: -2.5, wash: "rgba(129, 140, 248, 0.2)" },
      { col: 4, row: 2, tilt: 1.8, wash: "rgba(167, 139, 250, 0.18)" },
      { col: 5, row: 1, tilt: -1.2, wash: "rgba(192, 132, 252, 0.16)" },
      { col: 3, row: 1, tilt: 2.2, wash: "rgba(96, 165, 250, 0.16)" },
      { col: 6, row: 2, tilt: -1.5, wash: "rgba(45, 212, 191, 0.16)" },
      { col: 5, row: 2, tilt: 1.1, wash: "rgba(244, 114, 182, 0.14)" },
    ];

    return palette[index % palette.length];
  }

  function isKnownMediaKind(value) {
    return value === "picture" || value === "gif" || value === "movie";
  }

  function normalizeFilterKind(value) {
    return isKnownMediaKind(value) ? value : "all";
  }

  function inferMediaKindFromKey(key) {
    if (/\.gif$/i.test(key)) {
      return "gif";
    }

    if (/\.(m4v|mov|mp4|webm)$/i.test(key)) {
      return "movie";
    }

    return "picture";
  }

  function getMediaKind(photo) {
    const explicit = String(photo?.kind || "").trim().toLowerCase();
    return isKnownMediaKind(explicit) ? explicit : inferMediaKindFromKey(photo?.key || "");
  }

  function isBackgroundCandidate(photo) {
    return Boolean(photo?.url) && getMediaKind(photo) !== "movie";
  }

  function pickGalleryBackgroundPhoto(manifest) {
    const heroPhotos = Array.isArray(manifest?.heroPhotos) ? manifest.heroPhotos.filter(isBackgroundCandidate) : [];
    const photos = Array.isArray(manifest?.photos) ? manifest.photos.filter(isBackgroundCandidate) : [];
    const candidates = heroPhotos.length ? heroPhotos : photos;

    if (!candidates.length) {
      return null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function preloadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(src);
      image.onerror = reject;
      image.src = src;
    });
  }

  function applyGalleryBackground(manifest) {
    const photo = pickGalleryBackgroundPhoto(manifest);

    if (!photo?.url) {
      document.body.classList.remove("has-vault-background");
      document.body.style.removeProperty("--vault-bg-image");
      return;
    }

    preloadImage(photo.url)
      .then(() => {
        document.body.style.setProperty("--vault-bg-image", `url("${escapeCssUrl(photo.url)}")`);
        document.body.classList.add("has-vault-background");
      })
      .catch(() => {});
  }

  function getGalleryTotal(manifest) {
    const photoCount = Array.isArray(manifest?.photos) ? manifest.photos.length : 0;
    const heroCount = Array.isArray(manifest?.heroPhotos) ? manifest.heroPhotos.length : 0;
    return photoCount + heroCount;
  }

  function pluralizeBg(count, one, many) {
    return count === 1 ? one : many;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function updateGalleryChrome(collection, manifest, session) {
    const isBg = document.documentElement.lang === "bg";
    const email = session?.claims?.email || "";
    const total = getGalleryTotal(manifest);
    const adminLabel = manifest?.user?.canUpload
      ? (isBg ? "Администратор" : "Admin")
      : (isBg ? "Преглед" : "Viewer");
    const totalLabel = isBg
      ? `${total} ${pluralizeBg(total, "спомен", "спомена")}`
      : `${total} ${pluralizeBg(total, "memory", "memories")}`;
    const cacheLabel = isBg
      ? "Случаен фон от защитената галерия"
      : "Random signed gallery background";

    setText("gallery-user", email ? `${adminLabel} · ${email}` : adminLabel);
    setText("gallery-total", totalLabel);
    setText("gallery-cache", cacheLabel);

    if (collection === "test") {
      setText("gallery-prefix", "Collection prefix: test/");
    }
  }


  function sanitizeRefreshToken(value) {
    return String(value || "")
      .trim()
      .replace(/[^A-Za-z0-9._-]/g, "")
      .slice(0, 64);
  }

  function readRefreshToken(collection) {
    try {
      return sanitizeRefreshToken(localStorage.getItem(getStorageKey("refresh", collection)));
    } catch (error) {
      return "";
    }
  }

  function writeRefreshToken(collection, value) {
    const nextValue = sanitizeRefreshToken(value);

    try {
      const key = getStorageKey("refresh", collection);
      if (nextValue) {
        localStorage.setItem(key, nextValue);
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
    }
  }

  function createRefreshToken() {
    return `manual-${Date.now()}`;
  }

  function buildMediaCounts(photos) {
    return photos.reduce(
      (counts, photo) => {
        const kind = getMediaKind(photo);
        counts.all += 1;
        counts[kind] += 1;
        return counts;
      },
      { all: 0, picture: 0, gif: 0, movie: 0 }
    );
  }

  function ensureAvailableFilter(filter, photos) {
    const counts = buildMediaCounts(photos);
    return filter === "all" || counts[filter] > 0 ? filter : "all";
  }

  function filterPhotos(photos, filter) {
    const activeFilter = normalizeFilterKind(filter);

    if (activeFilter === "all") {
      return [...photos];
    }

    return photos.filter((photo) => getMediaKind(photo) === activeFilter);
  }

  function buildMediaMarkup(photo, title, priority) {
    const kind = getMediaKind(photo);

    if (kind === "movie") {
      return `
        <div class="media-shell media-shell-video">
          <video
            src="${escapeHtml(photo.url)}"
            muted
            loop
            autoplay
            playsinline
            preload="metadata"
            aria-label="${escapeHtml(title)}"
          ></video>
          <span class="photo-play" aria-hidden="true">&#9654;</span>
        </div>
      `;
    }

    const fetchPriority = priority ? ' fetchpriority="high"' : ' fetchpriority="low"';
    const loading = priority ? ' loading="eager"' : ' loading="lazy"';

    return `
      <div class="media-shell">
        <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(title)}"${loading} decoding="async"${fetchPriority}>
      </div>
    `;
  }

  function buildPhotoCardMarkup(photo, options = {}) {
    const title = options.title || `Photo ${getPhotoStem(photo)}`;
    const caption = options.caption || photo.key;
    const showMeta = options.showMeta !== false;
    const kind = getMediaKind(photo);

    return `
      <article class="${escapeHtml(options.cardClass || "photo-card")}" style="${escapeHtml(options.style || "")}">
        <a
          class="photo-link"
          href="${escapeHtml(photo.url)}"
          data-photo-trigger
          data-photo-kind="${escapeHtml(kind)}"
          data-photo-label="${escapeHtml(title)}"
          data-photo-key="${escapeHtml(photo.key)}"
          data-photo-src="${escapeHtml(photo.url)}"
          data-photo-backdrop="${escapeHtml(kind === "movie" ? "" : photo.url)}"
          aria-label="${escapeHtml(`Open ${title}`)}"
        >
          ${buildMediaMarkup(photo, title, options.priority)}
        </a>
        ${showMeta ? `
          <div class="photo-meta">
            <p class="photo-label">${escapeHtml(title)}</p>
            <p class="photo-caption">${escapeHtml(caption)}</p>
          </div>
        ` : ""}
      </article>
    `;
  }

  const MONTH_NAMES = [
    "Месец 0", "Месец 1", "Месец 2", "Месец 3", "Месец 4", "Месец 5",
    "Месец 6", "Месец 7", "Месец 8", "Месец 9", "Месец 10", "Месец 11"
  ];

  function renderMonthOverview(content, state) {
    const allPhotos = state.manifest.photos || [];
    const adminCanUpload = canUploadToGallery(state);

    content.className = "calendar-stack";
    content.innerHTML = Array.from({ length: 12 }, (_, month) => {
        const hero = getMonthHero(state, month) || allPhotos.find(p => getMonthBucket(p) === month);
        const monthPhotos = getMonthPhotos(state, month);
        const itemCount = monthPhotos.length + (getMonthHero(state, month) ? 1 : 0);
        const countLabel = itemCount
          ? `${itemCount} ${itemCount === 1 ? "спомен" : "спомена"}`
          : (adminCanUpload ? "Готов за първа снимка" : "Очаква снимки");

        const hasPhotos = allPhotos.some(p => getMonthBucket(p) === month);
        const canOpenMonth = hasPhotos || Boolean(hero) || adminCanUpload;

        return `
          <div class="calendar-stack-card" 
               ${canOpenMonth ? `data-month-trigger="${month}"` : ""}
               style="--idx: ${month}"
               role="button" 
               aria-label="Месец ${month}">
            ${hero ? buildMediaMarkup(hero, `Месец ${month}`, month < 2) : `<div class="calendar-card-placeholder"><span>${adminCanUpload ? "Качи корица" : "Няма снимки"}</span></div>`}
            <span class="calendar-stack-name">${escapeHtml(MONTH_NAMES[month])}</span>
            <span class="calendar-stack-count">${escapeHtml(countLabel)}</span>
            <span class="calendar-stack-label">${month}</span>
          </div>
        `;
      })
      .join("");
  }

  function buildMonthUploadTileMarkup(month, uploadKind) {
    const isHero = uploadKind === "hero";
    const inputId = `month-${month}-${uploadKind}-upload`;

    return `
      <article class="photo-card month-upload-card${isHero ? " month-upload-card-hero" : ""}" data-upload-drop-zone>
        <form
          class="month-upload-form"
          data-month-upload-form
          data-upload-kind="${escapeHtml(uploadKind)}"
          data-upload-month="${month}"
        >
          <input
            class="upload-file-input"
            id="${escapeHtml(inputId)}"
            name="files"
            type="file"
            ${isHero ? "" : "multiple"}
            accept="${isHero ? "image/avif,image/gif,image/jpeg,image/png,image/webp" : "image/avif,image/gif,image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,.m4v"}"
          >
          <label class="upload-drop-label" for="${escapeHtml(inputId)}">
            <span class="upload-kicker">Admin</span>
            <span class="upload-drop-icon" aria-hidden="true">+</span>
            <span class="upload-drop-title">${isHero ? "Качи hero image" : "Upload pictures"}</span>
            <span class="upload-drop-copy">${isHero ? "Първо добави корица за този месец." : "Пусни много файлове тук или избери от компютъра."}</span>
          </label>
          <p class="upload-message" data-upload-message aria-live="polite"></p>
        </form>
      </article>
    `;
  }

  function renderMonthDetail(content, state) {
    const month = state.selectedMonth;
    const photos = getMonthPhotos(state, month);
    const hero = getMonthHero(state, month);
    const adminCanUpload = canUploadToGallery(state);
    const monthLabel = MONTH_NAMES[month];

    content.className = "month-detail";
    const photoCards = photos
      .map((photo, index) =>
        buildPhotoCardMarkup(photo, {
          title: `${monthLabel} · ${getPhotoStem(photo)}`,
          caption: photo.key,
          priority: index === 0,
          showMeta: false
        })
      )
      .join("");
    const shouldUploadHeroFirst = adminCanUpload && !hero && photos.length === 0;
    const uploadTile = adminCanUpload
      ? buildMonthUploadTileMarkup(month, shouldUploadHeroFirst ? "hero" : "photo")
      : "";

    content.innerHTML = `
      <div class="detail-header">
        <button class="btn btn-secondary" id="detail-back">← Назад</button>
        <div>
          <p class="detail-kicker">Хрониката на Лили</p>
          <h2 class="detail-title">${monthLabel}</h2>
          <p class="detail-subtitle">${photos.length} ${photos.length === 1 ? "снимка" : "снимки"}${hero ? " · има корица" : ""}</p>
        </div>
      </div>
      <div class="month-grid">${photoCards}${uploadTile}</div>
    `;

    document.getElementById("detail-back")?.addEventListener("click", () => {
      state.selectedMonth = null;
      renderGalleryState(content, null, state);
      window.scrollTo(0, 0);
    });
  }

  function renderTestGallery(content, manifest, visiblePhotos) {
    const sortedPhotos = [...visiblePhotos].sort(comparePhotosByDate);

    content.className = "test-collage";
    content.innerHTML = sortedPhotos
      .map((photo, index) => {
        const style = pickTestCardStyle(index);

        return buildPhotoCardMarkup(photo, {
          cardClass: "test-card",
          title: `Test photo ${getPhotoStem(photo)}`,
          showMeta: false,
          style: `--col-span:${style.col}; --row-span:${style.row}; --tilt:${style.tilt}deg; --accent-wash:${style.wash};`,
          priority: index < 2,
        });
      })
      .join("");
  }

  function ensureViewer() {
    let viewer = document.getElementById("gallery-viewer");

    if (viewer) {
      return viewer;
    }

    viewer = document.createElement("div");
    viewer.id = "gallery-viewer";
    viewer.className = "viewer";
    viewer.hidden = true;
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-labelledby", "viewer-title");
    viewer.innerHTML = `
      <div class="viewer-backdrop" data-viewer-close></div>
      <div class="viewer-card">
        <button class="viewer-close" type="button" aria-label="Close" data-viewer-close>&times;</button>
        <button class="viewer-nav viewer-nav-prev" type="button" aria-label="Previous" data-viewer-nav="-1">&#10094;</button>
        <button class="viewer-nav viewer-nav-next" type="button" aria-label="Next" data-viewer-nav="1">&#10095;</button>
        <div class="viewer-frame">
          <div class="viewer-stage" id="viewer-stage">
            <div class="viewer-media">
              <img id="viewer-image" alt="" hidden>
              <video id="viewer-video" playsinline controls preload="metadata" hidden></video>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(viewer);
    return viewer;
  }

  function dismissViewer() {
    const viewer = document.getElementById("gallery-viewer");

    if (!viewer) {
      return;
    }

    const viewerImage = viewer.querySelector("#viewer-image");
    const viewerVideo = viewer.querySelector("#viewer-video");
    const viewerStage = viewer.querySelector("#viewer-stage");

    viewer.hidden = true;
    document.body.style.overflow = "";

    if (viewerImage) {
      viewerImage.removeAttribute("src");
      viewerImage.hidden = true;
    }

    if (viewerVideo) {
      viewerVideo.pause();
      viewerVideo.removeAttribute("src");
      viewerVideo.load();
      viewerVideo.hidden = true;
    }

    viewerStage?.style.removeProperty("--viewer-backdrop-image");
  }

  function enableViewer(content) {
    if (content.dataset.viewerEnabled === "true") {
      return;
    }

    content.dataset.viewerEnabled = "true";

    const viewer = ensureViewer();
    const viewerStage = viewer.querySelector("#viewer-stage");
    const viewerImage = viewer.querySelector("#viewer-image");
    const viewerVideo = viewer.querySelector("#viewer-video");
    const viewerTitle = viewer.querySelector("#viewer-title");
    const viewerKey = viewer.querySelector("#viewer-key");
    const viewerOpenLink = viewer.querySelector("#viewer-open-link");
    const viewerFrame = viewer.querySelector(".viewer-frame");
    const viewerPrev = viewer.querySelector(".viewer-nav-prev");
    const viewerNext = viewer.querySelector(".viewer-nav-next");
    let lastTrigger = null;
    let currentIndex = -1;
    let touchStartX = 0;
    let touchStartY = 0;

    function getTriggers() {
      return [...content.querySelectorAll("[data-photo-trigger]")];
    }

    function updateViewerNavigation(total) {
      if (viewerPrev) {
        viewerPrev.disabled = currentIndex <= 0;
      }

      if (viewerNext) {
        viewerNext.disabled = currentIndex >= total - 1;
      }
    }

    function resetViewerVideo() {
      if (!viewerVideo) {
        return;
      }

      viewerVideo.pause();
      viewerVideo.removeAttribute("src");
      viewerVideo.load();
      viewerVideo.hidden = true;
    }

    function renderViewerAt(index) {
      const triggers = getTriggers();

      if (!triggers.length) {
        return;
      }

      currentIndex = Math.max(0, Math.min(index, triggers.length - 1));
      const trigger = triggers[currentIndex];
      const kind = normalizeFilterKind(trigger.dataset.photoKind);
      const src = trigger.dataset.photoSrc || trigger.href;
      const label = trigger.dataset.photoLabel || "Gallery item";
      const key = trigger.dataset.photoKey || "";
      const backdrop = trigger.dataset.photoBackdrop || src;
      lastTrigger = trigger;

      if (viewerTitle) {
        viewerTitle.textContent = label;
      }

      if (viewerKey) {
        viewerKey.textContent = key;
      }

      if (kind === "movie") {
        if (viewerImage) {
          viewerImage.hidden = true;
          viewerImage.removeAttribute("src");
        }

        viewerStage?.style.removeProperty("--viewer-backdrop-image");
        resetViewerVideo();

        if (viewerVideo) {
          viewerVideo.hidden = false;
          viewerVideo.src = src;
          viewerVideo.load();
          viewerVideo.play().catch(() => {});
        }
      } else {
        resetViewerVideo();

        if (viewerImage) {
          viewerImage.hidden = false;
          viewerImage.src = src;
          viewerImage.alt = label;
        }

        if (viewerStage) {
          viewerStage.style.setProperty("--viewer-backdrop-image", `url("${escapeCssUrl(backdrop)}")`);
        }
      }

      updateViewerNavigation(triggers.length);
    }

    function moveViewer(direction) {
      const triggers = getTriggers();
      const nextIndex = currentIndex + direction;

      if (nextIndex < 0 || nextIndex >= triggers.length) {
        return;
      }

      renderViewerAt(nextIndex);
    }

    function closeViewer() {
      dismissViewer();
      currentIndex = -1;
      lastTrigger?.focus?.();
    }

    function openViewer(trigger) {
      const triggers = getTriggers();
      const index = triggers.indexOf(trigger);
      renderViewerAt(index >= 0 ? index : 0);
      viewer.hidden = false;
      document.body.style.overflow = "hidden";
      viewer.querySelector(".viewer-close")?.focus();
    }

    content.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-photo-trigger]");

      if (!trigger) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }

      event.preventDefault();
      openViewer(trigger);
    });

    viewer.addEventListener("click", (event) => {
      if (event.target.closest("[data-viewer-close]")) {
        closeViewer();
        return;
      }

      const navButton = event.target.closest("[data-viewer-nav]");
      if (navButton) {
        moveViewer(Number.parseInt(navButton.dataset.viewerNav || "0", 10));
      }
    });

    viewerFrame?.addEventListener("touchstart", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    viewerFrame?.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) {
        return;
      }

      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;

      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) {
        return;
      }

      moveViewer(deltaX < 0 ? 1 : -1);
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (viewer.hidden) {
        return;
      }

      if (event.key === "Escape") {
        closeViewer();
        return;
      }

      if (event.key === "ArrowRight") {
        moveViewer(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        moveViewer(-1);
      }
    });
  }

  async function fetchManifest(session, options = {}) {
    const collection = getRequestedCollection();
    
    if (!options.refreshToken) {
      const cached = readCachedManifest(collection);
      if (cached) return cached;
    }

    const requestUrl = new URL(getManifestUrl());

    if (options.refreshToken) {
      requestUrl.searchParams.set("refresh", sanitizeRefreshToken(options.refreshToken));
    }

    const response = await fetch(requestUrl.toString(), {
      headers: {
        Authorization: `Bearer ${session.tokens?.id_token || ""}`,
      },
      cache: "no-store",
    });

    const manifest = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(manifest?.error || "The gallery backend rejected this session.");
    }

    if (manifest) {
      writeCachedManifest(collection, manifest);
    }

    return manifest;
  }

  async function requestUploadUrl(session, payload) {
    const response = await fetch(getUploadUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.tokens?.id_token || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(body?.error || "Unable to prepare this upload.");
      error.status = response.status;
      throw error;
    }

    return body;
  }

  function setUploadMessage(form, message, tone = "") {
    const messageElement = form?.querySelector("[data-upload-message]");

    if (!messageElement) {
      return;
    }

    messageElement.textContent = message || "";
    messageElement.dataset.tone = tone;
  }

  function setUploadBusy(form, isBusy) {
    form?.closest("[data-upload-drop-zone]")?.classList.toggle("is-uploading", isBusy);
    form?.querySelectorAll("input, button").forEach((control) => {
      control.disabled = isBusy;
    });
  }

  function getDroppedFiles(event) {
    return Array.from(event.dataTransfer?.files || []).filter((file) => file && file.size > 0);
  }

  function getSelectedFiles(input) {
    return Array.from(input?.files || []).filter((file) => file && file.size > 0);
  }

  async function uploadSingleFile(session, file, month, uploadKind) {
    const upload = await requestUploadUrl(session, {
      month,
      uploadKind,
      filename: file.name,
      contentType: file.type || "",
    });

    const uploadResponse = await fetch(upload.url, {
      method: "PUT",
      headers: upload.headers || {
        "Content-Type": upload.contentType || file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      const message = uploadResponse.status === 409 || uploadResponse.status === 412
        ? "Вече има файл с това име за избрания месец."
        : "S3 отказа качването. Опитай пак след малко.";
      const error = new Error(message);
      error.status = uploadResponse.status;
      throw error;
    }

    return upload;
  }

  function renderFilters(container, photos, activeFilter) {
    if (!container) {
      return;
    }

    const counts = buildMediaCounts(photos);
    const filters = FILTERS.filter((filter) => filter.id === "all" || counts[filter.id] > 0);

    container.innerHTML = filters
      .map((filter) => `
        <button
          class="filter-chip${filter.id === activeFilter ? " is-active" : ""}"
          type="button"
          data-gallery-filter="${escapeHtml(filter.id)}"
          aria-pressed="${filter.id === activeFilter ? "true" : "false"}"
        >
          <span>${escapeHtml(filter.label)}</span>
          <span class="filter-count">${counts[filter.id]}</span>
        </button>
      `)
      .join("");
  }

  function updateRefreshButton(button, isRefreshing) {
    if (!button) {
      return;
    }

    button.disabled = isRefreshing;
    button.textContent = isRefreshing ? "Опресняване..." : "Ръчно опресняване";
  }

  function applyCollectionCopy(collection, manifest, state) {
    const status = document.getElementById("gallery-status");

    if (collection === "test") {
      if (status) status.textContent = "Творческа тестова колекция";
    } else {
      if (status && state.selectedMonth === null) {
        status.textContent = "Вашите спомени, подредени по месеци.";
      }
    }
  }

  function renderGalleryState(content, status, state) {
    if (!content || !state.manifest) return;
    dismissViewer();

    if (state.actualCollection === "test") {
      const visiblePhotos = filterPhotos(state.manifest.photos || [], state.activeFilter);
      renderTestGallery(content, state.manifest, visiblePhotos);
      if (status) {
        status.textContent = `Показване на ${visiblePhotos.length} снимки.`;
      }
    } else {
      if (state.selectedMonth !== null) {
        renderMonthDetail(content, state);
        if (status) {
          status.textContent = `Преглед на ${MONTH_NAMES[state.selectedMonth]}.`;
        }
      } else {
        renderMonthOverview(content, state);
        if (status) {
          status.textContent = `Вашите спомени, подредени по месеци.`;
        }
      }
    }
  }

  async function initGalleryPage() {
    const auth = window.EverydayLillyAuth;
    const requestedCollection = getRequestedCollection();
    const signoutButton = document.getElementById("gallery-signout");
    const refreshButton = document.getElementById("gallery-refresh");
    const filterContainer = document.getElementById("gallery-media-filters");
    const status = document.getElementById("gallery-status");
    const content = document.getElementById("gallery-content");
    const userPill = document.getElementById("gallery-user");
    const state = {
      requestedCollection,
      actualCollection: requestedCollection,
      activeFilter: "all",
      refreshToken: readRefreshToken(requestedCollection),
      manifest: null,
      selectedMonth: null,
      overviewMonthIndex: new Date().getMonth(),
    };

    if (!auth) {
      if (status) status.textContent = "Системна грешка: помощникът за вход не зареди.";
      if (content) {
        content.className = "loading-state";
        content.textContent = "Моля, опитайте отново по-късно.";
      }
      return;
    }

    const session = await auth.getSession();
    if (!session) {
      window.location.replace("/");
      return;
    }

    if (signoutButton) {
      signoutButton.addEventListener("click", () => {
        auth.signOut({ logoutUri: `${window.location.origin}/` });
      });
    }

    async function loadManifest(options = {}) {
      if (refreshButton) updateRefreshButton(refreshButton, true);

      try {
        state.manifest = await fetchManifest(session, {
          refreshToken: state.refreshToken,
        });
      } catch (error) {
        if (status) status.textContent = "Грешка при зареждане на архива.";
        if (content) {
          content.className = "loading-state";
          content.textContent = error.message || "Възникна проблем. Моля, влезте отново.";
        }
        if (refreshButton) updateRefreshButton(refreshButton, false);
        return false;
      }

      const actualCollection = normalizeCollection(state.manifest.collection);
      if (state.requestedCollection !== actualCollection) {
        window.location.replace(ROUTES[actualCollection]);
        return false;
      }

      state.actualCollection = actualCollection;
      applyGalleryBackground(state.manifest);
      updateGalleryChrome(actualCollection, state.manifest, session);

      state.activeFilter = ensureAvailableFilter(state.activeFilter, state.manifest.photos || []);
      if (filterContainer) {
        const showFilters = actualCollection === "test";
        filterContainer.style.display = showFilters ? "" : "none";
        if (showFilters) {
          renderFilters(filterContainer, state.manifest.photos || [], state.activeFilter);
        }
      }
      
      renderGalleryState(content, status, state);
      if (content) {
        enableViewer(content);
      }
      if (refreshButton) updateRefreshButton(refreshButton, false);
      return true;
    }

    async function handleMonthUpload(form, files) {
      const month = Number.parseInt(form?.dataset.uploadMonth || "", 10);
      const uploadKind = form?.dataset.uploadKind === "hero" ? "hero" : "photo";
      const selectedFiles = uploadKind === "hero" ? files.slice(0, 1) : files;

      if (!Number.isInteger(month) || month < 0 || month > 11) {
        setUploadMessage(form, "Не разпознах месеца за качване.", "error");
        return;
      }

      if (!selectedFiles.length) {
        setUploadMessage(form, "Избери файл за качване.", "error");
        return;
      }

      setUploadBusy(form, true);

      if (uploadKind === "hero" && files.length > 1) {
        setUploadMessage(form, "Качваме първия файл като hero image...", "");
      } else {
        setUploadMessage(form, `Подготвяме ${selectedFiles.length} файл${selectedFiles.length === 1 ? "" : "а"}...`, "");
      }

      let uploadedCount = 0;
      let duplicateCount = 0;
      let lastError = null;

      try {
        for (let index = 0; index < selectedFiles.length; index += 1) {
          const file = selectedFiles[index];
          setUploadMessage(form, `Качване ${index + 1}/${selectedFiles.length}: ${file.name}`, "");

          try {
            await uploadSingleFile(session, file, month, uploadKind);
            uploadedCount += 1;
          } catch (error) {
            if (error.status === 409 || error.status === 412) {
              duplicateCount += 1;
              lastError = error;
              continue;
            }

            throw error;
          }
        }

        if (uploadedCount > 0) {
          const duplicateCopy = duplicateCount ? ` ${duplicateCount} вече съществува${duplicateCount === 1 ? "" : "т"}.` : "";
          setUploadMessage(form, `Готово: качени ${uploadedCount}.${duplicateCopy} Обновяваме...`, "success");
          clearCachedManifest(state.actualCollection);
          state.selectedMonth = month;
          state.refreshToken = createRefreshToken();
          writeRefreshToken(state.actualCollection, state.refreshToken);
          await loadManifest({ manualRefresh: true });
          return;
        }

        const duplicateOnly = duplicateCount > 0
          ? "Всички избрани файлове вече съществуват за този месец."
          : lastError?.message || "Качването не успя.";
        setUploadMessage(form, duplicateOnly, "error");
      } catch (error) {
        setUploadMessage(form, error.message || "Качването не успя.", "error");
      } finally {
        setUploadBusy(form, false);
        const input = form?.querySelector(".upload-file-input");
        if (input) {
          input.value = "";
        }
      }
    }

    filterContainer?.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-gallery-filter]");

      if (!filterButton || !state.manifest) {
        return;
      }

      state.activeFilter = ensureAvailableFilter(filterButton.dataset.galleryFilter, state.manifest.photos || []);
      renderFilters(filterContainer, state.manifest.photos || [], state.activeFilter);
      renderGalleryState(content, status, state);
    });

    content?.addEventListener("click", (event) => {
      const flipBtn = event.target.closest("[data-flip]");
      if (flipBtn) {
        const delta = Number.parseInt(flipBtn.dataset.flip, 10);
        state.overviewMonthIndex = Math.max(0, Math.min(11, state.overviewMonthIndex + delta));
        renderGalleryState(content, status, state);
        return;
      }

      const trigger = event.target.closest("[data-month-trigger]");
      if (trigger) {
        state.selectedMonth = Number.parseInt(trigger.dataset.monthTrigger, 10);
        renderGalleryState(content, status, state);
      }
    });

    content?.addEventListener("change", async (event) => {
      const input = event.target.closest(".upload-file-input");

      if (!input) {
        return;
      }

      const form = input.closest("[data-month-upload-form]");
      await handleMonthUpload(form, getSelectedFiles(input));
    });

    content?.addEventListener("dragenter", (event) => {
      const dropZone = event.target.closest("[data-upload-drop-zone]");

      if (!dropZone) {
        return;
      }

      event.preventDefault();
      dropZone.classList.add("is-dragover");
    });

    content?.addEventListener("dragover", (event) => {
      const dropZone = event.target.closest("[data-upload-drop-zone]");

      if (!dropZone) {
        return;
      }

      event.preventDefault();
      dropZone.classList.add("is-dragover");
    });

    content?.addEventListener("dragleave", (event) => {
      const dropZone = event.target.closest("[data-upload-drop-zone]");

      if (!dropZone || dropZone.contains(event.relatedTarget)) {
        return;
      }

      dropZone.classList.remove("is-dragover");
    });

    content?.addEventListener("drop", async (event) => {
      const dropZone = event.target.closest("[data-upload-drop-zone]");

      if (!dropZone) {
        return;
      }

      event.preventDefault();
      dropZone.classList.remove("is-dragover");
      const form = dropZone.querySelector("[data-month-upload-form]");
      await handleMonthUpload(form, getDroppedFiles(event));
    });

    refreshButton?.addEventListener("click", async () => {
      state.refreshToken = createRefreshToken();
      writeRefreshToken(state.actualCollection, state.refreshToken);
      if (status) status.textContent = "Опресняване...";
      await loadManifest({ manualRefresh: true });
    });

    await loadManifest();
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.galleryMode) {
      initGalleryPage();
    }
  });
})();

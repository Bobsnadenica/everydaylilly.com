(function () {
  const ROUTES = {
    months: "/gallery/months/",
    test: "/gallery/test/",
  };

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
    const stem = getPhotoStem(photo);
    const match = stem.match(/\d/);
    return match ? Number.parseInt(match[0], 10) : 0;
  }

  function compareMonthsPhotos(left, right) {
    const leftBucket = getMonthBucket(left);
    const rightBucket = getMonthBucket(right);

    if (leftBucket !== rightBucket) {
      return leftBucket - rightBucket;
    }

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

  function buildMonthGroups(photos) {
    const groups = new Map();

    [...photos].sort(compareMonthsPhotos).forEach((photo) => {
      const bucket = getMonthBucket(photo);

      if (!groups.has(bucket)) {
        groups.set(bucket, []);
      }

      groups.get(bucket).push(photo);
    });

    return [...groups.entries()].map(([month, items]) => ({ month, items }));
  }

  function shufflePhotos(photos) {
    const next = [...photos];

    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
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

  function buildPhotoCardMarkup(photo, options = {}) {
    const title = options.title || `Photo ${getPhotoStem(photo)}`;
    const caption = options.caption || photo.key;
    const showMeta = options.showMeta !== false;
    const priority = options.priority ? ' fetchpriority="high"' : "";

    return `
      <article class="${escapeHtml(options.cardClass || "photo-card")}" style="${escapeHtml(options.style || "")}">
        <a
          class="photo-link"
          href="${escapeHtml(photo.url)}"
          data-photo-trigger
          data-photo-label="${escapeHtml(title)}"
          data-photo-key="${escapeHtml(photo.key)}"
          data-photo-src="${escapeHtml(photo.url)}"
          aria-label="${escapeHtml(`Open ${title}`)}"
        >
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async"${priority}>
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

  function renderMonthsGallery(content, manifest) {
    const groups = buildMonthGroups(manifest.photos);

    content.className = "months-stack";
    content.innerHTML = groups
      .map(({ month, items }, groupIndex) => {
        const cards = items
          .map((photo, photoIndex) =>
            buildPhotoCardMarkup(photo, {
              title: `Month ${month} · Photo ${getPhotoStem(photo)}`,
              caption: photo.key,
              priority: groupIndex === 0 && photoIndex === 0,
            })
          )
          .join("");

        const plural = items.length === 1 ? "memory" : "memories";

        return `
          <section class="month-panel">
            <div class="month-header">
              <div>
                <span class="month-kicker">Calendar lane</span>
                <h2 class="month-title">Month ${escapeHtml(month)}</h2>
                <p class="month-note">Following your numeric naming order so 0 comes first, then 1, 11, and the rest of that month group.</p>
              </div>
              <p class="month-count">${items.length} ${plural}</p>
            </div>
            <div class="month-grid">${cards}</div>
          </section>
        `;
      })
      .join("");
  }

  function renderTestGallery(content, manifest) {
    const randomized = shufflePhotos(manifest.photos);

    content.className = "test-collage";
    content.innerHTML = randomized
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
        <button class="viewer-close" type="button" aria-label="Close image viewer" data-viewer-close>&times;</button>
        <button class="viewer-nav viewer-nav-prev" type="button" aria-label="Previous image" data-viewer-nav="-1">&#10094;</button>
        <button class="viewer-nav viewer-nav-next" type="button" aria-label="Next image" data-viewer-nav="1">&#10095;</button>
        <div class="viewer-frame">
          <img id="viewer-image" alt="">
          <div class="viewer-meta">
            <div>
              <p id="viewer-title" class="viewer-title"></p>
              <p id="viewer-key" class="viewer-key"></p>
            </div>
            <div class="viewer-actions">
              <a id="viewer-open-link" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">Open original</a>
              <button class="btn btn-primary" type="button" data-viewer-close>Back to gallery</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(viewer);
    return viewer;
  }

  function enableViewer(content) {
    const viewer = ensureViewer();
    const viewerImage = viewer.querySelector("#viewer-image");
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

    function renderViewerAt(index) {
      const triggers = getTriggers();

      if (!triggers.length) {
        return;
      }

      currentIndex = Math.max(0, Math.min(index, triggers.length - 1));
      const trigger = triggers[currentIndex];
      lastTrigger = trigger;
      viewerImage.src = trigger.dataset.photoSrc || trigger.href;
      viewerImage.alt = trigger.dataset.photoLabel || "Gallery image";
      viewerTitle.textContent = trigger.dataset.photoLabel || "Gallery image";
      viewerKey.textContent = trigger.dataset.photoKey || "";
      viewerOpenLink.href = trigger.dataset.photoSrc || trigger.href;
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
      viewer.hidden = true;
      document.body.style.overflow = "";
      if (viewerImage) {
        viewerImage.removeAttribute("src");
      }
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
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    viewerFrame?.addEventListener("touchend", (event) => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;

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

  async function fetchManifest(session) {
    const response = await fetch(getManifestUrl(), {
      headers: {
        Authorization: `Bearer ${session.tokens?.id_token || ""}`,
      },
      cache: "no-store",
    });

    const manifest = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(manifest?.error || "The gallery backend rejected this session.");
    }

    return manifest;
  }

  function applyCollectionCopy(collection, manifest) {
    const eyebrow = document.getElementById("gallery-eyebrow");
    const title = document.getElementById("gallery-title");
    const copy = document.getElementById("gallery-copy");
    const prefixPill = document.getElementById("gallery-prefix");
    const cachePill = document.getElementById("gallery-cache");

    if (collection === "test") {
      if (eyebrow) eyebrow.textContent = "Creative test collection";
      if (title) title.textContent = "Surprise collage vault";
      if (copy) {
        copy.textContent =
          "This signed-in route keeps the test collection playful with a fresh arrangement every time while the backend still decides who can see it.";
      }
    } else {
      if (eyebrow) eyebrow.textContent = "Month-by-month vault";
      if (title) title.textContent = "Calendar memory gallery";
      if (copy) {
        copy.textContent =
          "This route follows your custom month naming convention and keeps the selected memories grouped in calendar order.";
      }
    }

    if (prefixPill) {
      prefixPill.textContent = `Collection prefix: ${manifest.prefix}/`;
    }

    if (cachePill) {
      const ttl = Number.parseInt(manifest.cacheTtlSeconds, 10);
      const cacheLabel = Number.isFinite(ttl) && ttl >= 86400
        ? `CloudFront cached for ${Math.round(ttl / 86400)} day${Math.round(ttl / 86400) === 1 ? "" : "s"}`
        : "CloudFront cached delivery";
      cachePill.textContent = cacheLabel;
    }
  }

  async function initGalleryPage() {
    const auth = window.EverydayLillyAuth;
    const signoutButton = document.getElementById("gallery-signout");
    const status = document.getElementById("gallery-status");
    const content = document.getElementById("gallery-content");
    const userPill = document.getElementById("gallery-user");

    if (!auth) {
      if (status) {
        status.textContent = "The secure gallery helper could not load.";
      }
      if (content) {
        content.className = "empty-state";
        content.textContent = "Please return to the home page and try again.";
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

    if (userPill) {
      userPill.textContent = `Signed in as ${session.claims?.email || "your account"}`;
    }

    if (status) {
      status.textContent = "Checking your private manifest and preparing CloudFront photo delivery.";
    }

    let manifest;

    try {
      manifest = await fetchManifest(session);
    } catch (error) {
      console.error(error);
      if (status) {
        status.textContent = "The private gallery backend could not load your photos.";
      }
      if (content) {
        content.className = "empty-state";
        content.textContent = error.message || "Please return to the home page and try signing in again.";
      }
      return;
    }

    const actualCollection = normalizeCollection(manifest.collection);
    const requestedCollection = getRequestedCollection();

    if (requestedCollection !== actualCollection) {
      window.location.replace(ROUTES[actualCollection]);
      return;
    }

    applyCollectionCopy(actualCollection, manifest);

    if (!manifest.photos?.length) {
      if (status) {
        status.textContent = `No images were found under ${manifest.prefix}/`;
      }
      if (content) {
        content.className = "empty-state";
        content.textContent =
          actualCollection === "test"
            ? "Upload JPG files under test/ and refresh to see the randomized collage."
            : "Upload JPG files under months/ using your flat numbering like 0.jpg, 1.jpg, 11.jpg, and refresh the page.";
      }
      return;
    }

    if (status) {
      status.textContent = `Loaded ${manifest.photos.length} signed CloudFront image${manifest.photos.length === 1 ? "" : "s"} from ${manifest.prefix}/.`;
    }

    if (actualCollection === "test") {
      renderTestGallery(content, manifest);
    } else {
      renderMonthsGallery(content, manifest);
    }

    enableViewer(content);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.galleryMode) {
      initGalleryPage();
    }
  });
})();

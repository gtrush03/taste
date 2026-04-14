document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');
    const overlay = document.getElementById('detail-overlay');
    const closeBtn = document.getElementById('overlay-logo-btn');
    const scrollContainer = overlay.querySelector('.overlay-scroll-container');
    const textLogo = document.getElementById('persistent-logo');
    
    let isAnimating = false;
    let currentCardId = null;
    let currentCardEl = null;

    // Force autoplay on hero video only on first interaction
    // Tile videos are managed by pause/resume lifecycle — not force-played globally
    function forceHeroAutoplay() {
        const heroBg = document.getElementById('hero-bg-video');
        if (heroBg) { heroBg.muted = true; heroBg.setAttribute('playsinline', ''); heroBg.play().catch(() => {}); }
    }
    forceHeroAutoplay();
    document.addEventListener('touchstart', forceHeroAutoplay, { once: true });
    document.addEventListener('click', forceHeroAutoplay, { once: true });
    // Re-trigger on visibility change — only resume videos that should be playing
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const heroBg = document.getElementById('hero-bg-video');
            if (heroBg && heroBg.paused) heroBg.play().catch(() => {});
            // Only resume tile videos if the grid is actually visible
            if (phase === 1 && heroProgress >= 0.99) resumeTileVideos();
        }
    });

    // Check if initial hash matches a project on load
    const initHash = window.location.hash;
    if (initHash && initHash.startsWith('#project-')) {
        const pId = initHash.replace('#project-', '');
        const targetCard = document.querySelector(`.card[data-id="${pId}"]`);
        if(targetCard) {
            setTimeout(() => openOverlay(targetCard, true), 100);
        }
    }

    // PERSISTENT LOGO ENTRANCE ANIMATION
    const persistentLogo = document.getElementById('persistent-logo');
    setTimeout(() => {
        if (persistentLogo) persistentLogo.classList.add('logo-revealed');
    }, 150);
    setTimeout(() => {
        const hint = document.getElementById('hero-hint');
        if (hint) hint.classList.add('hint-visible');
    }, 1850);

    // 0. SCROLL SEQUENCE ENGINE (0 -> 1: Hero, 1 -> 2: About Us)
    const scrollHero = document.getElementById('scroll-hero');
    const heroBgVideo = document.getElementById('hero-bg-video');
    const heroHint = document.getElementById('hero-hint');
    const mainGrid = document.getElementById('main-grid');
    const aboutReveal = document.getElementById('about-section');
    const gridCards = document.querySelectorAll('.card');
    const detailOverlay = document.getElementById('detail-overlay');
    const gridInfoHint = document.getElementById('grid-info-hint');
    const mobileQuery = window.matchMedia('(max-width: 900px)');
    let isMobile = mobileQuery.matches;
    function isMobileNow() { return window.innerWidth <= 900; }

    // Mobile uses the same phase-based scroll engine as desktop.
    // No separate mobile scroll init needed.

    // ===== Phase-based scroll engine (desktop + mobile) =====

    // Phase-based scroll with AUTO-SNAP:
    // Phase 0: Hero — user scrolls a bit, then it auto-completes
    // Phase 1: Grid HARD LOCKED — scroll is completely dead
    // Phase 2: About transition — auto-snaps forward or backward
    // Phase 3: About HARD LOCKED
    let phase = 0;
    let heroProgress = 0;
    let aboutProgress = 0;
    let transitionDir = 1; // 1 = forward (grid→about), -1 = reverse (about→grid)
    let locked = false;
    let lockTimer = null;
    let currentSnapId = null;

    // Tile videos — paused when hidden to save CPU/GPU
    const tileVideos = Array.from(document.querySelectorAll('.card video'));
    function pauseTileVideos() {
        tileVideos.forEach(v => { if (!v.paused) v.pause(); });
    }
    function resumeTileVideos() {
        tileVideos.forEach(v => { if (v.paused) v.play().catch(() => {}); });
    }

    // Color interpolation: cream (#f4e7d2) to red (#9b0001)
    function lerpColor(t) {
        const r = Math.round(244 + t * (155 - 244));
        const g = Math.round(231 + t * (0 - 231));
        const b = Math.round(210 + t * (1 - 210));
        return `rgb(${r},${g},${b})`;
    }

    function renderHero() {
        const eased = easeOutQuart(heroProgress);
        const videoScale = 1 + eased * 0.15;
        const heroOpacity = Math.max(0, 1 - eased * 1.1);

        heroBgVideo.style.transform = `scale(${videoScale})`;
        scrollHero.style.opacity = heroOpacity;

        // Smoothly transition logo color from cream to red
        if (persistentLogo) {
            persistentLogo.style.color = lerpColor(heroProgress);
        }

        if (heroProgress > 0.05) {
            heroHint.classList.add('hidden');
        } else {
            heroHint.classList.remove('hidden');
        }

        // Start showing grid early for a crossfade feel
        if (heroProgress > 0.6) {
            mainGrid.classList.add('grid-visible');
        }

        if (heroProgress >= 0.99) {
            scrollHero.classList.add('hero-done');
            if (gridInfoHint) gridInfoHint.classList.add('hint-visible');
            resumeTileVideos(); // hero done, grid is live
        } else {
            scrollHero.classList.remove('hero-done');
            if (gridInfoHint) gridInfoHint.classList.remove('hint-visible');
            if (heroProgress <= 0.6) {
                mainGrid.classList.remove('grid-visible');
                pauseTileVideos(); // hidden behind hero — save decode cost
            }
        }
    }

    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

    function easeInQuad(t) { return t * t; }
    function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

    function renderAboutTransition() {
        const vx = window.innerWidth / 2;
        const vy = window.innerHeight / 2;

        if (aboutProgress <= 0) {
            mainGrid._cardPositions = null;
        }

        // Forward: cards explode out fast with easeOutQuart
        // Reverse: cards return smoothly with easeInQuad (slow start, settle naturally)
        const cardP = transitionDir > 0
            ? easeOutQuart(Math.min(aboutProgress / 0.55, 1))
            : easeInQuad(aboutProgress);

        // About section opacity
        // Forward: fades in after cards are mostly gone (0.25–0.75 range)
        // Reverse: fades out quickly in the first half so cards land cleanly
        const aboutFade = transitionDir > 0
            ? Math.max(0, Math.min((aboutProgress - 0.25) / 0.5, 1))
            : Math.min(aboutProgress * 2, 1);

        if (aboutProgress > 0.01 && textLogo) {
            textLogo.classList.add('logo-fixed-center');
            if (gridInfoHint) gridInfoHint.classList.remove('hint-visible');
        } else if (textLogo) {
            textLogo.classList.remove('logo-fixed-center');
        }

        gridCards.forEach((c, i) => {
            if (aboutProgress <= 0) {
                c.style.transform = '';
                c.style.opacity = '';
                c.style.pointerEvents = '';
                return;
            }
            const pos = mainGrid._cardPositions ? mainGrid._cardPositions[i] : { cx: vx, cy: vy };
            const dx = (pos.cx - vx);
            const dy = (pos.cy - vy);
            const flyX = dx * cardP * 1.2;
            const flyY = dy * cardP * 0.8;
            const cardScale = 1 + cardP * 1.6;
            const cardOpacity = Math.max(0, 1 - cardP * 1.5);

            c.style.transform = `translate(${flyX}px, ${flyY}px) scale(${cardScale})`;
            c.style.opacity = cardOpacity;
            c.style.pointerEvents = aboutProgress > 0.02 ? 'none' : 'auto';
        });

        if (aboutReveal) {
            aboutReveal.style.opacity = aboutFade;
            if (aboutFade > 0) {
                aboutReveal.classList.add('about-visible');
            } else {
                aboutReveal.classList.remove('about-visible');
            }
        }
    }

    // Smooth cinematic transition between pages
    // speed: 0.12 = default (forward), 0.08 = slower/smoother (reverse)
    function autoSnap(getValue, setValue, target, renderFn, onDone, speed = 0.12) {
        locked = true;
        if (currentSnapId) {
            cancelAnimationFrame(currentSnapId);
            currentSnapId = null;
        }
        let cancelled = false;
        function tick() {
            if (cancelled) return;
            let current = getValue();
            const diff = target - current;
            if (Math.abs(diff) < 0.004) {
                setValue(target);
                renderFn();
                currentSnapId = null;
                if (onDone) onDone();
                return;
            }
            setValue(current + diff * speed);
            renderFn();
            currentSnapId = requestAnimationFrame(tick);
        }
        currentSnapId = requestAnimationFrame(tick);
        return () => { cancelled = true; };
    }

    // Lock scroll completely for a duration, then unlock into a phase
    function hardLock(nextPhase, duration) {
        locked = true;
        phase = nextPhase;
        if (lockTimer) clearTimeout(lockTimer);
        lockTimer = setTimeout(() => {
            locked = false;
            lockTimer = null;
        }, duration);
    }

    // Initial render
    renderHero();

    // Accumulator for scroll intent detection
    let scrollAccum = 0;
    let scrollAccumTimer = null;
    const SNAP_THRESHOLD = 60;

    function resetAccum() {
        scrollAccum = 0;
        if (scrollAccumTimer) clearTimeout(scrollAccumTimer);
        scrollAccumTimer = null;
    }

    // Single scroll handler for both wheel and touch
    function handleScroll(deltaY) {
        if (locked) return;
        if (detailOverlay && detailOverlay.classList.contains('is-active')) return;
        if (isAnimating) return;

        const scrollingDown = deltaY > 0;
        const scrollingUp = deltaY < 0;

        switch (phase) {
            case 0: { // Hero — scroll-driven but auto-snaps
                const delta = Math.min(Math.abs(deltaY) * 0.0015, 0.03);
                if (scrollingDown) {
                    heroProgress = Math.min(heroProgress + delta, 1);
                    renderHero();
                    if (heroProgress >= 0.18 && heroProgress < 1) {
                        autoSnap(
                            () => heroProgress,
                            (v) => { heroProgress = v; },
                            1,
                            renderHero,
                            () => hardLock(1, 800)
                    );
                } else if (heroProgress >= 1) {
                        hardLock(1, 800);
                    }
                } else if (heroProgress > 0) {
                    heroProgress = Math.max(heroProgress - delta, 0);
                    renderHero();
                }
                break;
            }

            case 1: { // Grid HARD LOCKED — accumulate scroll intent
                // Build up scroll intent — need deliberate scrolling to leave
                if (scrollingDown) {
                    scrollAccum += Math.abs(deltaY);
                    // Reset accumulator if user stops scrolling for 400ms
                    if (scrollAccumTimer) clearTimeout(scrollAccumTimer);
                    scrollAccumTimer = setTimeout(resetAccum, 400);

                    if (scrollAccum >= SNAP_THRESHOLD) {
                        resetAccum();
                        transitionDir = 1;
                        aboutProgress = 0;
                        // Pre-compute card positions before entering RAF loop
                        gridCards.forEach(c => { c.style.transform = ''; });
                        void mainGrid.offsetWidth;
                        mainGrid._cardPositions = Array.from(gridCards).map(c => {
                            const rect = c.getBoundingClientRect();
                            return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
                        });
                        mainGrid.classList.add('grid-zooming');
                        pauseTileVideos(); // tiles animating off — no need to decode
                        autoSnap(
                            () => aboutProgress,
                            (v) => { aboutProgress = v; },
                            1,
                            renderAboutTransition,
                            () => {
                                mainGrid.classList.remove('grid-zooming');
                                hardLock(3, 800);
                            }
                        );
                    }
                } else if (scrollingUp) {
                    scrollAccum += Math.abs(deltaY);
                    if (scrollAccumTimer) clearTimeout(scrollAccumTimer);
                    scrollAccumTimer = setTimeout(resetAccum, 400);

                    if (scrollAccum >= SNAP_THRESHOLD) {
                        resetAccum();
                        pauseTileVideos(); // returning to hero — grid going off screen
                        autoSnap(
                            () => heroProgress,
                            (v) => { heroProgress = v; },
                            0,
                            renderHero,
                            () => hardLock(0, 800)
                        );
                    }
                }
                break;
            }

            case 3: { // About HARD LOCKED — accumulate scroll intent to go back
                if (scrollingUp) {
                    scrollAccum += Math.abs(deltaY);
                    if (scrollAccumTimer) clearTimeout(scrollAccumTimer);
                    scrollAccumTimer = setTimeout(resetAccum, 400);

                    if (scrollAccum >= SNAP_THRESHOLD) {
                        resetAccum();
                        transitionDir = -1;
                        // Pre-compute positions for reverse (needed if screen resized)
                        gridCards.forEach(c => { c.style.transform = ''; });
                        void mainGrid.offsetWidth;
                        mainGrid._cardPositions = Array.from(gridCards).map(c => {
                            const rect = c.getBoundingClientRect();
                            return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
                        });
                        mainGrid.classList.add('grid-zooming');
                        // Slower lerp (0.08) = silky reverse pull, not a snap-back
                        autoSnap(
                            () => aboutProgress,
                            (v) => { aboutProgress = v; },
                            0,
                            renderAboutTransition,
                            () => {
                                mainGrid.classList.remove('grid-zooming');
                                gridCards.forEach(c => {
                                    c.style.transform = '';
                                    c.style.opacity = '';
                                    c.style.filter = '';
                                    c.style.pointerEvents = '';
                                });
                                aboutReveal.classList.remove('about-visible');
                                aboutReveal.style.opacity = '';
                                mainGrid._cardPositions = null;
                                if (textLogo) textLogo.classList.remove('logo-fixed-center');
                                if (gridInfoHint) gridInfoHint.classList.add('hint-visible');
                                resumeTileVideos(); // cards are back — resume their videos
                                hardLock(1, 800);
                            },
                            0.08 // gentler speed for reverse
                        );
                    }
                }
                break;
            }
        }
    }

    // About section internal scroll helper
    function aboutAtBoundary(deltaY) {
        if (phase !== 3 || !aboutReveal) return true;
        if (aboutReveal.scrollHeight <= aboutReveal.clientHeight + 4) return true;
        const atTop = aboutReveal.scrollTop <= 0;
        const atBottom = aboutReveal.scrollTop + aboutReveal.clientHeight >= aboutReveal.scrollHeight - 2;
        if (deltaY < 0 && atTop) return true;   // scrolling up at top → page transition
        if (deltaY > 0 && atBottom) return false; // scrolling down at bottom → no more pages
        return false; // internal scroll
    }

    // Touch state
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    // Wheel / touchmove handlers — extracted as named fns so overlay can detach them
    function onWheel(e) {
        if (detailOverlay && detailOverlay.classList.contains('is-active')) return;
        // About page: allow internal scroll, only transition at top boundary
        if (phase === 3 && !aboutAtBoundary(e.deltaY)) return;
        e.preventDefault();
        handleScroll(e.deltaY);
    }
    function onTouchMove(e) {
        if (detailOverlay && detailOverlay.classList.contains('is-active')) return;
        const touchY = e.touches[0].clientY;
        const delta = touchStartY - touchY;
        // About page: allow internal scroll, only transition at top boundary
        if (phase === 3 && !aboutAtBoundary(delta)) {
            touchStartY = touchY;
            return;
        }
        e.preventDefault();
        touchStartY = touchY;
        const normalizedDelta = delta * (window.innerHeight / 844);
        handleScroll(normalizedDelta);
    }
    function addScrollListeners() {
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
    }
    function removeScrollListeners() {
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchmove', onTouchMove);
    }
    addScrollListeners();

    // 1. TILE CLICK TO DETAIL OVERLAY
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (isAnimating) return;
            openOverlay(card, false);
        });
    });

    function openOverlay(card, skipHistoryPush) {
        if (isAnimating) return;
        isAnimating = true;
        
        currentCardEl = card;
        currentCardId = card.getAttribute('data-id');

        // Populate overlay data
        document.getElementById('overlay-title').innerText = card.getAttribute('data-title');
        document.getElementById('overlay-subtitle').innerText = card.getAttribute('data-subtitle') || '';
        document.getElementById('overlay-type').innerText = card.getAttribute('data-type') || '';
        document.getElementById('overlay-credits').innerText = card.getAttribute('data-credits') || '';

        const heroSrc = card.getAttribute('data-hero');
        const embedSrc = card.getAttribute('data-embed');
        const aspectRatio = card.getAttribute('data-aspect');
        const embed2Src = card.getAttribute('data-embed2');
        const aspect2 = card.getAttribute('data-aspect2');
        const heroImg = document.getElementById('overlay-hero-img');
        const heroVid = document.getElementById('overlay-hero-video');
        const heroEmbed = document.getElementById('overlay-hero-embed');
        const primaryFrame = document.getElementById('overlay-frame-primary');
        const secondaryFrame = document.getElementById('overlay-frame-secondary');
        const secondaryEmbed = document.getElementById('overlay-secondary-embed');

        const loaderPrimary = document.getElementById('embed-loader-primary');
        const loaderSecondary = document.getElementById('embed-loader-secondary');

        heroImg.style.display = 'none';
        heroVid.style.display = 'none';
        heroVid.src = '';
        heroEmbed.style.display = 'none';
        heroEmbed.src = '';
        secondaryFrame.style.display = 'none';
        secondaryEmbed.src = '';

        if (loaderPrimary) loaderPrimary.classList.remove('loaded');
        if (loaderSecondary) loaderSecondary.classList.remove('loaded');
        secondaryFrame.style.width = '';
        secondaryFrame.style.height = '';
        secondaryFrame.classList.remove('has-aspect');

        primaryFrame.style.width = '';
        primaryFrame.style.height = '';
        primaryFrame.classList.remove('has-aspect');

        function sizeFrame(frame, ar) {
            const [aw, ah] = ar.split('/').map(Number);
            const ratio = aw / ah;
            const pad = 64;
            const infoH = 120;
            const availW = window.innerWidth - pad;
            const availH = window.innerHeight - infoH;
            let w = availW;
            let h = w / ratio;
            if (h > availH) {
                h = availH;
                w = h * ratio;
            }
            frame.style.width = Math.floor(w) + 'px';
            frame.style.height = Math.floor(h) + 'px';
            frame.classList.add('has-aspect');
        }

        if (aspectRatio) {
            sizeFrame(primaryFrame, aspectRatio);
        }

        const hasSecondary = embed2Src && embed2Src.length > 0;
        const stillsData = card.getAttribute('data-stills');
        const stillsContainer = document.getElementById('overlay-stills');
        stillsContainer.innerHTML = '';
        stillsContainer.style.display = 'none';

        const hasExtra = hasSecondary || (stillsData && stillsData.length > 0);

        if (hasSecondary) {
            if (aspect2) {
                sizeFrame(secondaryFrame, aspect2);
            }
            secondaryFrame.style.display = '';
            secondaryEmbed.onload = () => { if (loaderSecondary) loaderSecondary.classList.add('loaded'); };
            secondaryEmbed.src = embed2Src + (embed2Src.includes('youtube') ? '?rel=0&modestbranding=1&color=white' : '?color=ffffff&title=0&byline=0&portrait=0');
        }

        if (stillsData && stillsData.length > 0) {
            const paths = stillsData.split(',');
            paths.forEach(src => {
                const img = document.createElement('img');
                img.src = src.trim();
                img.className = 'overlay-still-img';
                stillsContainer.appendChild(img);
            });
            stillsContainer.style.display = '';
        }

        if (hasExtra) {
            overlay.classList.add('multi-video');
        } else {
            overlay.classList.remove('multi-video');
        }

        if (embedSrc) {
            heroEmbed.style.display = 'block';
            heroEmbed.loading = 'eager';
            heroEmbed.onload = () => { if (loaderPrimary) loaderPrimary.classList.add('loaded'); };
            const isVimeo = embedSrc.includes('vimeo');
            heroEmbed.src = isVimeo
                ? embedSrc + '?autoplay=1&muted=1&title=0&byline=0&portrait=0'
                : embedSrc + '?autoplay=1&rel=0&modestbranding=1&color=white';
        } else if (heroSrc.endsWith('.mp4')) {
            if (loaderPrimary) loaderPrimary.classList.add('loaded');
            heroVid.style.display = 'block';
            heroVid.src = heroSrc;
            heroVid.play().catch(() => {});
        } else {
            if (loaderPrimary) loaderPrimary.classList.add('loaded');
            heroImg.style.display = '';
            heroImg.src = heroSrc;
        }

        // Geometrical computations for Clip Path
        const rect = card.getBoundingClientRect();
        const br = 36; // border radius matches CSS
        const insetVal = `inset(${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px round ${br}px)`;

        // Reset scroll position gracefully
        scrollContainer.scrollTop = 0;

        // Apply initial locked state
        overlay.style.willChange = 'clip-path';
        overlay.style.transition = 'none';
        overlay.style.clipPath = insetVal;
        overlay.style.webkitClipPath = insetVal;

        // Push State
        if (!skipHistoryPush) {
            window.history.pushState({ id: currentCardId }, '', `#project-${currentCardId}`);
        }

        // Force browser reflow to register the starting clip-path
        void overlay.offsetWidth;

        // Animate up to full screen — fast cinematic expansion
        overlay.style.transition = 'clip-path 0.45s cubic-bezier(0.65, 0, 0.05, 1), -webkit-clip-path 0.45s cubic-bezier(0.65, 0, 0.05, 1)';
        overlay.style.clipPath = `inset(0px 0px 0px 0px round 0px)`;
        overlay.style.webkitClipPath = `inset(0px 0px 0px 0px round 0px)`;
        overlay.classList.add('is-active');
        removeScrollListeners();
        pauseTileVideos(); // overlay covers grid — free up decode budget
        if (persistentLogo) {
            persistentLogo.style.transition = 'opacity 0.25s ease';
            persistentLogo.style.opacity = '0';
        }
        if (gridInfoHint) gridInfoHint.classList.remove('hint-visible');

        // Content fades in overlapping with expansion for seamless feel
        setTimeout(() => {
            overlay.classList.add('content-ready');
        }, 250);
        setTimeout(() => {
            isAnimating = false;
            overlay.style.willChange = 'auto';
        }, 450);
    }

    // 3. OVERLAY CLOSE LOGIC
    function closeOverlay() {
        if (isAnimating || !currentCardEl) return;
        isAnimating = true;

        // Start content fade-out
        overlay.classList.remove('content-ready');
        overlay.style.willChange = 'clip-path';

        // Recalculate bounding box of the original tile
        const rect = currentCardEl.getBoundingClientRect();
        const br = 36;
        const insetVal = `inset(${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px round ${br}px)`;

        // Brief pause for content to start fading, then shrink clip-path back to card
        setTimeout(() => {
            overlay.style.transition = 'clip-path 0.42s cubic-bezier(0.32, 0, 0.07, 1), -webkit-clip-path 0.42s cubic-bezier(0.32, 0, 0.07, 1)';
            overlay.style.clipPath = insetVal;
            overlay.style.webkitClipPath = insetVal;

            setTimeout(() => {
                overlay.classList.remove('is-active');
                overlay.style.transition = 'none';
                // Collapse to a zero-size point at the card center so nothing is covered
                const finalRect = currentCardEl ? currentCardEl.getBoundingClientRect() : rect;
                const cx = finalRect.left + finalRect.width / 2;
                const cy = finalRect.top + finalRect.height / 2;
                const collapsed = `inset(${cy}px ${window.innerWidth - cx}px ${window.innerHeight - cy}px ${cx}px round 0px)`;
                overlay.style.clipPath = collapsed;
                overlay.style.webkitClipPath = collapsed;
                const vid = document.getElementById('overlay-hero-video');
                if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
                const emb = document.getElementById('overlay-hero-embed');
                if (emb) { emb.src = ''; emb.style.display = 'none'; }
                const pFrm = document.getElementById('overlay-frame-primary');
                if (pFrm) { pFrm.style.width = ''; pFrm.style.height = ''; pFrm.classList.remove('has-aspect'); }
                const sFrm = document.getElementById('overlay-frame-secondary');
                const sEmb = document.getElementById('overlay-secondary-embed');
                if (sFrm) { sFrm.style.display = 'none'; sFrm.style.width = ''; sFrm.style.height = ''; sFrm.classList.remove('has-aspect'); }
                if (sEmb) { sEmb.src = ''; }
                const stills = document.getElementById('overlay-stills');
                if (stills) { stills.innerHTML = ''; stills.style.display = 'none'; }
                overlay.classList.remove('multi-video');
                if (persistentLogo) {
                    persistentLogo.style.transition = 'opacity 0.3s ease';
                    persistentLogo.style.opacity = '1';
                }
                currentCardEl = null;
                currentCardId = null;
                isAnimating = false;
                overlay.style.willChange = 'auto';
                resumeTileVideos(); // grid is back in view
                addScrollListeners();
            }, 400);
        }, 60);
    }

    closeBtn.addEventListener('click', () => {
        if (isAnimating) return;
        if (overlay.classList.contains('is-active')) {
            if (window.location.hash.startsWith('#project-')) {
                window.history.replaceState(null, '', window.location.pathname);
            }
            closeOverlay();
        }
    });

    // 4. HISTORY / POPSTATE ROUTING
    window.addEventListener('popstate', (e) => {
        if (overlay.classList.contains('is-active') && !window.location.hash.startsWith('#project-')) {
            closeOverlay();
        } else if (window.location.hash.startsWith('#project-')) {
            const pId = window.location.hash.replace('#project-', '');
            const card = document.querySelector(`.card[data-id="${pId}"]`);
            if (card) openOverlay(card, true);
        }
    });

    window.addEventListener('keydown', (e) => {
        if ((e.key === 'Escape' || e.key === 'Backspace') && overlay.classList.contains('is-active')) {
            if (isAnimating) return;
            if (e.key === 'Backspace' && window.location.hash.startsWith('#project-')) {
                e.preventDefault();
                window.history.back();
            } else {
                if (window.location.hash.startsWith('#project-')) {
                    window.history.replaceState(null, '', window.location.pathname);
                }
                closeOverlay();
            }
        }
    });

});

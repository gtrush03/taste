document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');
    const overlay = document.getElementById('detail-overlay');
    const closeBtn = document.getElementById('overlay-close');
    const scrollContainer = overlay.querySelector('.overlay-scroll-container');
    const textLogo = document.querySelector('.text-logo');
    
    let isAnimating = false;
    let currentCardId = null;
    let currentCardEl = null;

    // Force autoplay on ALL videos (mobile + desktop)
    function forceAutoplayAll() {
        document.querySelectorAll('video').forEach(v => {
            v.muted = true;
            v.setAttribute('playsinline', '');
            v.setAttribute('muted', '');
            v.play().catch(() => {});
        });
    }
    forceAutoplayAll();
    document.addEventListener('touchstart', forceAutoplayAll, { once: true });
    document.addEventListener('click', forceAutoplayAll, { once: true });
    // Re-trigger on visibility change (tab switch, screen lock)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) forceAutoplayAll();
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

    // HERO LOGO ENTRANCE ANIMATION
    const heroLogo = document.getElementById('hero-logo');
    setTimeout(() => {
        if (heroLogo) heroLogo.classList.add('logo-revealed');
    }, 150);
    setTimeout(() => {
        const hint = document.getElementById('hero-hint');
        if (hint) hint.classList.add('hint-visible');
    }, 1850);

    // 0. SCROLL SEQUENCE ENGINE (0 -> 1: Hero, 1 -> 2: About Us)
    const scrollHero = document.getElementById('scroll-hero');
    const heroBox = document.getElementById('hero-media-box');
    const heroHint = document.getElementById('hero-hint');
    const heroInnerVideo = document.getElementById('hero-inner-video');
    const mainGrid = document.getElementById('main-grid');
    const aboutReveal = document.getElementById('about-section');
    const gridCards = document.querySelectorAll('.card');
    const detailOverlay = document.getElementById('detail-overlay');
    
    // Phase-based scroll with AUTO-SNAP:
    // Phase 0: Hero — user scrolls a bit, then it auto-completes
    // Phase 1: Grid HARD LOCKED — scroll is completely dead
    // Phase 2: About transition — auto-snaps forward or backward
    // Phase 3: About HARD LOCKED
    let phase = 0;
    let heroProgress = 0;
    let aboutProgress = 0;
    let locked = false;        // true = ignore ALL scroll input
    let lockTimer = null;
    const isMobile = window.innerWidth < 768;

    const startW = isMobile ? 220 : 300;
    const startH = isMobile ? 280 : 360;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;

    function renderHero() {
        const w = startW + heroProgress * (maxW - startW);
        const h = startH + heroProgress * (maxH - startH);
        const r = 24 * (1 - heroProgress);

        heroBox.style.width = w + 'px';
        heroBox.style.height = h + 'px';
        heroBox.style.borderRadius = r + 'px';
        heroBox.style.background = `transparent`;
        heroBox.style.boxShadow = `none`;

        const videoOpacity = Math.min(heroProgress * 1.2, 0.75);
        const videoScale = 3 - heroProgress * 2;
        heroInnerVideo.style.opacity = videoOpacity;
        heroInnerVideo.style.transform = `scale(${videoScale})`;

        if (heroProgress > 0.05) {
            heroHint.classList.add('hidden');
        } else {
            heroHint.classList.remove('hidden');
        }

        if (heroProgress >= 0.99) {
            scrollHero.classList.add('hero-done');
            mainGrid.classList.add('grid-visible');
        } else {
            scrollHero.classList.remove('hero-done');
            mainGrid.classList.remove('grid-visible');
        }
    }

    function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

    function renderAboutTransition() {
        const vx = window.innerWidth / 2;
        const vy = window.innerHeight / 2;

        if (aboutProgress > 0 && !mainGrid._cardPositions) {
            gridCards.forEach(c => { c.style.transform = ''; });
            void mainGrid.offsetWidth;
            mainGrid._cardPositions = Array.from(gridCards).map(c => {
                const rect = c.getBoundingClientRect();
                return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
            });
        }
        if (aboutProgress <= 0) {
            mainGrid._cardPositions = null;
        }

        const cardP = easeOutQuart(Math.min(aboutProgress / 0.55, 1));
        
        if (aboutProgress > 0.01 && textLogo) {
            textLogo.classList.add('logo-fixed-center');
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
            c.style.filter = `blur(${cardP * 6}px)`;
            c.style.pointerEvents = aboutProgress > 0.02 ? 'none' : 'auto';
        });

        if (aboutReveal) {
            const aboutFade = Math.max(0, Math.min((aboutProgress - 0.25) / 0.5, 1));
            aboutReveal.style.opacity = aboutFade;
            if (aboutFade > 0) {
                aboutReveal.classList.add('about-visible');
            } else {
                aboutReveal.classList.remove('about-visible');
            }
        }
    }

    // Auto-animate a value from current to target over ~600ms
    function autoSnap(getValue, setValue, target, renderFn, onDone) {
        locked = true;
        function tick() {
            let current = getValue();
            const diff = target - current;
            if (Math.abs(diff) < 0.003) {
                setValue(target);
                renderFn();
                if (onDone) onDone();
                return;
            }
            setValue(current + diff * 0.07);
            renderFn();
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
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
    const SNAP_THRESHOLD = 80; // pixels of scroll needed to trigger transition

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
                    // Once past 30%, auto-snap to completion
                    if (heroProgress >= 0.3 && heroProgress < 1) {
                        autoSnap(
                            () => heroProgress,
                            (v) => { heroProgress = v; },
                            1,
                            renderHero,
                            () => hardLock(1, 1200) // HARD LOCK on grid for 1.2 seconds
                        );
                    } else if (heroProgress >= 1) {
                        hardLock(1, 1200);
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
                        // Start about transition — auto-snap the whole thing
                        aboutProgress = 0;
                        autoSnap(
                            () => aboutProgress,
                            (v) => { aboutProgress = v; },
                            1,
                            renderAboutTransition,
                            () => hardLock(3, 1200)
                        );
                    }
                } else if (scrollingUp) {
                    scrollAccum += Math.abs(deltaY);
                    if (scrollAccumTimer) clearTimeout(scrollAccumTimer);
                    scrollAccumTimer = setTimeout(resetAccum, 400);

                    if (scrollAccum >= SNAP_THRESHOLD) {
                        resetAccum();
                        // Go back to hero
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
                        // Reverse about transition
                        autoSnap(
                            () => aboutProgress,
                            (v) => { aboutProgress = v; },
                            0,
                            renderAboutTransition,
                            () => {
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
                                hardLock(1, 1200);
                            }
                        );
                    }
                }
                break;
            }
        }
    }

    // Wheel handler
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        handleScroll(e.deltaY);
    }, { passive: false });

    // Touch handlers
    let touchStartY = 0;
    window.addEventListener('touchstart', (e) => {
        if (locked) return;
        touchStartY = e.touches[0].clientY;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touchY = e.touches[0].clientY;
        const delta = touchStartY - touchY;
        touchStartY = touchY;
        handleScroll(delta * 2); // Scale up touch deltas
    }, { passive: false });

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
        const heroImg = document.getElementById('overlay-hero-img');
        const heroVid = document.getElementById('overlay-hero-video');
        if (heroSrc.endsWith('.mp4')) {
            heroImg.style.display = 'none';
            heroVid.style.display = 'block';
            heroVid.src = heroSrc;
            heroVid.play();
        } else {
            heroVid.style.display = 'none';
            heroVid.src = '';
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
        overlay.style.transition = 'none';
        overlay.style.clipPath = insetVal;
        
        // Push State
        if (!skipHistoryPush) {
            window.history.pushState({ id: currentCardId }, '', `#project-${currentCardId}`);
        }

        // Force browser reflow to register the starting clip-path
        void overlay.offsetWidth;

        // Animate up to full screen
        overlay.style.transition = 'clip-path 0.6s cubic-bezier(0.8, 0, 0.1, 1)';
        overlay.style.clipPath = `inset(0px 0px 0px 0px round 0px)`;
        overlay.classList.add('is-active');

        // Release lock and trigger content fade-in
        setTimeout(() => {
            overlay.classList.add('content-ready');
            isAnimating = false;
        }, 600);
    }

    // 3. OVERLAY CLOSE LOGIC
    function closeOverlay() {
        if (isAnimating || !currentCardEl) return;
        isAnimating = true;

        // Start content fade-out
        overlay.classList.remove('content-ready');

        // Wait a tiny bit for the text fade to begin before slicing the clip-path
        setTimeout(() => {
            // Stale rect fix: recalcute bounding box of the original tile (in case window resized)
            const rect = currentCardEl.getBoundingClientRect();
            const br = 36;
            const insetVal = `inset(${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px round ${br}px)`;

            overlay.style.clipPath = insetVal;

            setTimeout(() => {
                overlay.classList.remove('is-active');
                overlay.style.clipPath = 'inset(0 0 100% 0)';
                const vid = document.getElementById('overlay-hero-video');
                if (vid) { vid.pause(); vid.src = ''; vid.style.display = 'none'; }
                currentCardEl = null;
                currentCardId = null;
                isAnimating = false;
            }, 600);
        }, 100);
    }

    closeBtn.addEventListener('click', () => {
        if (isAnimating) return;
        window.history.back(); // Invokes popstate automatically
    });

    // 4. HISTORY / POPSTATE ROUTING
    window.addEventListener('popstate', (e) => {
        // If we are currently showing an overlay and hit back, close it
        if (overlay.classList.contains('is-active')) {
            closeOverlay();
        } else if (window.location.hash.startsWith('#project-')) {
            // Edge case: User navigated forward manually or reloaded
            const pId = window.location.hash.replace('#project-', '');
            const card = document.querySelector(`.card[data-id="${pId}"]`);
            if (card) openOverlay(card, true);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('is-active')) {
            if (isAnimating) return;
            window.history.back();
        }
    });

});

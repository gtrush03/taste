document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');
    const overlay = document.getElementById('detail-overlay');
    const closeBtn = document.getElementById('overlay-close');
    const scrollContainer = overlay.querySelector('.overlay-scroll-container');
    const triggers = document.querySelectorAll('.nav-trigger');
    
    let isAnimating = false;
    let currentCardId = null;
    let currentCardEl = null;

    // Check if initial hash matches a project on load
    const initHash = window.location.hash;
    if (initHash && initHash.startsWith('#project-')) {
        const pId = initHash.replace('#project-', '');
        const targetCard = document.querySelector(`.card[data-id="${pId}"]`);
        if(targetCard) {
            setTimeout(() => openOverlay(targetCard, true), 100);
        }
    }

    // 0. SCROLL SEQUENCE ENGINE (0 -> 1: Hero, 1 -> 2: About Us)
    const scrollHero = document.getElementById('scroll-hero');
    const heroBox = document.getElementById('hero-media-box');
    const heroHint = document.getElementById('hero-hint');
    const heroInnerVideo = document.getElementById('hero-inner-video');
    const mainGrid = document.getElementById('main-grid');
    const aboutReveal = document.getElementById('about-section');
    const gridCards = document.querySelectorAll('.card');
    const navTriggers = document.querySelectorAll('.nav-trigger');
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

        const cardP = Math.min(aboutProgress / 0.6, 1);
        
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
            const flyX = dx * cardP * 1.5;
            const flyY = dy * cardP * 1.0;
            const cardScale = 1 + cardP * 2.5;
            const cardOpacity = Math.max(0, 1 - cardP * 1.8);
            
            c.style.transform = `translate(${flyX}px, ${flyY}px) scale(${cardScale})`;
            c.style.opacity = cardOpacity;
            c.style.pointerEvents = aboutProgress > 0.02 ? 'none' : 'auto';
        });

        navTriggers.forEach(n => {
            if (aboutProgress <= 0) {
                n.style.opacity = '';
                n.style.pointerEvents = '';
                return;
            }
            n.style.opacity = Math.max(0, 1 - cardP * 2.5);
            n.style.pointerEvents = aboutProgress > 0.02 ? 'none' : 'auto';
        });

        if (aboutReveal) {
            if (aboutProgress > 0.5) {
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
            if (Math.abs(diff) < 0.005) {
                setValue(target);
                renderFn();
                if (onDone) onDone();
                return;
            }
            setValue(current + diff * 0.12);
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
                                // Reset card styles
                                gridCards.forEach(c => {
                                    c.style.transform = '';
                                    c.style.opacity = '';
                                    c.style.pointerEvents = '';
                                });
                                navTriggers.forEach(n => {
                                    n.style.opacity = '';
                                    n.style.pointerEvents = '';
                                });
                                aboutReveal.classList.remove('about-visible');
                                mainGrid._cardPositions = null;
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

    // 1. NAV HOVER — elegant card reveal (photo fades away)
    let lockedTrigger = null;

    triggers.forEach(trigger => {
        const targetClass = '.nav-target-' + trigger.getAttribute('data-target');
        const spanLabel = trigger.querySelector('.nav-label');
        const originalText = trigger.getAttribute('data-original');

        const handleEnter = () => {
            if (lockedTrigger) return;
            document.querySelectorAll('.card.flipped').forEach(c => c.classList.remove('flipped'));
            document.querySelectorAll(targetClass).forEach(c => c.classList.add('flipped'));
        };

        const handleLeave = () => {
            if (lockedTrigger) return;
            document.querySelectorAll(targetClass).forEach(c => c.classList.remove('flipped'));
        };

        const toggleLock = () => {
            if (lockedTrigger === trigger) {
                lockedTrigger = null;
                document.querySelectorAll(targetClass).forEach(c => c.classList.remove('flipped'));
                spanLabel.innerText = originalText;
                trigger.classList.remove('nav-locked');
            } else {
                if (lockedTrigger) {
                    const prevTarget = '.nav-target-' + lockedTrigger.getAttribute('data-target');
                    document.querySelectorAll(prevTarget).forEach(c => c.classList.remove('flipped'));
                    lockedTrigger.querySelector('.nav-label').innerText = lockedTrigger.getAttribute('data-original');
                    lockedTrigger.classList.remove('nav-locked');
                }
                lockedTrigger = trigger;
                document.querySelectorAll(targetClass).forEach(c => c.classList.add('flipped'));
                spanLabel.innerText = 'close';
                trigger.classList.add('nav-locked');
            }
        };

        trigger.addEventListener('mouseenter', handleEnter);
        trigger.addEventListener('mouseleave', handleLeave);
        trigger.addEventListener('click', toggleLock);

        trigger.addEventListener('touchstart', (e) => {
            e.preventDefault(); 
            toggleLock();
        }, { passive: false });
    });

    // Clean up flipped states if touching outside on mobile
    document.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.nav-trigger') && !e.target.closest('.card.flipped')) {
            if (lockedTrigger) {
                document.querySelectorAll('.card.flipped').forEach(c => c.classList.remove('flipped'));
                lockedTrigger.querySelector('.nav-label').innerText = lockedTrigger.getAttribute('data-original');
                lockedTrigger.classList.remove('nav-locked');
                lockedTrigger = null;
            }
        }
    }, { passive: true });


    // 2. TILE CLICK TO DETAIL OVERLAY
    cards.forEach(card => {
        card.addEventListener('click', (e) => {
            if (isAnimating) return;
            // Never open detail overlay if the text panel is flipped
            if (card.classList.contains('flipped')) return;

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
        document.getElementById('overlay-meta').innerText = card.getAttribute('data-meta');
        document.getElementById('overlay-description').innerText = card.getAttribute('data-description');
        document.getElementById('overlay-hero-img').src = card.getAttribute('data-hero');

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
                overlay.style.clipPath = 'inset(0 0 100% 0)'; // Default off-screen state
                currentCardEl = null;
                currentCardId = null;
                isAnimating = false;
            }, 600); // 0.6s bounds transition
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

    // =========================
    // ABOUT PAGE — mobile expand
    // =========================
    const aboutCard = document.getElementById('about-card');
    const aboutPage = document.getElementById('about-page');
    const aboutPageClose = document.getElementById('about-page-close');

    if (aboutCard && aboutPage) {
        aboutCard.addEventListener('click', () => {
            if (window.innerWidth > 900) return;
            aboutPage.classList.add('is-open');
        });

        aboutPageClose.addEventListener('click', () => {
            aboutPage.classList.remove('is-open');
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && aboutPage.classList.contains('is-open')) {
                aboutPage.classList.remove('is-open');
            }
        });
    }

    // Custom cursor disabled — using system default
});

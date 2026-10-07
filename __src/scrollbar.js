export function initScrollbar() {
    const scrollbar = document.querySelector('.scrollbar');
    const track = document.querySelector('.scroll-track');
    const thumb = document.querySelector('.scroll-thumb');
    const percentText = document.querySelector('.scroll-percent');

    if (!scrollbar || !track || !thumb || !percentText) return;

    let isDragging = false;
    let dragRafId = null;
    let scrollRafId = null;
    let cachedTrackRect = null;
    let cachedMaxScroll = 0;
    let pendingY = 0;

    const setThumbPosition = (progress) => {
        const clamped = Math.min(1, Math.max(0, progress));
        thumb.style.top = `${clamped * 100}%`;
        percentText.textContent = `${Math.round(clamped * 100)}%`;
    };

    const getScrollMetrics = () => {
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;
        return {
            maxScroll: Math.max(0, scrollHeight - clientHeight),
            trackRect: track.getBoundingClientRect()
        };
    };

    const updateScroll = () => {
        const { maxScroll } = getScrollMetrics();

        // Hide the scrollbar when the content fits entirely in the viewport (4K, TV, short page).
        if (maxScroll <= 2) {
            scrollbar.classList.add('is-hidden');
            document.documentElement.classList.add('is-scrollbar-hidden');
            return;
        }
        scrollbar.classList.remove('is-hidden');
        document.documentElement.classList.remove('is-scrollbar-hidden');

        if (isDragging) return;

        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        setThumbPosition(maxScroll > 0 ? scrollTop / maxScroll : 0);
    };

    // Throttled to one update per frame so natural scrolling never drops frames.
    window.addEventListener('scroll', () => {
        if (isDragging || scrollRafId) return;

        scrollRafId = requestAnimationFrame(() => {
            scrollRafId = null;
            updateScroll();
        });
    }, { passive: true });

    window.addEventListener('resize', updateScroll);
    new ResizeObserver(updateScroll).observe(document.body);

    const renderDrag = () => {
        dragRafId = null;

        const offsetY = pendingY - cachedTrackRect.top;
        const ratio = Math.min(1, Math.max(0, offsetY / cachedTrackRect.height));

        setThumbPosition(ratio);
        window.scrollTo({ top: ratio * cachedMaxScroll, behavior: 'auto' });
    };

    scrollbar.addEventListener('mousedown', (e) => {
        isDragging = true;

        document.documentElement.style.scrollBehavior = 'auto';
        document.body.style.userSelect = 'none';

        const metrics = getScrollMetrics();
        cachedTrackRect = metrics.trackRect;
        cachedMaxScroll = metrics.maxScroll;

        pendingY = e.clientY;
        renderDrag();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();

        pendingY = e.clientY;

        if (!dragRafId) {
            dragRafId = requestAnimationFrame(renderDrag);
        }
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;

        isDragging = false;
        document.body.style.userSelect = '';

        // Restore CSS smooth scrolling for anchor jump links.
        document.documentElement.style.scrollBehavior = '';

        if (dragRafId) {
            cancelAnimationFrame(dragRafId);
            dragRafId = null;
        }

        updateScroll();
    });

    updateScroll();
}

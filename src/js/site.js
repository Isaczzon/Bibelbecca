document.addEventListener('DOMContentLoaded', () => {
    // Kom ihåg besökarens språk till nästa besök
    try {
        const culture = document.documentElement.getAttribute('data-culture');
        if (culture) localStorage.setItem('lang', culture);
    } catch (e) { /* ignore */ }

    // Spara språkvalet direkt vid klick i språkmenyn — annars hinner
    // startsidans omdirigering skicka tillbaka besökaren till det gamla språket
    document.querySelectorAll('.lang-menu a').forEach((a) =>
        a.addEventListener('click', () => {
            try { localStorage.setItem('lang', a.getAttribute('hreflang')); } catch (e) { /* ignore */ }
        })
    );

    const nav = document.getElementById('navbar');
    if (nav) {
        window.addEventListener('scroll', () => {
            nav.classList.toggle('scrolled', window.scrollY > 10);
        });
    }

    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.getElementById('navLinks');
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
        navLinks.querySelectorAll('a').forEach((a) =>
            a.addEventListener('click', () => navLinks.classList.remove('open'))
        );
    }

    // Svepande fördröjning per kort i rutnäten – ger en "våg" när de tonas in
    document.querySelectorAll('.video-list, .shorts-list, .kat-grid, .sponsor-grid, .tack-grid').forEach((grid) =>
        [...grid.children].forEach((el, i) => {
            if (el.classList.contains('fade-in')) el.style.setProperty('--fade-delay', ((i % 6) * 80) + 'ms');
        })
    );

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1 });
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // Räknarna på kategorikorten tickar upp från noll när kortet blir synligt
    const lugntLage = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!lugntLage) {
        const raknare = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                raknare.unobserve(entry.target);
                const el = entry.target;
                const m = el.textContent.match(/\d+/);
                if (!m) return;
                const mal = parseInt(m[0], 10);
                const suffix = el.textContent.slice(m.index + m[0].length);
                const start = performance.now();
                const tid = 900;
                const tick = (nu) => {
                    const t = Math.min((nu - start) / tid, 1);
                    el.textContent = Math.round(mal * (1 - Math.pow(1 - t, 3))) + suffix;
                    if (t < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            });
        }, { threshold: 0.4 });
        document.querySelectorAll('.kat-antal').forEach((el) => raknare.observe(el));
    }

    // Klicka-för-att-spela: miniatyrbilden byts mot YouTube-spelaren först
    // vid klick, så att sidor med många videor laddar snabbt
    document.querySelectorAll('.video-facade').forEach((btn) =>
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-yt');
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1';
            iframe.title = btn.getAttribute('aria-label') || '';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            btn.replaceWith(iframe);
        })
    );

    // "Visa fler": kategorisidor visar bara första batchen kort;
    // knappen avtäcker nästa omgång och visar hur många som är kvar
    document.querySelectorAll('.visa-fler').forEach((btn) => {
        const grid = btn.closest('section')?.querySelector('[data-batch]');
        if (!grid) return;
        btn.addEventListener('click', () => {
            const batch = parseInt(grid.getAttribute('data-batch'), 10) || 12;
            const dolda = grid.querySelectorAll('.video-block.dold');
            for (let i = 0; i < batch && i < dolda.length; i++) {
                const img = dolda[i].querySelector('img[data-src]');
                if (img) {
                    img.src = img.getAttribute('data-src');
                    img.removeAttribute('data-src');
                }
                dolda[i].classList.remove('dold');
            }
            const kvar = grid.querySelectorAll('.video-block.dold').length;
            if (kvar > 0) {
                btn.textContent = btn.getAttribute('data-text') + ' (' + kvar + ')';
            } else {
                btn.parentElement.remove();
            }
        });
    });

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const updateIcon = () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            themeToggle.textContent = isDark ? '☀️' : '🌙';
        };
        updateIcon();
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) { /* ignore */ }
            updateIcon();
        });
    }
});

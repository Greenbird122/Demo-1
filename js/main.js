/* ATIH — confident motion: reveals, count-up, mobile nav.
   Everything degrades gracefully: no JS = fully readable static page. */

(function () {
  "use strict";

  document.documentElement.classList.add("js");

  /* ---------- Hero background cross-fade ---------- */
  function initHeroBackground() {
    var layers = document.querySelectorAll(".hero-bg-layer");
    if (!layers.length) return;
    var current = 0;
    var interval = 4500;
    var timer = null;

    function advance() {
      layers[current].classList.remove("active");
      current = (current + 1) % layers.length;
      layers[current].classList.add("active");
    }
    function start() { if (timer === null) timer = setInterval(advance, interval); }
    function stop()  { if (timer !== null) { clearInterval(timer); timer = null; } }

    start();
    /* don't cycle the slideshow in a hidden tab */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else start();
    });
  }

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    var items = document.querySelectorAll("[data-animate]");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    items.forEach(function (item) { observer.observe(item); });
  }

  /* ---------- Stat count-up ---------- */
  function initCountUp() {
    var counters = document.querySelectorAll("[data-countup]");
    if (!counters.length) return;

    function render(el) {
      var target = parseInt(el.getAttribute("data-countup"), 10);
      var suffix = el.getAttribute("data-suffix") || "";
      var duration = 1400;
      var start = null;

      if (!("requestAnimationFrame" in window)) {
        el.textContent = target + suffix;
        return;
      }

      function tick(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    if (!("IntersectionObserver" in window)) {
      counters.forEach(render);
      return;
    }

    var seen = new WeakMap();
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !seen.has(entry.target)) {
            seen.set(entry.target, true);
            render(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach(function (c) { observer.observe(c); });
  }

  /* ---------- Header shadow on scroll ----------
     rAF-throttled and state-guarded: the scroll event fires far faster than
     we can paint, and writing the same style every event forces needless work. */
  function initHeader() {
    var header = document.querySelector(".site-header");
    if (!header) return;

    var shadowed = null;
    function update() {
      var on = window.scrollY > 8;
      if (on === shadowed) return;
      shadowed = on;
      header.style.boxShadow = on ? "0 8px 24px rgba(10,22,40,0.08)" : "none";
    }

    var ticking = false;
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
  }

  /* ---------- Carousels: scroll-snap + controls ----------
     Native touch swipe always works. Buttons scroll one slide at a time.
     A broken/missing image gets marked .broken so its slide collapses
     gracefully until real files are dropped in. */
  function initCarousels() {
    var carousels = document.querySelectorAll("[data-carousel]");
    if (!carousels.length) return;

    Array.prototype.forEach.call(carousels, function (root) {
      var track = root.querySelector(".carousel-track");
      if (!track) return;

      var prev = root.querySelector(".carousel-btn--prev");
      var next = root.querySelector(".carousel-btn--next");
      var count = root.querySelector(".carousel-count");

      // collapse slides whose image failed to load (placeholder hygiene)
      root.querySelectorAll(".carousel-slide img").forEach(function (img) {
        if (img.complete && img.naturalWidth === 0) {
          img.classList.add("broken");
          var slide = img.closest(".carousel-slide");
          if (slide) slide.style.display = "none";
        } else {
          img.addEventListener("error", function () {
            img.classList.add("broken");
            var slide = img.closest(".carousel-slide");
            if (slide) slide.style.display = "none";
          });
        }
      });

      function slides() {
        return Array.prototype.filter.call(
          root.querySelectorAll(".carousel-slide"),
          function (s) { return s.style.display !== "none"; }
        );
      }

      function currentIndex() {
        var w = track.clientWidth || 1;
        return Math.round(track.scrollLeft / w);
      }

      function update() {
        var list = slides();
        var i = Math.min(currentIndex(), list.length - 1);
        if (count) count.textContent = (i + 1) + " / " + list.length;
        if (prev) prev.disabled = track.scrollLeft <= 4;
        if (next) next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
      }

      function go(dir) {
        var w = track.clientWidth || 1;
        track.scrollBy({ left: dir * w, behavior: "smooth" });
      }

      if (prev) prev.addEventListener("click", function () { go(-1); });
      if (next) next.addEventListener("click", function () { go(1); });

      /* ---------- auto-advance (opt-in via data-auto) ----------
         Pauses on hover, keyboard focus or touch. Any manual
         interaction stops it for good. Off entirely if the visitor
         prefers reduced motion. */
      if (root.hasAttribute("data-auto")) {
        var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        var timer = null;
        var stopped = false;

        function startAuto() {
          if (stopped || reduceMotion || timer) return;
          timer = setInterval(function () {
            var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
            if (atEnd) {
              track.scrollTo({ left: 0, behavior: "smooth" });
            } else {
              go(1);
            }
          }, 5000);
        }

        function stopAuto() {
          if (timer) { clearInterval(timer); timer = null; }
        }

        function stopForGood() {
          stopped = true;
          stopAuto();
        }

        root.addEventListener("mouseenter", stopAuto);
        root.addEventListener("mouseleave", function () { if (!stopped) startAuto(); });
        root.addEventListener("focusin", stopAuto);
        root.addEventListener("focusout", function () { if (!stopped) startAuto(); });
        track.addEventListener("touchstart", function () { stopForGood(); }, { passive: true });
        if (prev) prev.addEventListener("click", stopForGood);
        if (next) next.addEventListener("click", stopForGood);

        startAuto();
      }

      var ticking = false;
      track.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { update(); ticking = false; });
      }, { passive: true });

      window.addEventListener("resize", update);
      update();
    });
  }

  /* ---------- Freeze-scroll sections ----------
     Text and image frame stick while the section scrolls; images cycle
     in sync with the PINNED window (desktop side-by-side and mobile
     stacked text-then-frame both work off the same math).
     No JS = static layout, first image visible, still fully readable. */
  function initFreezeSections() {
    var sections = document.querySelectorAll(".freeze-section[data-freeze]");
    if (!sections.length) return;

    var mobileTimers = [];

    function clearMobileTimers() {
      mobileTimers.forEach(function (t) { clearInterval(t); });
      mobileTimers = [];
    }

    function setActiveImage(section, idx) {
      var images = section.querySelectorAll(".freeze-image");
      var dots = section.querySelectorAll(".freeze-dot");
      images.forEach(function (img, i) {
        img.classList.toggle("active", i === idx);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("active", i === idx);
      });
    }

    function initMobileSection(section) {
      var dots = section.querySelectorAll(".freeze-dot");
      var images = section.querySelectorAll(".freeze-image");
      var visual = section.querySelector(".freeze-visual");
      if (!images.length || !visual) return;

      var currentIdx = 0;
      setActiveImage(section, 0);

      dots.forEach(function (dot, i) {
        dot.addEventListener("click", function (e) {
          e.stopPropagation();
          currentIdx = i;
          setActiveImage(section, currentIdx);
        });
      });

      var startX = 0;
      visual.addEventListener("touchstart", function (e) {
        startX = e.touches[0].clientX;
      }, { passive: true });

      visual.addEventListener("touchend", function (e) {
        var endX = e.changedTouches[0].clientX;
        var diff = startX - endX;
        if (Math.abs(diff) > 35) {
          if (diff > 0) {
            currentIdx = (currentIdx + 1) % images.length;
          } else {
            currentIdx = (currentIdx - 1 + images.length) % images.length;
          }
          setActiveImage(section, currentIdx);
        }
      }, { passive: true });

      var timer = setInterval(function () {
        if (window.innerWidth <= 820) {
          var rect = section.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            currentIdx = (currentIdx + 1) % images.length;
            setActiveImage(section, currentIdx);
          }
        }
      }, 3500);
      mobileTimers.push(timer);
    }

    function updateDesktop() {
      if (window.innerWidth <= 820) return;
      sections.forEach(function (section) {
        var visual = section.querySelector(".freeze-visual");
        var images = section.querySelectorAll(".freeze-image");
        if (!visual || !images.length) return;

        var rect = section.getBoundingClientRect();
        var total = images.length;
        var scrollDistance = rect.height - window.innerHeight;
        var progress = 0;

        if (scrollDistance > 0) {
          progress = -rect.top / scrollDistance;
          progress = Math.max(0, Math.min(0.999, progress));
        }

        var idx = Math.floor(progress * total);
        idx = Math.max(0, Math.min(total - 1, idx));
        setActiveImage(section, idx);
      });
    }

    function setup() {
      clearMobileTimers();
      if (window.innerWidth <= 820) {
        sections.forEach(initMobileSection);
      } else {
        updateDesktop();
      }
    }

    setup();

    var ticking = false;
    function onScroll() {
      if (window.innerWidth > 820) {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { updateDesktop(); ticking = false; });
      }
    }

    var resizeTimer = null;
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setup, 200);
    });
  }

    /* ---------- Social sticky bar ---------- */
  function initSocialSticky() {
    var bar = document.querySelector(".social-sticky");
    if (bar) return;

    var html = '<div class="social-sticky" aria-label="Social media links">' +
      '<a href="https://www.linkedin.com/in/austine-wandera-b14523344/" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg></a>' +
      '<a href="https://github.com/Greenbird122" target="_blank" rel="noopener" aria-label="GitHub"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg></a>' +
      '<a href="https://x.com/austinetech" target="_blank" rel="noopener" aria-label="X"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>' +
      '<a href="https://www.youtube.com/@austinetech" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg></a>' +
      '<a href="https://www.tiktok.com/@austinetech" target="_blank" rel="noopener" aria-label="TikTok"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a>' +
      '</div>';
    document.body.insertAdjacentHTML("beforeend", html);
  }

  /* ---------- Horizontal scroll gallery ----------
     Vertical scroll through the section drives the gallery track left-to-right. */
  function initHorizontalGallery() {
    var section = document.querySelector("[data-horizontal-scroll]");
    if (!section) return;
    var track = section.querySelector(".scroll-gallery-track");
    if (!track) return;

    function update() {
      if (window.innerWidth <= 820) {
        track.style.transform = "";
        return;
      }
      var rect = section.getBoundingClientRect();
      var total = rect.height - window.innerHeight;
      var progress = total > 0 ? (-rect.top / total) : 0;
      progress = Math.max(0, Math.min(1, progress));
      var containerWidth = track.parentElement.clientWidth;
      var maxScroll = Math.max(0, track.scrollWidth - containerWidth);
      track.style.transform = "translateX(" + (-progress * maxScroll) + "px)";
    }

    /* read layout inside rAF, not in the event handler: measuring
       getBoundingClientRect/scrollWidth on every scroll forces a sync layout */
    var ticking = false;
    function schedule() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { update(); ticking = false; });
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    update();
  }

  /* ---------- Animated bands: only run the gradient spin while on screen ----------
     The bands otherwise repaint every frame for the life of the page, even when
     scrolled away. Pausing off-screen keeps the look and drops the cost. */
  function initAnimatedBands() {
    var bands = document.querySelectorAll(".stats-band, .cta-band");
    if (!bands.length) return;

    if (!("IntersectionObserver" in window)) {
      bands.forEach(function (b) { b.classList.add("in-view"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("in-view", entry.isIntersecting);
      });
    }, { threshold: 0 });

    bands.forEach(function (b) { observer.observe(b); });
  }

  /* ---------- Contact form (mailto)
     POST to mailto: is unreliable across browsers — build the mailto: URL
     from the fields instead. Still no backend, nothing leaves the page. */
  function initContactForm() {
    var form = document.querySelector("form.contact-form");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var address = (form.getAttribute("action") || "").replace(/^mailto:/, "").split("?")[0];
      var nameField = form.querySelector('[name="name"]');
      var subject = "Enquiry from " + ((nameField && nameField.value.trim()) || "the website");
      var body = [];
      form.querySelectorAll("input, select, textarea").forEach(function (field) {
        if (!field.name) return;
        var value = field.value.trim();
        if (value) body.push(field.name.charAt(0).toUpperCase() + field.name.slice(1) + ": " + value);
      });
      window.location.href = "mailto:" + address +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body.join("\r\n"));
    });
  }

  /* ---------- Typewriter hero ----------
     Types the site name once, then cycles "We build" words. */
  function initTypewriter() {
    var title = document.querySelector(".typewriter-text[data-type]");
    var rotator = document.querySelector(".typewriter-rotator[data-words]");
    if (!title && !rotator) return;

    function typeText(el, text, speed, callback) {
      var i = 0;
      function step() {
        if (i <= text.length) {
          el.textContent = text.slice(0, i);
          i++;
          setTimeout(step, speed);
        } else if (callback) {
          callback();
        }
      }
      step();
    }

    if (title) {
      // small delay so the container finishes laying out before typing starts
      setTimeout(function () {
        typeText(title, title.getAttribute("data-type"), 70);
      }, 300);
    }

    if (rotator) {
      var words = rotator.getAttribute("data-words").split(",");
      var current = 0;
      var isDeleting = false;
      var index = 0;

      function tick() {
        var full = words[current];
        if (isDeleting) {
          index = Math.max(0, index - 1);
          if (index === 0) {
            isDeleting = false;
            current = (current + 1) % words.length;
          }
        } else {
          index++;
          if (index >= full.length) {
            isDeleting = true;
          }
        }
        rotator.textContent = full.slice(0, index);
        var pause = isDeleting ? 50 : 100;
        if (index === full.length && isDeleting) pause = 1500;
        setTimeout(tick, pause);
      }

      setTimeout(tick, 1800);
    }
  }

  /* ---------- Gallery page filtering & lightbox ---------- */
  function initGalleryPage() {
    var filterBtns = document.querySelectorAll(".gallery-filter-btn");
    var cards = document.querySelectorAll(".gallery-card");
    var lightbox = document.getElementById("gallery-lightbox");
    if (!cards.length) return;

    // Filter switching
    filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var filter = btn.getAttribute("data-filter");
        filterBtns.forEach(function (b) {
          b.classList.remove("active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("active");
        btn.setAttribute("aria-selected", "true");

        cards.forEach(function (card) {
          var category = card.getAttribute("data-category");
          if (filter === "all" || category === filter) {
            card.classList.remove("is-hidden");
          } else {
            card.classList.add("is-hidden");
          }
        });
      });
    });

    // Lightbox modal functionality
    if (lightbox) {
      var overlay = lightbox.querySelector(".lightbox-overlay");
      var closeBtn = lightbox.querySelector(".lightbox-close");
      var img = lightbox.querySelector(".lightbox-img");
      var title = lightbox.querySelector(".lightbox-title");
      var desc = lightbox.querySelector(".lightbox-desc");

      function openLightbox(card) {
        var cardImg = card.querySelector(".gallery-card-media img");
        var cardTitle = card.querySelector(".gallery-card-title");
        var cardDesc = card.querySelector(".gallery-card-text");

        if (img && cardImg) {
          img.src = cardImg.src;
          img.alt = cardImg.alt || "";
        }
        if (title && cardTitle) title.textContent = cardTitle.textContent;
        if (desc && cardDesc) desc.textContent = cardDesc.textContent;

        lightbox.classList.add("is-open");
        lightbox.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
      }

      function closeLightbox() {
        lightbox.classList.remove("is-open");
        lightbox.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
      }

      cards.forEach(function (card) {
        card.addEventListener("click", function () {
          openLightbox(card);
        });
      });

      if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
      if (overlay) overlay.addEventListener("click", closeLightbox);

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && lightbox.classList.contains("is-open")) {
          closeLightbox();
        }
      });
    }
  }

  function init() {
    initHeroBackground();
    initSocialSticky();
    initNav();
    initReveal();
    initCountUp();
    initHeader();
    initContactForm();
    initAnimatedBands();
    initCarousels();
    initFreezeSections();
    initHorizontalGallery();
    initTypewriter();
    initGalleryPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

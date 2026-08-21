(function(){
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* load-in */
  window.addEventListener("load", function(){
    requestAnimationFrame(function(){ document.body.classList.add("loaded"); });
  });
  // failsafe in case 'load' is slow
  setTimeout(function(){ document.body.classList.add("loaded"); }, 1200);

  document.getElementById("year").textContent = new Date().getFullYear();

  /* --- scroll: nav bg, progress line, frame counter --- */
  var nav = document.getElementById("nav");
  var scanline = document.getElementById("scanline");
  var frameCount = document.getElementById("frameCount");

  function pad3(n){ return ("00" + n).slice(-3); }

  function onScroll(){
    var st = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? st / h : 0;

    nav.classList.toggle("scrolled", st > 40);
    scanline.style.width = (p * 100) + "%";

    var frame = Math.min(36, Math.max(1, Math.ceil(p * 36)));
    frameCount.textContent = pad3(frame);
  }
  window.addEventListener("scroll", onScroll, { passive:true });
  onScroll();

  /* --- reveal on scroll (section headlines cascade in) --- */
  var revealEls = [].slice.call(document.querySelectorAll("[data-reveal]"));
  var staggerGroups = [].slice.call(document.querySelectorAll("[data-stagger]"));

  if ("IntersectionObserver" in window && !reduce){
    // Section headlines: reveal their parts one after another, then trace the underline.
    var groupObs = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (!e.isIntersecting) return;
        var group = e.target;
        var step = parseInt(group.getAttribute("data-stagger"), 10) || 90;
        var items = group.querySelectorAll("[data-reveal]");
        for (var i = 0; i < items.length; i++){
          items[i].style.transitionDelay = (i * step) + "ms";
          items[i].classList.add("in-view");
        }
        group.classList.add("in-view");
        groupObs.unobserve(group);
      });
    }, { threshold:0.35, rootMargin:"0px 0px -12% 0px" });
    staggerGroups.forEach(function(g){ groupObs.observe(g); });

    // Everything else reveals individually as it enters the frame.
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){ e.target.classList.add("in-view"); io.unobserve(e.target); }
      });
    }, { threshold:0.12, rootMargin:"0px 0px -8% 0px" });
    revealEls.forEach(function(el){
      if (!el.closest("[data-stagger]")) io.observe(el);
    });
  } else {
    revealEls.forEach(function(el){ el.classList.add("in-view"); });
    staggerGroups.forEach(function(g){ g.classList.add("in-view"); });
  }

  /* --- active section in nav + HUD --- */
  var sections = document.querySelectorAll("section[id]");
  var navLinks = document.querySelectorAll("[data-nav]");
  var sectionName = document.getElementById("sectionName");
  var labelMap = { home:"HOME", about:"ABOUT", approach:"APPROACH", cities:"CITIES", portfolio:"PORTFOLIO", contact:"CONTACT" };

  if ("IntersectionObserver" in window){
    var io2 = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if (e.isIntersecting){
          var id = e.target.id;
          navLinks.forEach(function(a){
            a.classList.toggle("active", a.getAttribute("href") === "#" + id);
          });
          if (sectionName && labelMap[id]) sectionName.textContent = labelMap[id];
        }
      });
    }, { threshold:0.5 });
    sections.forEach(function(s){ io2.observe(s); });
  }

  /* --- mobile menu --- */
  var menuBtn = document.getElementById("menuBtn");
  var mobileMenu = document.getElementById("mobileMenu");
  function setMenu(open){
    mobileMenu.classList.toggle("open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
  }
  menuBtn.addEventListener("click", function(){ setMenu(!mobileMenu.classList.contains("open")); });
  document.querySelectorAll("[data-mnav]").forEach(function(a){ a.addEventListener("click", function(){ setMenu(false); }); });
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && mobileMenu.classList.contains("open")) setMenu(false); });
  window.addEventListener("resize", function(){ if (window.innerWidth > 720 && mobileMenu.classList.contains("open")) setMenu(false); });

  /* --- cursor focus reticle (desktop, fine pointer only) --- */
  var reticle = document.getElementById("reticle");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine && !reduce){
    var rx = 0, ry = 0, cx = 0, cy = 0, shown = false, raf;
    window.addEventListener("mousemove", function(ev){
      rx = ev.clientX; ry = ev.clientY;
      if (!shown){ reticle.style.opacity = "0.85"; shown = true; }
      if (!raf) raf = requestAnimationFrame(tick);
    });
    function tick(){
      cx += (rx - cx) * 0.22; cy += (ry - cy) * 0.22;
      reticle.style.transform = "translate(" + cx + "px," + cy + "px)";
      if (Math.abs(rx-cx) > 0.3 || Math.abs(ry-cy) > 0.3){ raf = requestAnimationFrame(tick); }
      else { raf = null; }
    }
    document.addEventListener("mouseleave", function(){ reticle.style.opacity = "0"; shown = false; });
  }

  /* --- lightbox / gallery: tap to open, swipe or arrows to move, counter + focus --- */
  var lightbox = document.getElementById("lightbox");
  var lbImg = document.getElementById("lbImg");
  var lbCap = document.getElementById("lbCap");
  var lbCount = document.getElementById("lbCount");
  var lbClose = document.getElementById("lbClose");
  var lbPrev = document.getElementById("lbPrev");
  var lbNext = document.getElementById("lbNext");

  // every gallery photo, across all sections, in document order
  var figs = [].slice.call(document.querySelectorAll(".grid .frame"))
                .filter(function(f){ return f.querySelector("img"); });
  var current = -1, lastFocus = null;

  function capOf(f){ var c = f.querySelector(".frame__cap"); return c ? c.textContent.replace(/\s+/g," ").trim() : ""; }
  function showAt(i){
    if (!figs.length) return;
    current = (i + figs.length) % figs.length;
    var img = figs[current].querySelector("img");
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt || "";
    lbCap.textContent = capOf(figs[current]);
    lbCount.textContent = (current + 1) + " / " + figs.length;
  }
  function openLb(i){
    lastFocus = document.activeElement;
    showAt(i);
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
    lbClose.focus();
  }
  function closeLb(){
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  var galleryRoot = document.getElementById("portfolio");
  if (galleryRoot) galleryRoot.addEventListener("click", function(ev){
    var fig = ev.target.closest(".frame");
    if (!fig || !fig.querySelector("img")) return;
    var idx = figs.indexOf(fig);
    if (idx >= 0) openLb(idx);
  });
  lbClose.addEventListener("click", closeLb);
  lbPrev.addEventListener("click", function(e){ e.stopPropagation(); showAt(current - 1); });
  lbNext.addEventListener("click", function(e){ e.stopPropagation(); showAt(current + 1); });
  lightbox.addEventListener("click", function(ev){ if (ev.target === lightbox) closeLb(); });
  document.addEventListener("keydown", function(ev){
    if (!lightbox.classList.contains("open")) return;
    if (ev.key === "Escape") closeLb();
    else if (ev.key === "ArrowLeft") showAt(current - 1);
    else if (ev.key === "ArrowRight") showAt(current + 1);
  });

  // swipe left/right on touch to move between photos
  var tsx = 0, tsy = 0;
  lightbox.addEventListener("touchstart", function(ev){ tsx = ev.changedTouches[0].clientX; tsy = ev.changedTouches[0].clientY; }, {passive:true});
  lightbox.addEventListener("touchend", function(ev){
    var dx = ev.changedTouches[0].clientX - tsx, dy = ev.changedTouches[0].clientY - tsy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) showAt(current + (dx < 0 ? 1 : -1));
  }, {passive:true});

  figs.forEach(function(f){ f.style.cursor = "zoom-in"; });
})();

(function () {
  "use strict";

  const CASES_DATA_URL = "./data/cases.json";
  const FALLBACK_CASE_ID = "demo-3d";

  const els = {
    landingScreen: document.getElementById("landing-screen"),
    caseBadge: document.getElementById("case-badge"),
    caseTitle: document.getElementById("case-title"),
    caseSubtitle: document.getElementById("case-subtitle"),
    statusBox: document.getElementById("status-box"),
    btnStartAr: document.getElementById("btn-start-ar"),
    btnScannerMode: document.getElementById("btn-scanner-mode"),
    btnPreviewMode: document.getElementById("btn-preview-mode"),
    arContainer: document.getElementById("ar-container"),
    scanningOverlay: document.getElementById("scanning-overlay"),
    hudTitle: document.getElementById("hud-title"),
    scanInstruction: document.getElementById("scan-instruction"),
    btnExitAr: document.getElementById("btn-exit-ar"),
    arControls: document.getElementById("ar-controls"),
    videoMediaBar: document.getElementById("video-media-bar"),
    btnToggleMute: document.getElementById("btn-toggle-mute"),
    btnReplay: document.getElementById("btn-replay"),
    ctaContainer: document.getElementById("cta-container"),
    previewModal: document.getElementById("preview-modal"),
    previewTitle: document.getElementById("preview-title"),
    previewVideoWrap: document.getElementById("preview-video-wrap"),
    previewVideo: document.getElementById("preview-video"),
    previewImageWrap: document.getElementById("preview-image-wrap"),
    previewImage: document.getElementById("preview-image"),
    preview3dNote: document.getElementById("preview-3d-note"),
    previewCtaContainer: document.getElementById("preview-cta-container"),
    btnClosePreview: document.getElementById("btn-close-preview"),
  };

  let allCases = {};
  let activeCase = null;
  let isScannerMode = false;
  let arVideoEl = null;

  function showStatus(message, isInfo = false) {
    els.statusBox.textContent = message;
    els.statusBox.classList.toggle("info", isInfo);
    els.statusBox.classList.remove("hidden");
  }

  function hideStatus() {
    els.statusBox.classList.add("hidden");
  }

  function applyTheme(color) {
    if (!color || typeof color !== "string") return;
    document.documentElement.style.setProperty("--accent", color);
  }

  function renderCtaButtons(container, buttons) {
    container.innerHTML = "";
    if (!Array.isArray(buttons) || buttons.length === 0) return;
    buttons.forEach((btn) => {
      if (!btn || !btn.label || !btn.url) return;
      const a = document.createElement("a");
      a.className = "cta-link";
      a.href = btn.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = btn.icon ? `${btn.icon} ${btn.label}` : btn.label;
      container.appendChild(a);
    });
  }

  function getQueryParams() {
    return new URLSearchParams(window.location.search);
  }

  async function verifyAssetExists(url) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      return res.ok;
    } catch (_) {
      return false;
    }
  }

  function buildTargetEntityMarkup(caseObj, indexOverride) {
    const tIndex = Number.isInteger(indexOverride) ? indexOverride : (Number(caseObj.targetIndex) || 0);
    const type = caseObj.type || "video";

    if (type === "3d") {
      const scale = caseObj.modelScale || "0.85 0.85 0.85";
      const pos = caseObj.modelPosition || "0 0 0.12";
      const rot = caseObj.modelRotation || "0 0 0";
      return `
        <a-entity class="case-target" data-case-type="3d" data-title="${escapeAttr(caseObj.title)}" mindar-image-target="targetIndex: ${tIndex}">
          <a-gltf-model
            src="#ar-model-${tIndex}"
            position="${pos}"
            rotation="${rot}"
            scale="${scale}"
            animation="property: rotation; to: 0 360 0; loop: true; dur: 7000; easing: linear"
          ></a-gltf-model>
        </a-entity>
      `;
    }

    if (type === "image") {
      const w = Number(caseObj.imageWidth) || 1;
      const h = Number(caseObj.imageHeight) || 1.4;
      return `
        <a-entity class="case-target" data-case-type="image" data-title="${escapeAttr(caseObj.title)}" mindar-image-target="targetIndex: ${tIndex}">
          <a-image src="#ar-img-${tIndex}" position="0 0 0.05" width="${w}" height="${h}"></a-image>
        </a-entity>
      `;
    }

    const vw = Number(caseObj.videoWidth) || 1;
    const vh = Number(caseObj.videoHeight) || 1.35;
    return `
      <a-entity class="case-target" data-case-type="video" data-title="${escapeAttr(caseObj.title)}" mindar-image-target="targetIndex: ${tIndex}">
        <a-video src="#ar-video-${tIndex}" position="0 0 0" width="${vw}" height="${vh}" rotation="0 0 0"></a-video>
      </a-entity>
    `;
  }

  function buildAssetsMarkup(targetList) {
    return targetList
      .map(({ caseObj, tIndex }) => {
        const type = caseObj.type || "video";
        if (type === "3d") {
          return `<a-asset-item id="ar-model-${tIndex}" src="${caseObj.modelUrl}"></a-asset-item>`;
        }
        if (type === "image") {
          return `<img id="ar-img-${tIndex}" src="${caseObj.imageUrl}" crossorigin="anonymous" />`;
        }
        return `<video id="ar-video-${tIndex}" src="${caseObj.videoUrl}" preload="auto" loop muted playsinline webkit-playsinline crossorigin="anonymous"></video>`;
      })
      .join("\n");
  }

  function escapeAttr(str) {
    return String(str || "").replace(/"/g, "&quot;");
  }

  async function loadCaseConfig() {
    const params = getQueryParams();
    isScannerMode = params.get("mode") === "scanner";

    try {
      const response = await fetch(CASES_DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      allCases = data && data.cases ? data.cases : {};

      const defaultId = data.defaultCaseId || FALLBACK_CASE_ID;
      const requestedId = (params.get("id") || defaultId).trim();

      if (isScannerMode) {
        activeCase = allCases[defaultId] || Object.values(allCases)[0];
        els.caseBadge.textContent = "الماسح المباشر";
        els.caseTitle.textContent = "ماسح الكفرات المباشر (AR)";
        els.caseSubtitle.textContent = "افتح الكاميرا ووجّهها نحو أي كفر أو بطاقة QR ليظهر الـ AR فوراً";
        els.hudTitle.textContent = "الماسح المباشر";
        els.btnScannerMode.classList.add("hidden");
        els.btnStartAr.disabled = false;
        els.btnPreviewMode.disabled = false;
        if (params.get("autostart") === "1") {
          startArExperience(true);
        }
        return;
      }

      if (!allCases[requestedId]) {
        els.caseTitle.textContent = "لم يتم العثور على هذا الرمز";
        els.caseSubtitle.textContent = `الرمز (${requestedId}) غير مسجّل في ملف cases.json حالياً.`;
        showStatus("تأكد من صحة رابط الـ QR أو افتح الرابط الرئيسي للموقع.");
        return;
      }

      activeCase = allCases[requestedId];
      applyTheme(activeCase.themeColor);

      els.caseBadge.textContent = activeCase.badge || `طلب #${requestedId}`;
      els.caseTitle.textContent = activeCase.title || "تجربة الواقع المعزز";
      els.caseSubtitle.textContent =
        activeCase.subtitle || "وجّه الكاميرا نحو رمز QR أو تصميم الكفر";
      els.hudTitle.textContent = activeCase.title || "AR Case";

      renderCtaButtons(els.ctaContainer, activeCase.ctaButtons);
      renderCtaButtons(els.previewCtaContainer, activeCase.ctaButtons);

      els.btnStartAr.disabled = false;
      els.btnPreviewMode.disabled = false;

      if (params.get("preview") === "1") {
        openPreviewMode();
        return;
      }

      // تشغيل الكاميرا تلقائياً إذا فُتح من مسح QR وكان autoStartCamera مفعّلاً
      if (activeCase.autoStartCamera || params.get("autostart") === "1") {
        startArExperience(true);
      }
    } catch (err) {
      els.caseTitle.textContent = "تعذّر تحميل بيانات المنصة";
      els.caseSubtitle.textContent = "تأكد من تشغيل المشروع عبر GitHub Pages أو سيرفر محلي.";
      showStatus(`تفاصيل الخطأ: ${err.message}`);
    }
  }

  async function startArExperience(isAuto = false) {
    if (!activeCase) return;
    hideStatus();

    if (!window.isSecureContext) {
      if (!isAuto) {
        showStatus("تشغيل الكاميرا يتطلب HTTPS (GitHub Pages أو localhost). يمكنك استخدام زر المعاينة بالأسفل.");
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showStatus("متصفحك الحالي لا يدعم الوصول للكاميرا. افتح الرابط في Safari أو Chrome.");
      return;
    }

    const mindUrl = activeCase.targetMindUrl || "./assets/targets.mind";
    const targetExists = await verifyAssetExists(mindUrl);
    if (!targetExists) {
      showStatus(
        `ملف التتبع (${mindUrl}) غير موجود بعد في مجلد assets. حوّل صورة الكفر أو بطاقة الـ QR عبر محول MindAR وارفعه هناك.`
      );
      return;
    }

    els.landingScreen.classList.add("hidden");
    els.arContainer.classList.remove("hidden");
    els.arContainer.setAttribute("aria-hidden", "false");
    els.scanningOverlay.classList.remove("hidden");
    els.scanInstruction.textContent = "جاري تشغيل الكاميرا ومحرك الواقع المعزز...";

    const targetList = isScannerMode
      ? [{ caseObj: activeCase, tIndex: 0 }]
      : [{ caseObj: activeCase, tIndex: Number(activeCase.targetIndex) || 0 }];

    const assetsMarkup = buildAssetsMarkup(targetList);
    const entitiesMarkup = targetList
      .map(({ caseObj, tIndex }) => buildTargetEntityMarkup(caseObj, tIndex))
      .join("\n");

    els.arContainer.innerHTML = `
      <a-scene
        id="mindar-scene"
        mindar-image="imageTargetSrc: ${mindUrl}; autoStart: true; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: 0.0001; filterBeta: 0.001;"
        color-space="sRGB"
        renderer="colorManagement: true, physicallyCorrectLights: true"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
      >
        <a-assets>
          ${assetsMarkup}
        </a-assets>

        <a-light type="ambient" intensity="1.3"></a-light>
        <a-light type="directional" position="1 2 2" intensity="1.5"></a-light>
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        ${entitiesMarkup}
      </a-scene>
    `;

    const sceneEl = document.getElementById("mindar-scene");
    const targetEls = sceneEl.querySelectorAll(".case-target");
    arVideoEl = sceneEl.querySelector("video");

    if (arVideoEl) {
      arVideoEl.play().then(() => {
        arVideoEl.pause();
        arVideoEl.currentTime = 0;
      }).catch(() => {});
    }

    sceneEl.addEventListener("arReady", () => {
      els.scanInstruction.textContent = "وجّه الكاميرا نحو بطاقة الـ QR أو تصميم الكفر";
    });

    sceneEl.addEventListener("arError", () => {
      stopArExperience();
      showStatus(
        isAuto
          ? "اضغط زر (ابدأ تجربة الواقع المعزز) لمنح المتصفح إذن الكاميرا."
          : "تعذّر تشغيل الكاميرا. تأكد من منح المتصفح إذن الكاميرا ثم أعد المحاولة.",
        isAuto
      );
    });

    targetEls.forEach((targetEl) => {
      targetEl.addEventListener("targetFound", () => {
        const frameWrap = els.scanningOverlay.querySelector(".scan-frame-wrap");
        if (frameWrap) frameWrap.classList.add("hidden");
        els.arControls.classList.remove("hidden");

        const cType = targetEl.getAttribute("data-case-type");
        els.videoMediaBar.classList.toggle("hidden", cType !== "video");

        if (cType === "video" && arVideoEl) {
          arVideoEl.play().catch(() => {});
        }
      });

      targetEl.addEventListener("targetLost", () => {
        const frameWrap = els.scanningOverlay.querySelector(".scan-frame-wrap");
        if (frameWrap) frameWrap.classList.remove("hidden");
        els.scanInstruction.textContent = "أعد توجيه الكاميرا نحو الـ QR أو الكفر لاستكمال العرض";
        if (arVideoEl) {
          arVideoEl.pause();
        }
      });
    });
  }

  function stopArExperience() {
    if (arVideoEl) {
      arVideoEl.pause();
      arVideoEl = null;
    }
    const sceneEl = document.getElementById("mindar-scene");
    if (sceneEl && sceneEl.systems && sceneEl.systems["mindar-image-system"]) {
      try {
        sceneEl.systems["mindar-image-system"].stop();
      } catch (_) {}
    }
    els.arContainer.innerHTML = "";
    els.arContainer.classList.add("hidden");
    els.arContainer.setAttribute("aria-hidden", "true");
    els.scanningOverlay.classList.add("hidden");
    els.arControls.classList.add("hidden");
    els.landingScreen.classList.remove("hidden");
    const frameWrap = els.scanningOverlay.querySelector(".scan-frame-wrap");
    if (frameWrap) frameWrap.classList.remove("hidden");
  }

  function openPreviewMode() {
    if (!activeCase) return;
    els.previewTitle.textContent = activeCase.title || "معاينة الكفر";
    const type = activeCase.type || "video";

    els.previewVideoWrap.classList.add("hidden");
    els.previewImageWrap.classList.add("hidden");
    els.preview3dNote.classList.add("hidden");

    if (type === "3d") {
      els.preview3dNote.classList.remove("hidden");
    } else if (type === "image") {
      els.previewImage.src = activeCase.imageUrl || "";
      els.previewImageWrap.classList.remove("hidden");
    } else {
      els.previewVideo.src = activeCase.videoUrl || "";
      els.previewVideoWrap.classList.remove("hidden");
      els.previewVideo.play().catch(() => {});
    }
    els.previewModal.classList.remove("hidden");
  }

  function closePreviewMode() {
    els.previewVideo.pause();
    els.previewModal.classList.add("hidden");
  }

  els.btnStartAr.addEventListener("click", () => startArExperience(false));
  els.btnExitAr.addEventListener("click", stopArExperience);
  els.btnPreviewMode.addEventListener("click", openPreviewMode);
  els.btnClosePreview.addEventListener("click", closePreviewMode);

  els.btnToggleMute.addEventListener("click", () => {
    if (!arVideoEl) return;
    arVideoEl.muted = !arVideoEl.muted;
    els.btnToggleMute.textContent = arVideoEl.muted ? "🔇 تشغيل الصوت" : "🔊 كتم الصوت";
  });

  els.btnReplay.addEventListener("click", () => {
    if (!arVideoEl) return;
    arVideoEl.currentTime = 0;
    arVideoEl.play().catch(() => {});
  });

  loadCaseConfig();
})();

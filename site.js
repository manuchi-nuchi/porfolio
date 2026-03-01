const ZOOM_STORAGE_KEY = "siteZoomLevel";
const TAB_TRANSFORM_STORAGE_PREFIX = "activeTabTransform:";
const NEXT_TAB_HUE_KEY = "nextActiveTabHue";
const NEXT_TAB_PATH_KEY = "nextActiveTabPath";
const NEXT_TAB_ROTATION_KEY = "nextActiveTabRotation";
const NEXT_TAB_ROTATION_PATH_KEY = "nextActiveTabRotationPath";
const TAB_ROTATION_MIN = -5;
const TAB_ROTATION_MAX = 5;
const TAB_PRESS_TRANSLATE_X_MAX = 2;
const TAB_PRESS_TRANSLATE_Y_MAX = 3;
const TAP_NAV_DELAY_MS = 140;
const MOBILE_MENU_BREAKPOINT = 860;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;

function clampZoom(level) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
}

function readSavedZoom() {
	const rawValue = localStorage.getItem(ZOOM_STORAGE_KEY);
	const parsedValue = Number.parseFloat(rawValue ?? "1");

	if (Number.isNaN(parsedValue)) {
		return 1;
	}

	return clampZoom(parsedValue);
}

function applyZoom(level) {
	const normalizedLevel = clampZoom(level);
	document.documentElement.style.zoom = "";
	document.documentElement.style.fontSize = `${normalizedLevel * 150}%`;
	localStorage.setItem(ZOOM_STORAGE_KEY, String(normalizedLevel));
}

function initializeZoomPersistence() {
	applyZoom(readSavedZoom());

	window.addEventListener(
		"wheel",
		(event) => {
			if (!event.ctrlKey) {
				return;
			}

			event.preventDefault();
			const currentZoom = readSavedZoom();
			const nextZoom = event.deltaY < 0 ? currentZoom + ZOOM_STEP : currentZoom - ZOOM_STEP;
			applyZoom(nextZoom);
		},
		{ passive: false },
	);

	window.addEventListener("keydown", (event) => {
		if (!event.ctrlKey) {
			return;
		}

		const key = event.key;
		if (key !== "+" && key !== "=" && key !== "-" && key !== "0") {
			return;
		}

		event.preventDefault();
		const currentZoom = readSavedZoom();

		if (key === "+" || key === "=") {
			applyZoom(currentZoom + ZOOM_STEP);
			return;
		}

		if (key === "-") {
			applyZoom(currentZoom - ZOOM_STEP);
			return;
		}

		applyZoom(1);
	});
}

function normalizePathname(pathname) {
	const normalized = pathname.replace(/\/+$/, "");
	return normalized || "/";
}

function getTabPathFromLink(link) {
	return normalizePathname(new URL(link.href, window.location.href).pathname);
}

function saveSelectedTabTransform(event) {
	const clickedTab = event.target.closest(".site-nav a");
	if (!clickedTab) {
		return;
	}

	const pseudoStyle = getComputedStyle(clickedTab, "::before");
	const currentTransform = pseudoStyle.transform;
	const transformValue = currentTransform && currentTransform !== "none" ? currentTransform : "matrix(1, 0, 0, 1, 0, 0)";

	const destinationPath = getTabPathFromLink(clickedTab);
	sessionStorage.setItem(`${TAB_TRANSFORM_STORAGE_PREFIX}${destinationPath}`, transformValue);

	if (clickedTab.classList.contains("active")) {
		const randomRotation = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
		sessionStorage.setItem(NEXT_TAB_ROTATION_KEY, `${randomRotation}deg`);
		sessionStorage.setItem(NEXT_TAB_ROTATION_PATH_KEY, destinationPath);
	} else {
		sessionStorage.removeItem(NEXT_TAB_ROTATION_KEY);
		sessionStorage.removeItem(NEXT_TAB_ROTATION_PATH_KEY);
	}

	const randomHue = Math.floor(Math.random() * 360);
	sessionStorage.setItem(NEXT_TAB_HUE_KEY, String(randomHue));
	sessionStorage.setItem(NEXT_TAB_PATH_KEY, destinationPath);
}

function applySavedSelectedTabTransform() {
	const activeTab = document.querySelector(".site-nav a.active");
	if (!activeTab) {
		return;
	}

	const activePath = getTabPathFromLink(activeTab);
	const savedTransform = sessionStorage.getItem(`${TAB_TRANSFORM_STORAGE_PREFIX}${activePath}`);
	if (savedTransform && savedTransform !== "none") {
		const matrix = new DOMMatrixReadOnly(savedTransform);
		const rotationDegrees = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
		const safeTranslateX = Number.isFinite(matrix.e) && Math.abs(matrix.e) < 200 ? matrix.e : 0;
		const safeTranslateY = Number.isFinite(matrix.f) && Math.abs(matrix.f) < 200 ? matrix.f : 0;

		activeTab.style.setProperty("--active-tab-translate-x", `${safeTranslateX}px`);
		activeTab.style.setProperty("--active-tab-translate-y", `${safeTranslateY}px`);
		activeTab.style.setProperty("--active-tab-rotation-clicked", `${rotationDegrees}deg`);
	}

	const savedHue = sessionStorage.getItem(NEXT_TAB_HUE_KEY);
	const savedPath = sessionStorage.getItem(NEXT_TAB_PATH_KEY);
	if (!savedHue || savedPath !== activePath) {
		return;
	}

	const savedRotation = sessionStorage.getItem(NEXT_TAB_ROTATION_KEY);
	const savedRotationPath = sessionStorage.getItem(NEXT_TAB_ROTATION_PATH_KEY);
	if (savedRotation && savedRotationPath === activePath) {
		activeTab.style.setProperty("--active-tab-rotation-clicked", savedRotation);
		sessionStorage.removeItem(NEXT_TAB_ROTATION_KEY);
		sessionStorage.removeItem(NEXT_TAB_ROTATION_PATH_KEY);
	}

	activeTab.style.setProperty("--active-tab-hue", savedHue);
	sessionStorage.removeItem(NEXT_TAB_HUE_KEY);
	sessionStorage.removeItem(NEXT_TAB_PATH_KEY);
}

function initializeResponsiveMenu(siteNav) {
	if (!siteNav.id) {
		siteNav.id = "site-nav-main";
	}

	const mobileMenuQuery = window.matchMedia(`(max-width: ${MOBILE_MENU_BREAKPOINT}px)`);
	let menuToggleButton = document.querySelector(".site-menu-toggle");

	if (!menuToggleButton) {
		menuToggleButton = document.createElement("button");
		menuToggleButton.type = "button";
		menuToggleButton.className = "site-menu-toggle";
		menuToggleButton.setAttribute("aria-controls", siteNav.id);
		menuToggleButton.setAttribute("aria-expanded", "false");
		menuToggleButton.setAttribute("aria-label", "Toggle navigation menu");
		menuToggleButton.textContent = "☰";
		document.body.prepend(menuToggleButton);
	}

	const closeMenu = () => {
		document.body.classList.remove("nav-open");
		menuToggleButton.setAttribute("aria-expanded", "false");
	};

	const toggleMenu = () => {
		const willOpen = !document.body.classList.contains("nav-open");
		document.body.classList.toggle("nav-open", willOpen);
		menuToggleButton.setAttribute("aria-expanded", willOpen ? "true" : "false");
	};

	menuToggleButton.addEventListener("click", toggleMenu);

	const resetMenuForWideScreen = () => {
		if (!mobileMenuQuery.matches) {
			closeMenu();
		}
	};

	if (typeof mobileMenuQuery.addEventListener === "function") {
		mobileMenuQuery.addEventListener("change", resetMenuForWideScreen);
	} else {
		mobileMenuQuery.addListener(resetMenuForWideScreen);
	}

	siteNav.querySelectorAll("a").forEach((tabLink) => {
		tabLink.addEventListener("click", () => {
			if (mobileMenuQuery.matches) {
				closeMenu();
			}
		});
	});

	resetMenuForWideScreen();
}

function initializeTabSelectionPersistence() {
	const siteNav = document.querySelector(".site-nav");
	if (!siteNav) {
		return;
	}

	initializeResponsiveMenu(siteNav);
	applySavedSelectedTabTransform();
	siteNav.addEventListener("click", saveSelectedTabTransform);

	const tabs = Array.from(siteNav.querySelectorAll("a"));
	tabs.forEach((tab) => {
		let pressStartedFromTouch = false;

		const randomizeStartPhase = () => {
			tab.style.setProperty("--tab-phase-start-x", `${Math.floor(Math.random() * 360)}deg`);
			tab.style.setProperty("--tab-phase-start-y", `${Math.floor(Math.random() * 360)}deg`);
		};

		const applyRandomPressTilt = () => {
			const pressTilt = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
			const pressTranslateX = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_X_MAX;
			const pressTranslateY = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_Y_MAX;
			tab.style.setProperty("--tab-press-tilt", `${pressTilt}deg`);
			tab.style.setProperty("--tab-press-translate-x", `${pressTranslateX}px`);
			tab.style.setProperty("--tab-press-translate-y", `${pressTranslateY}px`);
			tab.classList.add("mobile-pressed");
		};

		const handlePointerDown = (event) => {
			if (event.pointerType === "mouse") {
				pressStartedFromTouch = false;
				return;
			}

			pressStartedFromTouch = true;
			applyRandomPressTilt();
		};

		const handlePointerUp = (event) => {
			if (event.pointerType === "mouse") {
				clearPressTilt();
				return;
			}

			setTimeout(clearPressTilt, TAP_NAV_DELAY_MS);
		};

		const handleTouchStart = () => {
			pressStartedFromTouch = true;
			applyRandomPressTilt();
		};

		const handleTouchEnd = () => {
			setTimeout(clearPressTilt, TAP_NAV_DELAY_MS);
		};

		const clearPressTilt = () => {
			pressStartedFromTouch = false;
			tab.classList.remove("mobile-pressed");
		};

		const handleTabClick = (event) => {
			if (!pressStartedFromTouch) {
				return;
			}

			const destinationUrl = new URL(tab.href, window.location.href);
			if (destinationUrl.href === window.location.href) {
				setTimeout(clearPressTilt, TAP_NAV_DELAY_MS);
				return;
			}

			event.preventDefault();
			setTimeout(() => {
				window.location.href = destinationUrl.href;
			}, TAP_NAV_DELAY_MS);
		};

		randomizeStartPhase();
		tab.addEventListener("mouseenter", randomizeStartPhase);
		tab.addEventListener("focus", randomizeStartPhase);

		tab.addEventListener("pointerdown", handlePointerDown);
		tab.addEventListener("pointerup", handlePointerUp);
		tab.addEventListener("pointercancel", clearPressTilt);
		tab.addEventListener("touchstart", handleTouchStart, { passive: true });
		tab.addEventListener("touchend", handleTouchEnd);
		tab.addEventListener("touchcancel", clearPressTilt);
		tab.addEventListener("click", handleTabClick);
		tab.addEventListener("blur", clearPressTilt);
	});
}

initializeZoomPersistence();

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeTabSelectionPersistence);
} else {
	initializeTabSelectionPersistence();
}

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
const MOBILE_MENU_BREAKPOINT = 1000;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const BOTTOM_CIRCLE_MOVE_SPEED_PX_PER_SECOND = 400;
const BOTTOM_CIRCLE_ACCELERATION_PX_PER_SECOND_SQUARED = 800;
const BOTTOM_CIRCLE_DECELERATION_PX_PER_SECOND_SQUARED = 300;
const BOTTOM_CIRCLE_SEEK_MAX_SPEED_PX_PER_SECOND = 140;
const BOTTOM_CIRCLE_SEEK_ACCELERATION_PX_PER_SECOND_SQUARED = 220;
const BOTTOM_CIRCLE_SEEK_IDLE_DELAY_MS = 2000;
const BOTTOM_SQUARE_RUNNER_SPEED_PX_PER_SECOND = 100;
const BOTTOM_SQUARE_RUNNER_STATE_KEY = "bottomSquareRunnerState";
const BOTTOM_CIRCLE_STATE_KEY = "bottomCircleState";

function readStorageItem(storage, key) {
	try {
		return storage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorageItem(storage, key, value) {
	try {
		storage.setItem(key, value);
	} catch {
	}
}

function removeStorageItem(storage, key) {
	try {
		storage.removeItem(key);
	} catch {
	}
}

function clampZoom(level) {
	return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
}

function readSavedZoom() {
	const rawValue = readStorageItem(localStorage, ZOOM_STORAGE_KEY);
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
	writeStorageItem(localStorage, ZOOM_STORAGE_KEY, String(normalizedLevel));
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

	if (clickedTab.classList.contains("secret-tab")) {
		return;
	}

	const pseudoStyle = getComputedStyle(clickedTab, "::before");
	const currentTransform = pseudoStyle.transform;
	const transformValue = currentTransform && currentTransform !== "none" ? currentTransform : "matrix(1, 0, 0, 1, 0, 0)";

	const destinationPath = getTabPathFromLink(clickedTab);
	writeStorageItem(sessionStorage, `${TAB_TRANSFORM_STORAGE_PREFIX}${destinationPath}`, transformValue);

	if (clickedTab.classList.contains("active")) {
		const randomRotation = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
		writeStorageItem(sessionStorage, NEXT_TAB_ROTATION_KEY, `${randomRotation}deg`);
		writeStorageItem(sessionStorage, NEXT_TAB_ROTATION_PATH_KEY, destinationPath);
	} else {
		removeStorageItem(sessionStorage, NEXT_TAB_ROTATION_KEY);
		removeStorageItem(sessionStorage, NEXT_TAB_ROTATION_PATH_KEY);
	}

	const randomHue = Math.floor(Math.random() * 360);
	writeStorageItem(sessionStorage, NEXT_TAB_HUE_KEY, String(randomHue));
	writeStorageItem(sessionStorage, NEXT_TAB_PATH_KEY, destinationPath);
}

function applySavedSelectedTabTransform() {
	const activeTab = document.querySelector(".site-nav a.active");
	if (!activeTab) {
		return;
	}

	const activePath = getTabPathFromLink(activeTab);
	const savedTransform = readStorageItem(sessionStorage, `${TAB_TRANSFORM_STORAGE_PREFIX}${activePath}`);
	if (savedTransform && savedTransform !== "none") {
		try {
			const matrix = new DOMMatrixReadOnly(savedTransform);
			const rotationDegrees = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
			const safeTranslateX = Number.isFinite(matrix.e) && Math.abs(matrix.e) < 200 ? matrix.e : 0;
			const safeTranslateY = Number.isFinite(matrix.f) && Math.abs(matrix.f) < 200 ? matrix.f : 0;

			activeTab.style.setProperty("--active-tab-translate-x", `${safeTranslateX}px`);
			activeTab.style.setProperty("--active-tab-translate-y", `${safeTranslateY}px`);
			activeTab.style.setProperty("--active-tab-rotation-clicked", `${rotationDegrees}deg`);
		} catch {
		}
	}

	const savedHue = readStorageItem(sessionStorage, NEXT_TAB_HUE_KEY);
	const savedPath = readStorageItem(sessionStorage, NEXT_TAB_PATH_KEY);
	if (!savedHue || savedPath !== activePath) {
		return;
	}

	const savedRotation = readStorageItem(sessionStorage, NEXT_TAB_ROTATION_KEY);
	const savedRotationPath = readStorageItem(sessionStorage, NEXT_TAB_ROTATION_PATH_KEY);
	if (savedRotation && savedRotationPath === activePath) {
		activeTab.style.setProperty("--active-tab-rotation-clicked", savedRotation);
		removeStorageItem(sessionStorage, NEXT_TAB_ROTATION_KEY);
		removeStorageItem(sessionStorage, NEXT_TAB_ROTATION_PATH_KEY);
	}

	activeTab.style.setProperty("--active-tab-hue", savedHue);
	removeStorageItem(sessionStorage, NEXT_TAB_HUE_KEY);
	removeStorageItem(sessionStorage, NEXT_TAB_PATH_KEY);
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
			if (tabLink.classList.contains("secret-tab")) {
				return;
			}

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

	const isEditableTarget = (target) => {
		if (!(target instanceof HTMLElement)) {
			return false;
		}

		if (target.isContentEditable) {
			return true;
		}

		const editableTags = ["INPUT", "TEXTAREA", "SELECT"];
		return editableTags.includes(target.tagName);
	};

	initializeResponsiveMenu(siteNav);
	applySavedSelectedTabTransform();
	siteNav.addEventListener("click", saveSelectedTabTransform);

	const tabs = Array.from(siteNav.querySelectorAll("a"));
	const secretTab = tabs.find((tab) => tab.classList.contains("secret-tab")) ?? null;
	let pressedKeyboardDigit = null;
	let pressedKeyboardTab = null;

	const applyRandomTabPhaseSeed = (tab) => {
		const randomPhaseX = Math.random() * 360;
		const randomPhaseY = Math.random() * 360;
		const randomTiltDelaySeconds = -Math.random() * 1.8;
		tab.style.setProperty("--tab-phase-start-x", `${randomPhaseX}deg`);
		tab.style.setProperty("--tab-phase-start-y", `${randomPhaseY}deg`);
		tab.style.setProperty("--tab-phase-x", `${randomPhaseX}deg`);
		tab.style.setProperty("--tab-phase-y", `${randomPhaseY}deg`);
		tab.style.setProperty("--tab-tilt-delay", `${randomTiltDelaySeconds}s`);
	};

	const applyKeyboardPressTilt = (tab) => {
		const pressTilt = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
		const pressTranslateX = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_X_MAX;
		const pressTranslateY = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_Y_MAX;
		tab.style.setProperty("--tab-press-tilt", `${pressTilt}deg`);
		tab.style.setProperty("--tab-press-translate-x", `${pressTranslateX}px`);
		tab.style.setProperty("--tab-press-translate-y", `${pressTranslateY}px`);
		applyRandomTabPhaseSeed(tab);
		tab.classList.add("keyboard-pressed");
	};

	const clearKeyboardPressedTab = () => {
		if (pressedKeyboardTab instanceof HTMLAnchorElement) {
			pressedKeyboardTab.classList.remove("keyboard-pressed");
			pressedKeyboardTab.classList.remove("secret-key-hover");
		}

		pressedKeyboardDigit = null;
		pressedKeyboardTab = null;
	};

	tabs.forEach((tab) => {
		let pressStartedFromTouch = false;
		const isSecretTab = tab.classList.contains("secret-tab");

		const applyRandomSecretHoverTilt = () => {
			const pressTilt = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
			const pressTranslateX = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_X_MAX;
			const pressTranslateY = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_Y_MAX;
			tab.style.setProperty("--tab-press-tilt", `${pressTilt}deg`);
			tab.style.setProperty("--tab-press-translate-x", `${pressTranslateX}px`);
			tab.style.setProperty("--tab-press-translate-y", `${pressTranslateY}px`);
		};

		const randomizeStartPhase = () => {
			if (isSecretTab) {
				applyRandomSecretHoverTilt();
				return;
			}

			applyRandomTabPhaseSeed(tab);
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

				if (isSecretTab) {
					pressStartedFromTouch = false;
					applyRandomSecretHoverTilt();
					tab.classList.add("secret-touch-pressed");
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

				if (isSecretTab) {
					setTimeout(clearPressTilt, TAP_NAV_DELAY_MS);
					return;
				}

			setTimeout(clearPressTilt, TAP_NAV_DELAY_MS);
		};

		const handleTouchStart = () => {
				if (isSecretTab) {
					pressStartedFromTouch = false;
					applyRandomSecretHoverTilt();
					tab.classList.add("secret-touch-pressed");
					return;
				}

			pressStartedFromTouch = true;
			applyRandomPressTilt();
		};

		const handleTouchEnd = () => {
			setTimeout(clearPressTilt, TAP_NAV_DELAY_MS);
		};

		const clearPressTilt = () => {
			pressStartedFromTouch = false;
			tab.classList.remove("mobile-pressed");
				tab.classList.remove("secret-touch-pressed");
		};

		const handleTabClick = (event) => {
			if (isSecretTab) {
				event.preventDefault();
				clearPressTilt();
				return;
			}

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

	document.addEventListener("keydown", (event) => {
		if (event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
			return;
		}

		if (event.repeat) {
			return;
		}

		const digit = Number.parseInt(event.key, 10);
		if (!Number.isInteger(digit)) {
			return;
		}

		if (digit === 7) {
			if (!(secretTab instanceof HTMLAnchorElement)) {
				return;
			}

			event.preventDefault();
			if (pressedKeyboardDigit !== null && pressedKeyboardDigit !== 7) {
				clearKeyboardPressedTab();
			}

			pressedKeyboardDigit = 7;
			pressedKeyboardTab = secretTab;

			const pressTilt = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
			const pressTranslateX = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_X_MAX;
			const pressTranslateY = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_Y_MAX;
			secretTab.style.setProperty("--tab-press-tilt", `${pressTilt}deg`);
			secretTab.style.setProperty("--tab-press-translate-x", `${pressTranslateX}px`);
			secretTab.style.setProperty("--tab-press-translate-y", `${pressTranslateY}px`);
			secretTab.classList.remove("secret-release-fade");
			secretTab.classList.add("secret-key-hover");
			return;
		}

		if (digit < 1 || digit > 6) {
			return;
		}

		const tab = tabs[digit - 1];
		if (!(tab instanceof HTMLAnchorElement)) {
			return;
		}

		event.preventDefault();
		if (pressedKeyboardDigit !== null && pressedKeyboardDigit !== digit) {
			clearKeyboardPressedTab();
		}

		pressedKeyboardDigit = digit;
		pressedKeyboardTab = tab;
		applyKeyboardPressTilt(tab);
	});

	document.addEventListener("keyup", (event) => {
		const digit = Number.parseInt(event.key, 10);
		if (!Number.isInteger(digit) || pressedKeyboardDigit !== digit) {
			return;
		}

		if (digit === 7) {
			const tabToFlash = pressedKeyboardTab;
			pressedKeyboardDigit = null;
			pressedKeyboardTab = null;

			if (!(tabToFlash instanceof HTMLAnchorElement)) {
				return;
			}

			event.preventDefault();
			tabToFlash.classList.remove("secret-key-hover");
			tabToFlash.classList.remove("secret-release-fade");
			void tabToFlash.offsetWidth;
			tabToFlash.classList.add("secret-release-fade");
			setTimeout(() => {
				tabToFlash.classList.remove("secret-release-fade");
			}, 1000);
			return;
		}

		if (digit < 1 || digit > 6) {
			return;
		}

		const tabToSelect = pressedKeyboardTab;
		pressedKeyboardDigit = null;
		pressedKeyboardTab = null;

		if (!(tabToSelect instanceof HTMLAnchorElement)) {
			return;
		}

		event.preventDefault();
		const randomRotation = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
		const destinationPath = getTabPathFromLink(tabToSelect);
		writeStorageItem(sessionStorage, NEXT_TAB_ROTATION_KEY, `${randomRotation}deg`);
		writeStorageItem(sessionStorage, NEXT_TAB_ROTATION_PATH_KEY, destinationPath);
		tabToSelect.click();
		setTimeout(() => {
			tabToSelect.classList.remove("keyboard-pressed");
		}, TAP_NAV_DELAY_MS);
	});

	window.addEventListener("blur", clearKeyboardPressedTab);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			clearKeyboardPressedTab();
		}
	});
}

function initializeBottomCircleDecoration() {
	if (!document.body) {
		return null;
	}

	const existingCircle = document.querySelector(".bottom-circle-parent");
	if (existingCircle instanceof HTMLElement) {
		return existingCircle;
	}

	const parentCircle = document.createElement("div");
	parentCircle.className = "bottom-circle-parent";
	parentCircle.setAttribute("aria-hidden", "true");

	const childCircle = document.createElement("div");
	childCircle.className = "bottom-circle-child";
	parentCircle.append(childCircle);

	document.body.append(parentCircle);
	return parentCircle;
}

function initializeBottomSquareRunner() {
	if (!document.body) {
		return null;
	}

	const existingSquare = document.querySelector(".bottom-square-runner");
	if (existingSquare instanceof HTMLElement) {
		return existingSquare;
	}

	const runnerSquare = document.createElement("div");
	runnerSquare.className = "bottom-square-runner";
	runnerSquare.setAttribute("aria-hidden", "true");
	document.body.append(runnerSquare);
	return runnerSquare;
}

function initializeBottomSquareRunnerMovement(runnerSquare) {
	if (!(runnerSquare instanceof HTMLElement)) {
		return;
	}

	let currentPositionX = 0;
	let directionX = -1;
	let animationFrameId = 0;
	let lastTimestampMs = 0;

	const readSavedSquareState = () => {
		const rawState = readStorageItem(sessionStorage, BOTTOM_SQUARE_RUNNER_STATE_KEY);
		if (!rawState) {
			return null;
		}

		try {
			const parsedState = JSON.parse(rawState);
			if (!parsedState || typeof parsedState !== "object") {
				return null;
			}

			const savedPositionX = Number(parsedState.positionX);
			if (!Number.isFinite(savedPositionX)) {
				return null;
			}

			const parsedDirectionX = Number(parsedState.directionX);
			const savedDirectionX = parsedDirectionX === 1 || parsedDirectionX === -1 ? parsedDirectionX : -1;

			return {
				positionX: savedPositionX,
				directionX: savedDirectionX,
			};
		} catch {
			return null;
		}
	};

	const saveSquareState = () => {
		writeStorageItem(
			sessionStorage,
			BOTTOM_SQUARE_RUNNER_STATE_KEY,
			JSON.stringify({
				positionX: currentPositionX,
				directionX,
			}),
		);
	};

	const getSquareWidth = () => runnerSquare.getBoundingClientRect().width || 10;

	const getMaxPositionX = () => Math.max(0, window.innerWidth - getSquareWidth());

	const applySquarePosition = () => {
		runnerSquare.style.transform = `translateX(${currentPositionX}px)`;
	};

	const clampPositionWithinBounds = () => {
		const maxPositionX = getMaxPositionX();
		currentPositionX = Math.min(maxPositionX, Math.max(0, currentPositionX));
		applySquarePosition();
		saveSquareState();
	};

	const initializeStartPosition = () => {
		const savedState = readSavedSquareState();
		if (savedState) {
			currentPositionX = savedState.positionX;
			directionX = savedState.directionX;
			clampPositionWithinBounds();
			return;
		}

		currentPositionX = getMaxPositionX() / 2;
		applySquarePosition();
		saveSquareState();
	};

	const step = (timestampMs) => {
		if (lastTimestampMs === 0) {
			lastTimestampMs = timestampMs;
		}

		const elapsedSeconds = Math.min(50, timestampMs - lastTimestampMs) / 1000;
		lastTimestampMs = timestampMs;

		currentPositionX += directionX * BOTTOM_SQUARE_RUNNER_SPEED_PX_PER_SECOND * elapsedSeconds;

		const maxPositionX = getMaxPositionX();
		if (currentPositionX <= 0) {
			currentPositionX = 0;
			directionX = 1;
		} else if (currentPositionX >= maxPositionX) {
			currentPositionX = maxPositionX;
			directionX = -1;
		}

		applySquarePosition();
		saveSquareState();
		animationFrameId = window.requestAnimationFrame(step);
	};

	const ensureAnimationLoop = () => {
		if (animationFrameId !== 0) {
			return;
		}

		animationFrameId = window.requestAnimationFrame(step);
	};

	window.addEventListener("resize", clampPositionWithinBounds);
	window.addEventListener("pagehide", saveSquareState);
	initializeStartPosition();
	ensureAnimationLoop();
}

function initializeBottomCircleMovement(parentCircle, runnerSquare) {
	if (!(parentCircle instanceof HTMLElement)) {
		return;
	}

	let offsetX = 0;
	let offsetY = 0;
	let velocityX = 0;
	let velocityY = 0;
	let childOffsetX = 0;
	let childOffsetY = 0;
	let childPhaseX = "0deg";
	let childPhaseY = "0deg";
	let animationFrameId = 0;
	let lastTimestampMs = 0;
	let lastDirectionalInputTimestampMs = performance.now();
	let hasReceivedDirectionalInput = false;
	const activeKeys = new Set();
	const childCircle = parentCircle.querySelector(".bottom-circle-child");

	const readSavedCircleState = () => {
		const rawState = readStorageItem(sessionStorage, BOTTOM_CIRCLE_STATE_KEY);
		if (!rawState) {
			return null;
		}

		try {
			const parsedState = JSON.parse(rawState);
			if (!parsedState || typeof parsedState !== "object") {
				return null;
			}

			const savedOffsetX = Number(parsedState.offsetX);
			const savedOffsetY = Number(parsedState.offsetY);
			const savedVelocityX = Number(parsedState.velocityX);
			const savedVelocityY = Number(parsedState.velocityY);
			const savedChildOffsetX = Number(parsedState.childOffsetX);
			const savedChildOffsetY = Number(parsedState.childOffsetY);
			const savedChildPhaseX =
				typeof parsedState.childPhaseX === "string" && parsedState.childPhaseX.trim().length > 0
					? parsedState.childPhaseX
					: "0deg";
			const savedChildPhaseY =
				typeof parsedState.childPhaseY === "string" && parsedState.childPhaseY.trim().length > 0
					? parsedState.childPhaseY
					: "0deg";

			if (
				!Number.isFinite(savedOffsetX) ||
				!Number.isFinite(savedOffsetY) ||
				!Number.isFinite(savedVelocityX) ||
				!Number.isFinite(savedVelocityY) ||
				!Number.isFinite(savedChildOffsetX) ||
				!Number.isFinite(savedChildOffsetY)
			) {
				return null;
			}

			return {
				offsetX: savedOffsetX,
				offsetY: savedOffsetY,
				velocityX: savedVelocityX,
				velocityY: savedVelocityY,
				childOffsetX: savedChildOffsetX,
				childOffsetY: savedChildOffsetY,
				childPhaseX: savedChildPhaseX,
				childPhaseY: savedChildPhaseY,
			};
		} catch {
			return null;
		}
	};

	const captureChildCircleState = () => {
		if (!(childCircle instanceof HTMLElement)) {
			return;
		}

		const parentRect = parentCircle.getBoundingClientRect();
		const childRect = childCircle.getBoundingClientRect();
		const parentCenterX = parentRect.left + parentRect.width / 2;
		const parentCenterY = parentRect.top + parentRect.height / 2;
		const childCenterX = childRect.left + childRect.width / 2;
		const childCenterY = childRect.top + childRect.height / 2;

		childOffsetX = childCenterX - parentCenterX;
		childOffsetY = childCenterY - parentCenterY;

		const computedStyle = getComputedStyle(childCircle);
		const nextChildPhaseX = computedStyle.getPropertyValue("--child-phase-x").trim();
		const nextChildPhaseY = computedStyle.getPropertyValue("--child-phase-y").trim();
		if (nextChildPhaseX) {
			childPhaseX = nextChildPhaseX;
		}
		if (nextChildPhaseY) {
			childPhaseY = nextChildPhaseY;
		}
	};

	const applySavedChildPhase = () => {
		if (!(childCircle instanceof HTMLElement)) {
			return;
		}

		childCircle.style.setProperty("--child-phase-start-x", childPhaseX);
		childCircle.style.setProperty("--child-phase-start-y", childPhaseY);
	};

	const saveCircleState = () => {
		captureChildCircleState();
		writeStorageItem(
			sessionStorage,
			BOTTOM_CIRCLE_STATE_KEY,
			JSON.stringify({
				offsetX,
				offsetY,
				velocityX,
				velocityY,
				childOffsetX,
				childOffsetY,
				childPhaseX,
				childPhaseY,
			}),
		);
	};

	const isEditableTarget = (target) => {
		if (!(target instanceof HTMLElement)) {
			return false;
		}

		if (target.isContentEditable) {
			return true;
		}

		const editableTags = ["INPUT", "TEXTAREA", "SELECT"];
		return editableTags.includes(target.tagName);
	};

	const applyPosition = () => {
		parentCircle.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
	};

	const clampPositionWithinViewport = () => {
		const rect = parentCircle.getBoundingClientRect();
		let adjustX = 0;
		let adjustY = 0;

		if (rect.right < 0) {
			adjustX = -rect.right + 1;
		} else if (rect.left > window.innerWidth) {
			adjustX = window.innerWidth - rect.left - 1;
		}

		if (rect.bottom < 0) {
			adjustY = -rect.bottom + 1;
		} else if (rect.top > window.innerHeight) {
			adjustY = window.innerHeight - rect.top - 1;
		}

		if (adjustX === 0 && adjustY === 0) {
			return;
		}

		offsetX += adjustX;
		offsetY += adjustY;
		applyPosition();
	};

	const moveToward = (currentValue, targetValue, maxDelta) => {
		const delta = targetValue - currentValue;
		if (Math.abs(delta) <= maxDelta) {
			return targetValue;
		}

		return currentValue + Math.sign(delta) * maxDelta;
	};

	const alignParentWithSquareStart = () => {
		if (!(runnerSquare instanceof HTMLElement)) {
			return;
		}

		const parentRect = parentCircle.getBoundingClientRect();
		const squareRect = runnerSquare.getBoundingClientRect();
		const parentCenterX = parentRect.left + parentRect.width / 2;
		const parentCenterY = parentRect.top + parentRect.height / 2;
		const squareCenterX = squareRect.left + squareRect.width / 2;
		const squareCenterY = squareRect.top + squareRect.height / 2;

		offsetX += squareCenterX - parentCenterX;
		offsetY += squareCenterY - parentCenterY;
		applyPosition();
	};

	const getDirection = () => {
		const moveLeft = activeKeys.has("a");
		const moveRight = activeKeys.has("d");
		const moveUp = activeKeys.has("w");
		const moveDown = activeKeys.has("s");

		let directionX = 0;
		let directionY = 0;

		if (moveLeft && !moveRight) {
			directionX = -1;
		} else if (moveRight && !moveLeft) {
			directionX = 1;
		}

		if (moveUp && !moveDown) {
			directionY = -1;
		} else if (moveDown && !moveUp) {
			directionY = 1;
		}

		return { directionX, directionY };
	};

	const step = (timestampMs) => {
		if (lastTimestampMs === 0) {
			lastTimestampMs = timestampMs;
		}

		const elapsedSeconds = Math.min(50, timestampMs - lastTimestampMs) / 1000;
		lastTimestampMs = timestampMs;

		const { directionX, directionY } = getDirection();
		const hasDirectionalInput = directionX !== 0 || directionY !== 0;
		if (hasDirectionalInput) {
			hasReceivedDirectionalInput = true;
			lastDirectionalInputTimestampMs = timestampMs;
		}

		const isSeekDelayElapsed = timestampMs - lastDirectionalInputTimestampMs >= BOTTOM_CIRCLE_SEEK_IDLE_DELAY_MS;
		const shouldSeekSquare =
			!hasDirectionalInput && (!hasReceivedDirectionalInput || isSeekDelayElapsed);
		let targetVelocityX = 0;
		let targetVelocityY = 0;

		if (hasDirectionalInput) {
			const directionMagnitude = Math.hypot(directionX, directionY) || 1;
			const normalizedDirectionX = directionX / directionMagnitude;
			const normalizedDirectionY = directionY / directionMagnitude;

			targetVelocityX = normalizedDirectionX * BOTTOM_CIRCLE_MOVE_SPEED_PX_PER_SECOND;
			targetVelocityY = normalizedDirectionY * BOTTOM_CIRCLE_MOVE_SPEED_PX_PER_SECOND;
		} else if (shouldSeekSquare && runnerSquare instanceof HTMLElement) {
			const parentRect = parentCircle.getBoundingClientRect();
			const squareRect = runnerSquare.getBoundingClientRect();
			const parentCenterX = parentRect.left + parentRect.width / 2;
			const parentCenterY = parentRect.top + parentRect.height / 2;
			const squareCenterX = squareRect.left + squareRect.width / 2;
			const squareCenterY = squareRect.top + squareRect.height / 2;

			const deltaX = squareCenterX - parentCenterX;
			const deltaY = squareCenterY - parentCenterY;
			const distance = Math.hypot(deltaX, deltaY);

			if (distance > 0.5) {
				const seekDirectionX = deltaX / distance;
				const seekDirectionY = deltaY / distance;
				const seekSpeed = Math.min(BOTTOM_CIRCLE_SEEK_MAX_SPEED_PX_PER_SECOND, distance * 1.6);
				targetVelocityX = seekDirectionX * seekSpeed;
				targetVelocityY = seekDirectionY * seekSpeed;
			}
		}

		const accelerationPerFrame = BOTTOM_CIRCLE_ACCELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;
		const decelerationPerFrame = BOTTOM_CIRCLE_DECELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;
		const seekAccelerationPerFrame = BOTTOM_CIRCLE_SEEK_ACCELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;

		let velocityStepX = decelerationPerFrame;
		let velocityStepY = decelerationPerFrame;

		if (hasDirectionalInput) {
			velocityStepX = accelerationPerFrame;
			velocityStepY = accelerationPerFrame;
		} else if (shouldSeekSquare && runnerSquare instanceof HTMLElement) {
			velocityStepX = seekAccelerationPerFrame;
			velocityStepY = seekAccelerationPerFrame;
		}

		velocityX = moveToward(velocityX, targetVelocityX, velocityStepX);
		velocityY = moveToward(velocityY, targetVelocityY, velocityStepY);

		offsetX += velocityX * elapsedSeconds;
		offsetY += velocityY * elapsedSeconds;
		applyPosition();
		clampPositionWithinViewport();
		saveCircleState();

		animationFrameId = window.requestAnimationFrame(step);
	};

	const ensureAnimationLoop = () => {
		if (animationFrameId !== 0) {
			return;
		}

		animationFrameId = window.requestAnimationFrame(step);
	};

	const handleKeyDown = (event) => {
		if (event.ctrlKey || event.altKey || event.metaKey || isEditableTarget(event.target)) {
			return;
		}

		const key = event.key.toLowerCase();
		if (key !== "w" && key !== "a" && key !== "s" && key !== "d") {
			return;
		}

		event.preventDefault();
		activeKeys.add(key);
		ensureAnimationLoop();
	};

	const handleKeyUp = (event) => {
		const key = event.key.toLowerCase();
		if (key !== "w" && key !== "a" && key !== "s" && key !== "d") {
			return;
		}

		activeKeys.delete(key);
	};

	const handleWindowBlur = () => {
		activeKeys.clear();
	};

	const savedState = readSavedCircleState();
	const hasRestoredCircleState = Boolean(savedState);
	if (savedState) {
		offsetX = savedState.offsetX;
		offsetY = savedState.offsetY;
		velocityX = savedState.velocityX;
		velocityY = savedState.velocityY;
		childOffsetX = savedState.childOffsetX;
		childOffsetY = savedState.childOffsetY;
		childPhaseX = savedState.childPhaseX;
		childPhaseY = savedState.childPhaseY;
		applySavedChildPhase();
		applyPosition();
		clampPositionWithinViewport();
	}

	document.addEventListener("keydown", handleKeyDown);
	document.addEventListener("keyup", handleKeyUp);
	window.addEventListener("blur", handleWindowBlur);
	window.addEventListener("resize", () => {
		applyPosition();
		clampPositionWithinViewport();
		saveCircleState();
	});
	window.addEventListener("pagehide", saveCircleState);
	if (!hasRestoredCircleState) {
		alignParentWithSquareStart();
		saveCircleState();
	}
	ensureAnimationLoop();
}

function initializeSiteUi() {
	const parentCircle = initializeBottomCircleDecoration();
	const runnerSquare = initializeBottomSquareRunner();

	try {
		initializeBottomSquareRunnerMovement(runnerSquare);
	} catch {
	}

	try {
		initializeBottomCircleMovement(parentCircle, runnerSquare);
	} catch {
	}

	try {
		initializeTabSelectionPersistence();
	} catch {
	}
}

try {
	initializeZoomPersistence();
} catch {
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeSiteUi);
} else {
	initializeSiteUi();
}

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
const TAB_PROXIMITY_SELECT_DISTANCE_PX = 60;
const TAB_PROXIMITY_BUBBLE_RESET_DISTANCE_PX = 90;
const TAB_PROXIMITY_BUBBLE_RESET_DELAY_MS = 300;
const TAP_NAV_DELAY_MS = 140;
const MOBILE_MENU_BREAKPOINT = 1000;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const PLAYER_MOVE_SPEED_PX_PER_SECOND = 400;
const PLAYER_ACCELERATION_PX_PER_SECOND_SQUARED = 800;
const PLAYER_DECELERATION_PX_PER_SECOND_SQUARED = 300;
const PLAYER_SEEK_MAX_SPEED_PX_PER_SECOND = 140;
const PLAYER_SEEK_ACCELERATION_PX_PER_SECOND_SQUARED = 220;
const PLAYER_SEEK_IDLE_DELAY_MS = 2000;
const PLAYER_BULLET_SIZE_PX = 6;
const PLAYER_BULLET_OFFSET_FROM_VISUALS_PX = 2;
const PLAYER_BULLET_SPEED_PX_PER_SECOND = 2000;
const PLAYER_BULLET_RECOIL_SPEED_DELTA_PX_PER_SECOND = 120;
const PLAYER_INTERACT_BUBBLE_RADIUS_FROM_PLAYER_PX = 50;
const PLAYER_IDLE_HINT_INITIAL_DELAY_MS = 30000;
const PLAYER_IDLE_HINT_DURATION_MS = 1000;
const PLAYER_IDLE_HINT_REPEAT_MIN_DELAY_MS = 10000;
const PLAYER_IDLE_HINT_REPEAT_MAX_DELAY_MS = 20000;
const PLAYER_IDLE_HINT_INPUT_OPTIONS = ["w", "a", "s", "d"];
const PLAYER_IDLE_HINT_STATE_KEY = "playerIdleHintState";
const PLAYER_BUBBLE_SUPPRESSION_KEY = "playerBubbleSuppressedUntilLeave";
const PLAYER_INPUT_CARRY_STATE_KEY = "playerInputCarryState";
const PLAYER_INPUT_CARRY_MAX_AGE_MS = 2000;
const BOTTOM_SQUARE_RUNNER_SPEED_PX_PER_SECOND = 100;
const BOTTOM_SQUARE_RUNNER_STATE_KEY = "bottomSquareRunnerState";
const PLAYER_STATE_KEY = "bottomCircleState";

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

function persistTabSelectionVisualState(tab) {
	if (!(tab instanceof HTMLAnchorElement)) {
		return;
	}

	const pseudoStyle = getComputedStyle(tab, "::before");
	const currentTransform = pseudoStyle.transform;
	const transformValue = currentTransform && currentTransform !== "none" ? currentTransform : "matrix(1, 0, 0, 1, 0, 0)";

	const destinationPath = getTabPathFromLink(tab);
	writeStorageItem(sessionStorage, `${TAB_TRANSFORM_STORAGE_PREFIX}${destinationPath}`, transformValue);

	if (tab.classList.contains("active")) {
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

function saveSelectedTabTransform(event) {
	const clickedTab = event.target.closest(".site-nav a");
	if (!clickedTab) {
		return;
	}

	if (clickedTab.classList.contains("secret-tab")) {
		return;
	}

	persistTabSelectionVisualState(clickedTab);
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
	window.isPlayerNearTab = false;
	window.isPlayerBubbleSuppressed = readStorageItem(sessionStorage, PLAYER_BUBBLE_SUPPRESSION_KEY) === "1";

	const tabs = Array.from(siteNav.querySelectorAll("a"));
	const secretTab = tabs.find((tab) => tab.classList.contains("secret-tab")) ?? null;
	let pressedKeyboardDigit = null;
	let pressedKeyboardTab = null;
	let proximitySelectedTab = null;
	let bubbleSuppressionNeedsLeave = window.isPlayerBubbleSuppressed === true;
	let activeReplayToggle = false;

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

	const applyActiveTabKeyPressVisual = (tab) => {
		const pressTilt = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
		const pressTranslateX = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_X_MAX;
		const pressTranslateY = (Math.random() * 2 - 1) * TAB_PRESS_TRANSLATE_Y_MAX;
		const randomHue = Math.floor(Math.random() * 360);
		tab.style.setProperty("--active-tab-rotation-clicked", `${pressTilt}deg`);
		tab.style.setProperty("--active-tab-translate-x", `${pressTranslateX}px`);
		tab.style.setProperty("--active-tab-translate-y", `${pressTranslateY}px`);
		tab.style.setProperty("--active-tab-hue", String(randomHue));
		tab.classList.remove("active-key-replay-a", "active-key-replay-b");
		void tab.offsetWidth;
		const replayClassName = activeReplayToggle ? "active-key-replay-a" : "active-key-replay-b";
		tab.classList.add(replayClassName);
		activeReplayToggle = !activeReplayToggle;
		setTimeout(() => {
			tab.classList.remove("active-key-replay-a", "active-key-replay-b");
		}, 220);
	};

	const clearKeyboardPressedTab = () => {
		if (pressedKeyboardTab instanceof HTMLAnchorElement) {
			pressedKeyboardTab.classList.remove("keyboard-pressed");
			pressedKeyboardTab.classList.remove("secret-key-hover");
		}

		pressedKeyboardDigit = null;
		pressedKeyboardTab = null;
	};

	const jumpToTab = (tabToSelect, options = {}) => {
		if (!(tabToSelect instanceof HTMLAnchorElement)) {
			return;
		}

		const destinationUrl = new URL(tabToSelect.href, window.location.href);
		if (destinationUrl.href === window.location.href) {
			return;
		}

		const allowSecretTab = options.allowSecretTab === true;
		if (tabToSelect.classList.contains("secret-tab")) {
			if (!allowSecretTab) {
				return;
			}

			persistTabSelectionVisualState(tabToSelect);
			window.location.href = destinationUrl.href;
			return;
		}

		const randomRotation = Math.random() * (TAB_ROTATION_MAX - TAB_ROTATION_MIN) + TAB_ROTATION_MIN;
		const destinationPath = getTabPathFromLink(tabToSelect);
		writeStorageItem(sessionStorage, NEXT_TAB_ROTATION_KEY, `${randomRotation}deg`);
		writeStorageItem(sessionStorage, NEXT_TAB_ROTATION_PATH_KEY, destinationPath);
		tabToSelect.click();
		setTimeout(() => {
			tabToSelect.classList.remove("keyboard-pressed");
		}, TAP_NAV_DELAY_MS);
	};

	const clearProximitySelectedTab = (options = {}) => {
		if (proximitySelectedTab instanceof HTMLAnchorElement) {
			proximitySelectedTab.classList.remove("proximity-hover");
		}

		proximitySelectedTab = null;
		window.isPlayerNearTab = false;
	};

	const updateProximitySelectedTab = (centerX, centerY) => {
		if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) {
			clearProximitySelectedTab();
			return;
		}

		let nextTab = null;
		let nearestDistance = Number.POSITIVE_INFINITY;

		tabs.forEach((tab) => {
			if (!(tab instanceof HTMLAnchorElement)) {
				return;
			}

			const bounds = tab.getBoundingClientRect();
			if (bounds.width <= 0 || bounds.height <= 0) {
				return;
			}

			const tabCenterX = bounds.left + bounds.width / 2;
			const tabCenterY = bounds.top + bounds.height / 2;
			const distance = Math.hypot(centerX - tabCenterX, centerY - tabCenterY);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nextTab = tab;
			}
		});

		if (nearestDistance > TAB_PROXIMITY_SELECT_DISTANCE_PX || !(nextTab instanceof HTMLAnchorElement)) {
			clearProximitySelectedTab();
			if (window.isPlayerBubbleSuppressed === true && bubbleSuppressionNeedsLeave) {
				bubbleSuppressionNeedsLeave = false;
				window.isPlayerBubbleSuppressed = false;
				removeStorageItem(sessionStorage, PLAYER_BUBBLE_SUPPRESSION_KEY);
			}
			return;
		}

		if (proximitySelectedTab === nextTab) {
			window.isPlayerNearTab = true;
			return;
		}

		clearProximitySelectedTab();
		proximitySelectedTab = nextTab;

		applyRandomTabPhaseSeed(nextTab);

		nextTab.classList.add("proximity-hover");
		window.isPlayerNearTab = true;
	};

	window.updateTabProximityFromPlayerVisuals = updateProximitySelectedTab;

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

		if (event.key.toLowerCase() === "e") {
			if (!(proximitySelectedTab instanceof HTMLAnchorElement)) {
				return;
			}

			event.preventDefault();
			window.isPlayerBubbleSuppressed = true;
			bubbleSuppressionNeedsLeave = true;
			writeStorageItem(sessionStorage, PLAYER_BUBBLE_SUPPRESSION_KEY, "1");
			window.isPlayerNearTab = false;
			const bubbleElement = document.querySelector(".player-tab-interact-bubble");
			if (bubbleElement instanceof HTMLElement) {
				bubbleElement.classList.remove("visible");
			}
			jumpToTab(proximitySelectedTab, { allowSecretTab: true });
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

		if (tab.classList.contains("active")) {
			applyActiveTabKeyPressVisual(tab);
			return;
		}

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
		jumpToTab(tabToSelect);
	});

	window.addEventListener("blur", clearKeyboardPressedTab);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) {
			clearKeyboardPressedTab();
			clearProximitySelectedTab();
		}
	});
}

function initializePlayerDecoration() {
	if (!document.body) {
		return null;
	}

	const existingPlayer = document.querySelector(".player");
	if (existingPlayer instanceof HTMLElement) {
		return existingPlayer;
	}

	const player = document.createElement("div");
	player.className = "player";
	player.setAttribute("aria-hidden", "true");

	const playerVisuals = document.createElement("div");
	playerVisuals.className = "player-visuals";
	player.append(playerVisuals);

	document.body.append(player);
	return player;
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

function initializePlayerMovement(player, runnerSquare) {
	if (!(player instanceof HTMLElement)) {
		return;
	}

	let offsetX = 0;
	let offsetY = 0;
	let velocityX = 0;
	let velocityY = 0;
	let playerVisualsOffsetX = 0;
	let playerVisualsOffsetY = 0;
	let playerVisualsPhaseX = "0deg";
	let playerVisualsPhaseY = "0deg";
	let animationFrameId = 0;
	let lastTimestampMs = 0;
	let lastDirectionalInputTimestampMs = performance.now();
	let hasReceivedDirectionalInput = false;
	const activeKeys = new Set();
	const restoredCarryKeys = new Set();
	let restoredCarryExpiresAtMs = 0;
	const playerVisuals = player.querySelector(".player-visuals");
	const activeBullets = [];
	let playerInteractBubbleAngleRad = 0;
	let hasPlayerInteractBubbleAnchor = false;
	let idleHintBubbleAngleRad = 0;
	let hasIdleHintBubbleAnchor = false;
	let idleHintVisibleUntilEpochMs = 0;
	let nextIdleHintAtEpochMs = Date.now() + PLAYER_IDLE_HINT_INITIAL_DELAY_MS;
	let hasPlayerMovementStarted = false;
	const playerInteractBubble = (() => {
		const existingBubble = document.querySelector(".player-tab-interact-bubble");
		if (existingBubble instanceof HTMLElement) {
			return existingBubble;
		}

		if (!document.body) {
			return null;
		}

		const bubble = document.createElement("div");
		bubble.className = "player-interact-bubble player-tab-interact-bubble";
		bubble.textContent = "e";
		document.body.append(bubble);
		return bubble;
	})();
	const playerIdleHintBubble = (() => {
		const existingBubble = document.querySelector(".player-idle-hint-bubble");
		if (existingBubble instanceof HTMLElement) {
			return existingBubble;
		}

		if (!document.body) {
			return null;
		}

		const bubble = document.createElement("div");
		bubble.className = "player-interact-bubble player-idle-hint-bubble";
		bubble.textContent = "w";
		document.body.append(bubble);
		return bubble;
	})();

	const saveInputCarryState = () => {
		if (activeKeys.size === 0) {
			removeStorageItem(sessionStorage, PLAYER_INPUT_CARRY_STATE_KEY);
			return;
		}

		writeStorageItem(
			sessionStorage,
			PLAYER_INPUT_CARRY_STATE_KEY,
			JSON.stringify({
				keys: Array.from(activeKeys),
				timestampMs: Date.now(),
			}),
		);
	};

	const restoreInputCarryState = () => {
		const rawState = readStorageItem(sessionStorage, PLAYER_INPUT_CARRY_STATE_KEY);
		if (!rawState) {
			return;
		}

		removeStorageItem(sessionStorage, PLAYER_INPUT_CARRY_STATE_KEY);

		try {
			const parsedState = JSON.parse(rawState);
			if (!parsedState || typeof parsedState !== "object") {
				return;
			}

			const carryTimestampMs = Number(parsedState.timestampMs);
			const keys = Array.isArray(parsedState.keys) ? parsedState.keys : [];
			if (!Number.isFinite(carryTimestampMs)) {
				return;
			}

			if (Date.now() - carryTimestampMs > PLAYER_INPUT_CARRY_MAX_AGE_MS) {
				return;
			}

			keys.forEach((key) => {
				if (key === "w" || key === "a" || key === "s" || key === "d") {
					activeKeys.add(key);
					restoredCarryKeys.add(key);
				}
			});

			if (restoredCarryKeys.size > 0) {
				restoredCarryExpiresAtMs = performance.now() + PLAYER_INPUT_CARRY_MAX_AGE_MS;
			}
		} catch {
		}
	};

	const saveIdleHintState = () => {
		writeStorageItem(
			sessionStorage,
			PLAYER_IDLE_HINT_STATE_KEY,
			JSON.stringify({
				nextIdleHintAtEpochMs,
				idleHintVisibleUntilEpochMs,
				hasPlayerMovementStarted,
			}),
		);
	};

	const restoreIdleHintState = () => {
		const rawState = readStorageItem(sessionStorage, PLAYER_IDLE_HINT_STATE_KEY);
		if (!rawState) {
			return;
		}

		try {
			const parsedState = JSON.parse(rawState);
			if (!parsedState || typeof parsedState !== "object") {
				return;
			}

			const savedNextIdleHintAtEpochMs = Number(parsedState.nextIdleHintAtEpochMs);
			const savedIdleHintVisibleUntilEpochMs = Number(parsedState.idleHintVisibleUntilEpochMs);
			if (Number.isFinite(savedNextIdleHintAtEpochMs)) {
				nextIdleHintAtEpochMs = savedNextIdleHintAtEpochMs;
			}
			if (Number.isFinite(savedIdleHintVisibleUntilEpochMs)) {
				idleHintVisibleUntilEpochMs = savedIdleHintVisibleUntilEpochMs;
			}

			hasPlayerMovementStarted = parsedState.hasPlayerMovementStarted === true;
		} catch {
		}
	};

	const hidePlayerInteractBubble = () => {
		if (!(playerInteractBubble instanceof HTMLElement)) {
			return;
		}

		playerInteractBubble.classList.remove("visible");
		hasPlayerInteractBubbleAnchor = false;
	};

	const hidePlayerIdleHintBubble = () => {
		if (!(playerIdleHintBubble instanceof HTMLElement)) {
			return;
		}

		playerIdleHintBubble.classList.remove("visible");
		hasIdleHintBubbleAnchor = false;
		idleHintVisibleUntilEpochMs = 0;
	};

	const scheduleNextIdleHint = (currentEpochMs) => {
		const delayRangeMs = PLAYER_IDLE_HINT_REPEAT_MAX_DELAY_MS - PLAYER_IDLE_HINT_REPEAT_MIN_DELAY_MS;
		const randomDelayMs = PLAYER_IDLE_HINT_REPEAT_MIN_DELAY_MS + Math.random() * delayRangeMs;
		nextIdleHintAtEpochMs = currentEpochMs + randomDelayMs;
	};

	const updatePlayerInteractBubble = (playerCenterX, playerCenterY, visualsCenterX, visualsCenterY) => {
		if (!(playerInteractBubble instanceof HTMLElement)) {
			return;
		}

		if (window.isPlayerNearTab !== true || window.isPlayerBubbleSuppressed === true) {
			hidePlayerInteractBubble();
			return;
		}

		if (!hasPlayerInteractBubbleAnchor) {
			playerInteractBubbleAngleRad = Math.random() * Math.PI * 2;
			hasPlayerInteractBubbleAnchor = true;
		}

		playerInteractBubble.classList.add("visible");
		const bubbleRect = playerInteractBubble.getBoundingClientRect();
		const bubbleCenterX = playerCenterX + Math.cos(playerInteractBubbleAngleRad) * PLAYER_INTERACT_BUBBLE_RADIUS_FROM_PLAYER_PX;
		const bubbleCenterY = playerCenterY + Math.sin(playerInteractBubbleAngleRad) * PLAYER_INTERACT_BUBBLE_RADIUS_FROM_PLAYER_PX;
		const bubbleX = bubbleCenterX - bubbleRect.width / 2;
		const bubbleY = bubbleCenterY - bubbleRect.height / 2;
		playerInteractBubble.style.transform = `translate(${bubbleX}px, ${bubbleY}px)`;

		const pointerAngleDeg =
			(Math.atan2(visualsCenterY - bubbleCenterY, visualsCenterX - bubbleCenterX) * 180) / Math.PI;
		playerInteractBubble.style.setProperty("--player-bubble-pointer-angle", `${pointerAngleDeg}deg`);
	};

	const updatePlayerIdleHintBubble = (playerCenterX, playerCenterY, visualsCenterX, visualsCenterY) => {
		if (!(playerIdleHintBubble instanceof HTMLElement)) {
			return;
		}

		const currentEpochMs = Date.now();

		if (hasPlayerMovementStarted) {
			hidePlayerIdleHintBubble();
			return;
		}

		const isBubbleVisible = playerIdleHintBubble.classList.contains("visible");
		if (isBubbleVisible && idleHintVisibleUntilEpochMs <= currentEpochMs) {
			hidePlayerIdleHintBubble();
			scheduleNextIdleHint(currentEpochMs);
			saveIdleHintState();
			return;
		}

		if (!isBubbleVisible && currentEpochMs >= nextIdleHintAtEpochMs) {
			const randomIndex = Math.floor(Math.random() * PLAYER_IDLE_HINT_INPUT_OPTIONS.length);
			playerIdleHintBubble.textContent = PLAYER_IDLE_HINT_INPUT_OPTIONS[randomIndex] ?? "w";
			idleHintVisibleUntilEpochMs = currentEpochMs + PLAYER_IDLE_HINT_DURATION_MS;
			hasIdleHintBubbleAnchor = false;
			saveIdleHintState();
		}

		if (idleHintVisibleUntilEpochMs <= currentEpochMs) {
			return;
		}

		if (!hasIdleHintBubbleAnchor) {
			idleHintBubbleAngleRad = Math.random() * Math.PI * 2;
			hasIdleHintBubbleAnchor = true;
		}

		playerIdleHintBubble.classList.add("visible");
		const bubbleRect = playerIdleHintBubble.getBoundingClientRect();
		const bubbleCenterX = playerCenterX + Math.cos(idleHintBubbleAngleRad) * PLAYER_INTERACT_BUBBLE_RADIUS_FROM_PLAYER_PX;
		const bubbleCenterY = playerCenterY + Math.sin(idleHintBubbleAngleRad) * PLAYER_INTERACT_BUBBLE_RADIUS_FROM_PLAYER_PX;
		const bubbleX = bubbleCenterX - bubbleRect.width / 2;
		const bubbleY = bubbleCenterY - bubbleRect.height / 2;
		playerIdleHintBubble.style.transform = `translate(${bubbleX}px, ${bubbleY}px)`;

		const pointerAngleDeg =
			(Math.atan2(visualsCenterY - bubbleCenterY, visualsCenterX - bubbleCenterX) * 180) / Math.PI;
		playerIdleHintBubble.style.setProperty("--player-bubble-pointer-angle", `${pointerAngleDeg}deg`);
	};

	const spawnBullet = (directionX, directionY) => {
		if (!(playerVisuals instanceof HTMLElement)) {
			return;
		}

		const visualsRect = playerVisuals.getBoundingClientRect();
		const visualsCenterX = visualsRect.left + visualsRect.width / 2;
		const visualsCenterY = visualsRect.top + visualsRect.height / 2;
		const bulletRadius = PLAYER_BULLET_SIZE_PX / 2;
		const visualsRadiusX = visualsRect.width / 2;
		const visualsRadiusY = visualsRect.height / 2;

		const startCenterX = visualsCenterX + directionX * (visualsRadiusX + PLAYER_BULLET_OFFSET_FROM_VISUALS_PX + bulletRadius);
		const startCenterY = visualsCenterY + directionY * (visualsRadiusY + PLAYER_BULLET_OFFSET_FROM_VISUALS_PX + bulletRadius);

		const bulletElement = document.createElement("div");
		bulletElement.className = "player-bullet";
		document.body.append(bulletElement);

		activeBullets.push({
			element: bulletElement,
			centerX: startCenterX,
			centerY: startCenterY,
			velocityX: directionX * PLAYER_BULLET_SPEED_PX_PER_SECOND,
			velocityY: directionY * PLAYER_BULLET_SPEED_PX_PER_SECOND,
		});

		velocityX -= directionX * PLAYER_BULLET_RECOIL_SPEED_DELTA_PX_PER_SECOND;
		velocityY -= directionY * PLAYER_BULLET_RECOIL_SPEED_DELTA_PX_PER_SECOND;
		const currentSpeed = Math.hypot(velocityX, velocityY);
		if (currentSpeed > PLAYER_MOVE_SPEED_PX_PER_SECOND) {
			const speedScale = PLAYER_MOVE_SPEED_PX_PER_SECOND / currentSpeed;
			velocityX *= speedScale;
			velocityY *= speedScale;
		}

		bulletElement.style.transform = `translate(${startCenterX - bulletRadius}px, ${startCenterY - bulletRadius}px)`;
	};

	const updateBullets = (elapsedSeconds) => {
		if (activeBullets.length === 0) {
			return;
		}

		const bulletRadius = PLAYER_BULLET_SIZE_PX / 2;
		for (let index = activeBullets.length - 1; index >= 0; index -= 1) {
			const bullet = activeBullets[index];
			bullet.centerX += bullet.velocityX * elapsedSeconds;
			bullet.centerY += bullet.velocityY * elapsedSeconds;

			const isCompletelyOffScreen =
				bullet.centerX + bulletRadius < 0 ||
				bullet.centerX - bulletRadius > window.innerWidth ||
				bullet.centerY + bulletRadius < 0 ||
				bullet.centerY - bulletRadius > window.innerHeight;

			if (isCompletelyOffScreen) {
				bullet.element.remove();
				activeBullets.splice(index, 1);
				continue;
			}

			bullet.element.style.transform = `translate(${bullet.centerX - bulletRadius}px, ${bullet.centerY - bulletRadius}px)`;
		}
	};

	const readSavedPlayerState = () => {
		const rawState = readStorageItem(sessionStorage, PLAYER_STATE_KEY);
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
			const savedPlayerVisualsOffsetX = Number(parsedState.childOffsetX);
			const savedPlayerVisualsOffsetY = Number(parsedState.childOffsetY);
			const savedPlayerVisualsPhaseX =
				typeof parsedState.childPhaseX === "string" && parsedState.childPhaseX.trim().length > 0
					? parsedState.childPhaseX
					: "0deg";
			const savedPlayerVisualsPhaseY =
				typeof parsedState.childPhaseY === "string" && parsedState.childPhaseY.trim().length > 0
					? parsedState.childPhaseY
					: "0deg";

			if (
				!Number.isFinite(savedOffsetX) ||
				!Number.isFinite(savedOffsetY) ||
				!Number.isFinite(savedVelocityX) ||
				!Number.isFinite(savedVelocityY) ||
				!Number.isFinite(savedPlayerVisualsOffsetX) ||
				!Number.isFinite(savedPlayerVisualsOffsetY)
			) {
				return null;
			}

			return {
				offsetX: savedOffsetX,
				offsetY: savedOffsetY,
				velocityX: savedVelocityX,
				velocityY: savedVelocityY,
				playerVisualsOffsetX: savedPlayerVisualsOffsetX,
				playerVisualsOffsetY: savedPlayerVisualsOffsetY,
				playerVisualsPhaseX: savedPlayerVisualsPhaseX,
				playerVisualsPhaseY: savedPlayerVisualsPhaseY,
			};
		} catch {
			return null;
		}
	};

	const capturePlayerVisualsState = () => {
		if (!(playerVisuals instanceof HTMLElement)) {
			return;
		}

		const parentRect = player.getBoundingClientRect();
		const childRect = playerVisuals.getBoundingClientRect();
		const parentCenterX = parentRect.left + parentRect.width / 2;
		const parentCenterY = parentRect.top + parentRect.height / 2;
		const childCenterX = childRect.left + childRect.width / 2;
		const childCenterY = childRect.top + childRect.height / 2;

		playerVisualsOffsetX = childCenterX - parentCenterX;
		playerVisualsOffsetY = childCenterY - parentCenterY;

		const computedStyle = getComputedStyle(playerVisuals);
		const nextPlayerVisualsPhaseX = computedStyle.getPropertyValue("--player-visuals-phase-x").trim();
		const nextPlayerVisualsPhaseY = computedStyle.getPropertyValue("--player-visuals-phase-y").trim();
		if (nextPlayerVisualsPhaseX) {
			playerVisualsPhaseX = nextPlayerVisualsPhaseX;
		}
		if (nextPlayerVisualsPhaseY) {
			playerVisualsPhaseY = nextPlayerVisualsPhaseY;
		}
	};

	const applySavedPlayerVisualsPhase = () => {
		if (!(playerVisuals instanceof HTMLElement)) {
			return;
		}

		playerVisuals.style.setProperty("--player-visuals-phase-start-x", playerVisualsPhaseX);
		playerVisuals.style.setProperty("--player-visuals-phase-start-y", playerVisualsPhaseY);
	};

	const savePlayerState = () => {
		capturePlayerVisualsState();
		writeStorageItem(
			sessionStorage,
			PLAYER_STATE_KEY,
			JSON.stringify({
				offsetX,
				offsetY,
				velocityX,
				velocityY,
				childOffsetX: playerVisualsOffsetX,
				childOffsetY: playerVisualsOffsetY,
				childPhaseX: playerVisualsPhaseX,
				childPhaseY: playerVisualsPhaseY,
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
		player.style.transform = `translate(calc(-50% + ${offsetX}px), ${offsetY}px)`;
	};

	const clampPositionWithinViewport = () => {
		const rect = player.getBoundingClientRect();
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

	const alignPlayerWithSquareStart = () => {
		if (!(runnerSquare instanceof HTMLElement)) {
			return;
		}

		const parentRect = player.getBoundingClientRect();
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

		if (restoredCarryKeys.size > 0 && timestampMs >= restoredCarryExpiresAtMs) {
			restoredCarryKeys.forEach((key) => {
				activeKeys.delete(key);
			});
			restoredCarryKeys.clear();
			saveInputCarryState();
		}

		const elapsedSeconds = Math.min(50, timestampMs - lastTimestampMs) / 1000;
		lastTimestampMs = timestampMs;

		updateBullets(elapsedSeconds);

		const { directionX, directionY } = getDirection();
		const hasDirectionalInput = directionX !== 0 || directionY !== 0;
		if (hasDirectionalInput) {
			if (!hasPlayerMovementStarted) {
				hasPlayerMovementStarted = true;
				saveIdleHintState();
			}
			hasReceivedDirectionalInput = true;
			lastDirectionalInputTimestampMs = timestampMs;
		}

		const isSeekDelayElapsed = timestampMs - lastDirectionalInputTimestampMs >= PLAYER_SEEK_IDLE_DELAY_MS;
		const shouldSeekSquare =
			!hasDirectionalInput && (!hasReceivedDirectionalInput || isSeekDelayElapsed);

		if (hasDirectionalInput) {
			const directionMagnitude = Math.hypot(directionX, directionY) || 1;
			const normalizedDirectionX = directionX / directionMagnitude;
			const normalizedDirectionY = directionY / directionMagnitude;

			velocityX += normalizedDirectionX * PLAYER_ACCELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;
			velocityY += normalizedDirectionY * PLAYER_ACCELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;

			const currentSpeed = Math.hypot(velocityX, velocityY);
			if (currentSpeed > PLAYER_MOVE_SPEED_PX_PER_SECOND) {
				const speedScale = PLAYER_MOVE_SPEED_PX_PER_SECOND / currentSpeed;
				velocityX *= speedScale;
				velocityY *= speedScale;
			}
		} else if (shouldSeekSquare && runnerSquare instanceof HTMLElement) {
			const parentRect = player.getBoundingClientRect();
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
				const seekSpeed = Math.min(PLAYER_SEEK_MAX_SPEED_PX_PER_SECOND, distance * 1.6);
				const targetVelocityX = seekDirectionX * seekSpeed;
				const targetVelocityY = seekDirectionY * seekSpeed;
				const seekAccelerationPerFrame = PLAYER_SEEK_ACCELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;
				velocityX = moveToward(velocityX, targetVelocityX, seekAccelerationPerFrame);
				velocityY = moveToward(velocityY, targetVelocityY, seekAccelerationPerFrame);
			}
		} else {
			const decelerationPerFrame = PLAYER_DECELERATION_PX_PER_SECOND_SQUARED * elapsedSeconds;
			velocityX = moveToward(velocityX, 0, decelerationPerFrame);
			velocityY = moveToward(velocityY, 0, decelerationPerFrame);
		}

		offsetX += velocityX * elapsedSeconds;
		offsetY += velocityY * elapsedSeconds;
		applyPosition();
		clampPositionWithinViewport();

		if (typeof window.updateTabProximityFromPlayerVisuals === "function" && playerVisuals instanceof HTMLElement) {
			const playerBounds = player.getBoundingClientRect();
			const playerCenterX = playerBounds.left + playerBounds.width / 2;
			const playerCenterY = playerBounds.top + playerBounds.height / 2;
			const visualsBounds = playerVisuals.getBoundingClientRect();
			const visualsCenterX = visualsBounds.left + visualsBounds.width / 2;
			const visualsCenterY = visualsBounds.top + visualsBounds.height / 2;
			window.updateTabProximityFromPlayerVisuals(
				visualsCenterX,
				visualsCenterY,
			);
			updatePlayerInteractBubble(playerCenterX, playerCenterY, visualsCenterX, visualsCenterY);
			updatePlayerIdleHintBubble(playerCenterX, playerCenterY, visualsCenterX, visualsCenterY);
		} else {
			hidePlayerInteractBubble();
			hidePlayerIdleHintBubble();
		}

		savePlayerState();

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

		const arrowKeyDirections = {
			arrowup: { directionX: 0, directionY: -1 },
			arrowdown: { directionX: 0, directionY: 1 },
			arrowleft: { directionX: -1, directionY: 0 },
			arrowright: { directionX: 1, directionY: 0 },
		};

		const normalizedKey = event.key.toLowerCase();
		const arrowDirection = arrowKeyDirections[normalizedKey];
		if (arrowDirection) {
			event.preventDefault();
			if (!event.repeat) {
				spawnBullet(arrowDirection.directionX, arrowDirection.directionY);
			}
			ensureAnimationLoop();
			return;
		}

		const key = normalizedKey;
		if (key !== "w" && key !== "a" && key !== "s" && key !== "d") {
			return;
		}

		event.preventDefault();
		activeKeys.add(key);
		restoredCarryKeys.delete(key);
		saveInputCarryState();
		ensureAnimationLoop();
	};

	const handleKeyUp = (event) => {
		const key = event.key.toLowerCase();
		if (key !== "w" && key !== "a" && key !== "s" && key !== "d") {
			return;
		}

		activeKeys.delete(key);
		restoredCarryKeys.delete(key);
		saveInputCarryState();
	};

	const handleWindowBlur = () => {
		activeKeys.clear();
		restoredCarryKeys.clear();
		saveInputCarryState();
	};

	const savedState = readSavedPlayerState();
	const hasRestoredPlayerState = Boolean(savedState);
	if (savedState) {
		offsetX = savedState.offsetX;
		offsetY = savedState.offsetY;
		velocityX = savedState.velocityX;
		velocityY = savedState.velocityY;
		playerVisualsOffsetX = savedState.playerVisualsOffsetX;
		playerVisualsOffsetY = savedState.playerVisualsOffsetY;
		playerVisualsPhaseX = savedState.playerVisualsPhaseX;
		playerVisualsPhaseY = savedState.playerVisualsPhaseY;
		applySavedPlayerVisualsPhase();
		applyPosition();
		clampPositionWithinViewport();
	}

	restoreInputCarryState();
	restoreIdleHintState();

	document.addEventListener("keydown", handleKeyDown);
	document.addEventListener("keyup", handleKeyUp);
	window.addEventListener("blur", handleWindowBlur);
	window.addEventListener("resize", () => {
		applyPosition();
		clampPositionWithinViewport();
		savePlayerState();
	});
	window.addEventListener("pagehide", savePlayerState);
	window.addEventListener("pagehide", saveInputCarryState);
	window.addEventListener("pagehide", saveIdleHintState);
	if (!hasRestoredPlayerState) {
		alignPlayerWithSquareStart();
		savePlayerState();
	}
	ensureAnimationLoop();
}

function initializeSiteUi() {
	const player = initializePlayerDecoration();
	const runnerSquare = initializeBottomSquareRunner();

	try {
		initializeBottomSquareRunnerMovement(runnerSquare);
	} catch {
	}

	try {
		initializePlayerMovement(player, runnerSquare);
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

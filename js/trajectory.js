
function showResizeDebugA() {
	if (!document.body.classList.contains('trajectory-page')) return;
	// Hide warning if narrow screen
	if (window.innerWidth <= 1000) {
		const oldWarn = document.getElementById('resize-broken-warning');
		if (oldWarn) oldWarn.remove();
		return;
	}

	// Remove any previous warning
	const oldWarn = document.getElementById('resize-broken-warning');
	if (oldWarn) oldWarn.remove();

	// Find the nav tabs holder
	const nav = document.querySelector('.site-nav');
	if (nav) {
		const warn = document.createElement('div');
		warn.id = 'resize-broken-warning';
		warn.textContent = '[ resizing broke the game. maybe change tabs again? ]';
		warn.style.background = '#ff0033';
		warn.style.color = '#fff';
		warn.style.fontSize = '1.1rem';
		warn.style.fontWeight = 'bold';
		warn.style.textAlign = 'center';
		warn.style.padding = '0.7em 0.5em';
		warn.style.margin = '0 0 1em 0';
		warn.style.borderRadius = '0 0 8px 8px';
		warn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
		warn.style.zIndex = '10001';
		warn.style.opacity = '0.5';
		warn.style.display = 'block';
		warn.style.position = 'absolute';
		warn.style.left = '0';
		warn.style.right = '0';
		warn.style.width = '100vw';
		warn.style.maxWidth = '100vw';
		warn.style.top = 'unset';
		// Place below nav in screen space
		if (nav) {
			const navRect = nav.getBoundingClientRect();
			// Account for scroll position
			const scrollY = window.scrollY || window.pageYOffset;
			warn.style.top = (navRect.bottom + scrollY) + 'px';
			warn.style.position = 'absolute';
			document.body.appendChild(warn);
		} else {
			// fallback: append to body at top
			warn.style.top = '0';
			document.body.appendChild(warn);
		}
	}
}

window.addEventListener('resize', showResizeDebugA);


function initializeTrajectoryPageBehavior() {
	if (!document.body.classList.contains("trajectory-page")) {
		return;
	}

	const siteNav = document.querySelector(".site-nav");
	if (!(siteNav instanceof HTMLElement)) {
		return;
	}

	const YEAR_TOP = 2026;
	const YEAR_BOTTOM = 2010;
	const YEAR_SPACING_PX = 100;
	const YEAR_START_OFFSET_PX = 100;
	const YEAR_FADE_DISTANCE_PX = 120;
	const YEAR_BOTTOM_SCROLL_PADDING_PX = 120;

	const YEAR_REVEAL_START_DELAY_MS = 500;
	const YEAR_REVEAL_STAGGER_MS = 60;

	const RECTANGLE_REVEAL_START_DELAY_MS = 2000;
	const RECTANGLE_REVEAL_BAND_HEIGHT_PX = 200;
	const RECTANGLE_REVEAL_SPEED_PX_PER_SECOND = 100;
	const RECTANGLE_REVEAL_MAX_FPS = 24;

    
	const RECTANGLE_FIXED_WIDTH_PX = 100;
	const TRAJECTORY_RECTANGLES_RIGHT = [
		{ startYear: 2025, endYear: 2026, xOffsetPx: 120, title: "Aurora", description: "" },
		{ startYear: 2021, endYear: 2023, xOffsetPx: 260, title: "Plasma", description: "" },
		{ startYear: 2018, endYear: 2020, xOffsetPx: 190, title: "Neon", description: "" },
	];
	const TRAJECTORY_RECTANGLES_LEFT = [
		{ startYear: 2019, endYear: 2022, xOffsetPx: 120, title: "Scan", description: "" },
		{ startYear: 2018, endYear: 2023, xOffsetPx: 300, title: "Noise", description: "" },
		{ startYear: 2020, endYear: 2024, xOffsetPx: 450, title: "Pulse", description: "" },
	];
	const TRAJECTORY_RECTANGLE_DEFINITIONS = [
		...TRAJECTORY_RECTANGLES_RIGHT.map((definition) => ({ ...definition, side: "right" })),
		...TRAJECTORY_RECTANGLES_LEFT.map((definition) => ({ ...definition, side: "left" })),
	];

	window.TRAJECTORY_RECTANGLE_DEFINITIONS = TRAJECTORY_RECTANGLE_DEFINITIONS;
	window.YEAR_SPACING_PX = YEAR_SPACING_PX;
	window.YEAR_START_OFFSET_PX = YEAR_START_OFFSET_PX;
	
	const yearTickElements = [];
	const yearRectangleElements = [];

	let linePageX = window.innerWidth / 2;
	let firstYearY = 0;
	let pointerClientX = Number.NaN;
	let pointerClientY = Number.NaN;
	let rectangleRevealStartTimestampMs = null;
	let rectangleRevealAnimationFrameId = 0;
	let lastRectangleRevealRenderTimestampMs = 0;
	let noisePrewarmToken = 0;

	const yearsLayer = (() => {
		const existingLayer = document.querySelector(".trajectory-years-layer");
		if (existingLayer instanceof HTMLElement) {
			return existingLayer;
		}

		const layer = document.createElement("div");
		layer.className = "trajectory-years-layer";
		document.body.append(layer);
		return layer;
	})();

	const rectanglesLayer = (() => {
		const existingLayer = document.querySelector(".trajectory-rectangles-layer");
		if (existingLayer instanceof HTMLElement) {
			return existingLayer;
		}

		const layer = document.createElement("div");
		layer.className = "trajectory-rectangles-layer";
		document.body.append(layer);
		return layer;
	})();

	const randomSaturatedHue = () => {
		return Math.floor(Math.random() * 360);
	};



	const getYearCenterY = (yearValue) => {
		const numericYear = Number(yearValue);
		if (!Number.isFinite(numericYear)) {
			return null;
		}

		return firstYearY + (YEAR_TOP - numericYear) * YEAR_SPACING_PX;
	};

	const updateYearLabelOpacity = () => {
		if (!Number.isFinite(pointerClientX) || !Number.isFinite(pointerClientY)) {
			yearTickElements.forEach((tick) => {
				tick.label.style.opacity = "0";
			});
			return;
		}

		const pointerPageX = pointerClientX + window.scrollX;
		const pointerPageY = pointerClientY + window.scrollY;

		yearTickElements.forEach((tick) => {
			const distance = Math.hypot(pointerPageX - linePageX, pointerPageY - tick.centerY);
			const proximity = Math.max(0, 1 - distance / YEAR_FADE_DISTANCE_PX);
			tick.label.style.opacity = proximity.toFixed(3);
		});
	};

	const ensureYearTicks = () => {
		if (yearTickElements.length > 0) {
			return;
		}

		for (let year = YEAR_TOP; year >= YEAR_BOTTOM; year -= 1) {
			const tick = document.createElement("div");
			tick.className = "trajectory-year-tick";
			tick.style.setProperty(
				"--trajectory-year-reveal-delay",
				`${YEAR_REVEAL_START_DELAY_MS + (YEAR_TOP - year) * YEAR_REVEAL_STAGGER_MS}ms`,
			);
			const label = document.createElement("span");
			label.className = "trajectory-year-label";
			label.textContent = String(year);
			tick.append(label);
			yearsLayer.append(tick);

			yearTickElements.push({ tick, label, centerY: 0 });
		}
	};

	const ensureYearRectangles = () => {
		if (yearRectangleElements.length > 0) {
			return;
		}

		TRAJECTORY_RECTANGLE_DEFINITIONS.forEach((definition, index) => {
			const rectangle = document.createElement("div");
			rectangle.className = "trajectory-year-rectangle";
			rectangle.classList.add("trajectory-year-rectangle--aurora");
			rectangle.style.setProperty("--trajectory-rectangle-base-hue", String(randomSaturatedHue()));
			const highlightOverlay = document.createElement("div");
			highlightOverlay.className = "trajectory-year-rectangle-highlight";
			const rectangleText = document.createElement("span");
			rectangleText.className = "trajectory-year-rectangle-text";
			rectangle.append(highlightOverlay);
			rectangle.append(rectangleText);
			rectanglesLayer.append(rectangle);

			definition.rect = highlightOverlay;

			yearRectangleElements.push({
				rectangle,
				highlightOverlay,
				rectangleText,
				definition,
				index,
				leftX: 0,
				topY: 0,
				width: 0,
				height: 0,
			});
		});
	};


	const updateYearTickPositions = () => {
		let maxYearY = 0;
		yearTickElements.forEach((yearTick, index) => {
			const centerY = firstYearY + index * YEAR_SPACING_PX;
			yearTick.centerY = centerY;
			yearTick.tick.style.top = `${centerY}px`;
			// On narrow screens, always render at 50vw; else use linePageX
			if (window.matchMedia("(max-width: 1000px)").matches) {
				yearTick.tick.style.left = '50vw';
			} else {
				yearTick.tick.style.left = `${linePageX}px`;
			}
			yearTick.tick.style.transform = 'translateX(-50%)';
			maxYearY = Math.max(maxYearY, centerY);
		});
		return maxYearY;
	};

	const updateYearRectangles = () => {
		let maxRectangleY = 0;

		yearRectangleElements.forEach((entry) => {
			const { rectangle, rectangleText, definition, index } = entry;
			const startY = getYearCenterY(definition.startYear);
			const endY = getYearCenterY(definition.endYear);

			if (startY === null || endY === null) {
				rectangle.style.display = "none";
				return;
			}

			rectangle.style.display = "block";
			const topY = Math.min(startY, endY);
			const bottomY = Math.max(startY, endY);
			const centerY = (topY + bottomY) / 2;
			const heightPx = Math.max(2, bottomY - topY);
			const xOffsetMagnitudePx = Number.isFinite(Number(definition.xOffsetPx))
				? Math.abs(Number(definition.xOffsetPx))
				: 0;
			const xOffsetSign = definition.side === "left" ? -1 : 1;
			const xOffsetPx = xOffsetMagnitudePx * xOffsetSign;

			rectangle.style.left = `${linePageX + xOffsetPx}px`;
			rectangle.style.top = `${centerY}px`;
			rectangle.style.width = `${RECTANGLE_FIXED_WIDTH_PX}px`;
			rectangle.style.height = `${heightPx}px`;
			entry.width = RECTANGLE_FIXED_WIDTH_PX;
			entry.height = heightPx;
			entry.leftX = linePageX + xOffsetPx - RECTANGLE_FIXED_WIDTH_PX / 2;
			entry.topY = centerY - heightPx / 2;
			rectangleText.textContent = typeof definition.title === "string" ? definition.title : "";

			rectangle.dataset.id = typeof definition.id === "string" ? definition.id : `rect-${index}`;
			rectangle.dataset.description =
				typeof definition.description === "string" ? definition.description : "";
			maxRectangleY = Math.max(maxRectangleY, bottomY);
		});

		return maxRectangleY;
	};

	const updatePageMinHeight = (maxContentY) => {
		const requiredBodyMinHeight = Math.max(window.innerHeight, maxContentY + YEAR_BOTTOM_SCROLL_PADDING_PX);
		document.body.style.minHeight = `${requiredBodyMinHeight}px`;
	};

	const updateLinePosition = () => {
		const trajectoryTab = document.querySelector('.site-nav a[href$="trajectory.html"]');
		if (!(trajectoryTab instanceof HTMLElement)) {
			return;
		}

		const tabRect = trajectoryTab.getBoundingClientRect();
		const navRect = siteNav.getBoundingClientRect();
		if (tabRect.width <= 0 || navRect.width <= 0) {
			return;
		}

		const isNarrowScreen = window.matchMedia("(max-width: 1000px)").matches;
		if (isNarrowScreen) {
			firstYearY = 100; // Fixed offset from top for narrow screens
		} else {
			firstYearY = navRect.bottom + YEAR_START_OFFSET_PX;
		}
		
		const lineViewportX = isNarrowScreen ? window.innerWidth / 2 : tabRect.left + tabRect.width / 2;
		const centerXWithinNav = tabRect.left + tabRect.width / 2 - navRect.left;
		linePageX = lineViewportX + window.scrollX;
		window.linePageX = linePageX;

		siteNav.style.setProperty("--trajectory-line-x", `${centerXWithinNav}px`);
		siteNav.style.setProperty("--trajectory-line-top-offset", `${navRect.top}px`);
		document.body.style.setProperty("--trajectory-line-screen-x", `${linePageX}px`);

		const maxYearY = updateYearTickPositions();
		const maxRectangleY = updateYearRectangles();
		// prewarmRectangleNoiseLookups();
		updatePageMinHeight(Math.max(maxYearY, maxRectangleY));
		updateYearLabelOpacity();
	};

	window.updateTrajectoryLinePosition = updateLinePosition;

	window.trajectoryRectangleDefinitionsRight = TRAJECTORY_RECTANGLES_RIGHT;
	window.trajectoryRectangleDefinitionsLeft = TRAJECTORY_RECTANGLES_LEFT;

	ensureYearTicks();
	ensureYearRectangles();
	updateLinePosition();



	window.SetRectanglesTimeouts = function()
	{
		console.log(window.REVEAL_DELAY_PER_YEAR_MS + " " + window.RECTANGLE_REVEAL_SPEED_PX_PER_SECOND + " " + window.RECTANGLE_REVEAL_START_DELAY_MS + " " + window.RECTANGLE_REVEAL_BAND_HEIGHT_PX);
		yearRectangleElements.forEach((entry) => {
			
			const delay =
				(YEAR_TOP - entry.definition.endYear) * window.REVEAL_DELAY_PER_YEAR_MS
				+
				((entry.definition.endYear - entry.definition.startYear) * YEAR_SPACING_PX + window.RECTANGLE_REVEAL_BAND_HEIGHT_PX) / window.RECTANGLE_REVEAL_SPEED_PX_PER_SECOND * 1000
				+
				window.RECTANGLE_REVEAL_START_DELAY_MS;
	
			setTimeout(() => {
				entry.rectangle.style.opacity = "1";
				entry.highlightOverlay.style.opacity = "1";
				// Start hue animation by adding class
				entry.highlightOverlay.classList.add('hue-anim-running');
				// Force reflow to ensure animation starts
				void entry.rectangle.offsetWidth;
			}, delay);
		});
	};

	window.requestAnimationFrame(updateLinePosition);
	window.setTimeout(updateLinePosition, 200);
	window.addEventListener("resize", updateLinePosition);
	window.addEventListener("scroll", updateYearLabelOpacity, { passive: true });
	window.addEventListener("mousemove", (event) => {
		pointerClientX = event.clientX;
		pointerClientY = event.clientY;
		updateYearLabelOpacity();
	});
	window.addEventListener("mouseleave", () => {
		pointerClientX = Number.NaN;
		pointerClientY = Number.NaN;
		updateYearLabelOpacity();
	});

	if (typeof ResizeObserver === "function") {
		const layoutObserver = new ResizeObserver(updateLinePosition);
		layoutObserver.observe(siteNav);
	}

	document.addEventListener("click", (event) => {
		const toggleButton = event.target instanceof Element ? event.target.closest(".site-menu-toggle") : null;
		if (!toggleButton) {
			return;
		}

		window.requestAnimationFrame(updateLinePosition);
		window.setTimeout(updateLinePosition, 180);
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeTrajectoryPageBehavior);
} else {
	initializeTrajectoryPageBehavior();
}
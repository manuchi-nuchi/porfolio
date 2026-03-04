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

	const RECTANGLE_REVEAL_START_DELAY_MS = 0;
	const RECTANGLE_REVEAL_BAND_HEIGHT_PX = 200;
	const RECTANGLE_REVEAL_SPEED_PX_PER_SECOND = 100;
	const RECTANGLE_REVEAL_MAX_FPS = 24;
	const RECTANGLE_MASK_RESOLUTION_SCALE = 1;
	const RECTANGLE_WHITE_BAND_WIDTH_PX = 10;
	const PERLIN_SHADER_FREQUENCY = 0.05;
	const PERLIN_SHADER_OCTAVES = 1;

	const PERLIN_BASE_FREQUENCY = 0.05;
	const PERLIN_OCTAVES = 1;
	const PERLIN_SEED = 7;
    
	const RECTANGLE_FIXED_WIDTH_PX = 100;
	const TRAJECTORY_RECTANGLES_RIGHT = [
		{ startYear: 2024, endYear: 2026, xOffsetPx: 120, title: "Aurora", description: "" },
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

	const PERLIN_PERMUTATION = new Uint8Array([
		151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
		140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
		247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
		57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
		74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
		60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
		65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
		200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
		52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
		207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
		119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
		129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
		218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
		81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
		184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
		222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
	]);
	const PERLIN_LOOKUP = new Uint8Array(512);
	for (let index = 0; index < 512; index += 1) {
		PERLIN_LOOKUP[index] = PERLIN_PERMUTATION[index & 255];
	}

	const perlinFade = (value) => value * value * value * (value * (value * 6 - 15) + 10);
	const perlinLerp = (a, b, t) => a + t * (b - a);
	const perlinGrad = (hash, x, y) => {
		const h = hash & 7;
		const u = h < 4 ? x : y;
		const v = h < 4 ? y : x;
		return (h & 1 ? -u : u) + (h & 2 ? -v : v);
	};

	const perlin2D01 = (x, y) => {
		const xi = Math.floor(x) & 255;
		const yi = Math.floor(y) & 255;
		const xf = x - Math.floor(x);
		const yf = y - Math.floor(y);
		const u = perlinFade(xf);
		const v = perlinFade(yf);

		const aa = PERLIN_LOOKUP[PERLIN_LOOKUP[xi] + yi];
		const ab = PERLIN_LOOKUP[PERLIN_LOOKUP[xi] + yi + 1];
		const ba = PERLIN_LOOKUP[PERLIN_LOOKUP[xi + 1] + yi];
		const bb = PERLIN_LOOKUP[PERLIN_LOOKUP[xi + 1] + yi + 1];

		const x1 = perlinLerp(perlinGrad(aa, xf, yf), perlinGrad(ba, xf - 1, yf), u);
		const x2 = perlinLerp(perlinGrad(ab, xf, yf - 1), perlinGrad(bb, xf - 1, yf - 1), u);
		const value = perlinLerp(x1, x2, v);
		return (value + 1) * 0.5;
	};

	const sampledPerlinNoise = (x, y) => {
		let total = 0;
		let amplitude = 1;
		let frequency = PERLIN_SHADER_FREQUENCY;
		let amplitudeSum = 0;

		for (let octave = 0; octave < PERLIN_SHADER_OCTAVES; octave += 1) {
			total += perlin2D01(x * frequency, y * frequency) * amplitude;
			amplitudeSum += amplitude;
			amplitude *= 0.5;
			frequency *= 2;
		}

		return amplitudeSum > 0 ? total / amplitudeSum : 0;
	};

	const ensurePerlinNoiseFilter = () => {
		if (document.getElementById("trajectory-perlin-noise-filter")) {
			return;
		}

		const svgNamespace = "http://www.w3.org/2000/svg";
		const svg = document.createElementNS(svgNamespace, "svg");
		svg.setAttribute("width", "0");
		svg.setAttribute("height", "0");
		svg.setAttribute("aria-hidden", "true");
		svg.style.position = "absolute";
		svg.style.width = "0";
		svg.style.height = "0";
		svg.style.overflow = "hidden";

		const defs = document.createElementNS(svgNamespace, "defs");
		const filter = document.createElementNS(svgNamespace, "filter");
		filter.setAttribute("id", "trajectory-perlin-noise-filter");
		filter.setAttribute("x", "-20%");
		filter.setAttribute("y", "-20%");
		filter.setAttribute("width", "140%");
		filter.setAttribute("height", "140%");

		const turbulence = document.createElementNS(svgNamespace, "feTurbulence");
		turbulence.setAttribute("type", "fractalNoise");
		turbulence.setAttribute("baseFrequency", String(PERLIN_BASE_FREQUENCY));
		turbulence.setAttribute("numOctaves", String(PERLIN_OCTAVES));
		turbulence.setAttribute("seed", String(PERLIN_SEED));
		turbulence.setAttribute("result", "noise");

		const colorMatrix = document.createElementNS(svgNamespace, "feColorMatrix");
		colorMatrix.setAttribute("in", "noise");
		colorMatrix.setAttribute("type", "saturate");
		colorMatrix.setAttribute("values", "0");
		colorMatrix.setAttribute("result", "monoNoise");

		const blend = document.createElementNS(svgNamespace, "feBlend");
		blend.setAttribute("in", "SourceGraphic");
		blend.setAttribute("in2", "monoNoise");
		blend.setAttribute("mode", "overlay");

		filter.append(turbulence, colorMatrix, blend);
		defs.append(filter);
		svg.append(defs);
		document.body.append(svg);
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
				maskCanvas: null,
				maskContext: null,
				maskImageData: null,
				highlightMaskCanvas: null,
				highlightMaskContext: null,
				highlightMaskImageData: null,
				noiseLookup: null,
				noiseLookupKey: "",
			});
		});
	};

	const applyMaskImage = (rectangle, maskUrl) => {
		rectangle.style.webkitMaskImage = `url("${maskUrl}")`;
		rectangle.style.maskImage = `url("${maskUrl}")`;
		rectangle.style.webkitMaskRepeat = "no-repeat";
		rectangle.style.maskRepeat = "no-repeat";
		rectangle.style.webkitMaskSize = "100% 100%";
		rectangle.style.maskSize = "100% 100%";
	};

	const clearMaskImage = (rectangle) => {
		rectangle.style.webkitMaskImage = "";
		rectangle.style.maskImage = "";
		rectangle.style.webkitMaskRepeat = "";
		rectangle.style.maskRepeat = "";
		rectangle.style.webkitMaskSize = "";
		rectangle.style.maskSize = "";
	};

	const clearEntryMaskResources = (entry) => {
		void entry;
	};

	const applyHighlightMaskImage = (highlightElement, maskUrl) => {
		highlightElement.style.webkitMaskImage = `url("${maskUrl}")`;
		highlightElement.style.maskImage = `url("${maskUrl}")`;
		highlightElement.style.webkitMaskRepeat = "no-repeat";
		highlightElement.style.maskRepeat = "no-repeat";
		highlightElement.style.webkitMaskSize = "100% 100%";
		highlightElement.style.maskSize = "100% 100%";
	};

	const clearHighlightMaskImage = (highlightElement) => {
		highlightElement.style.webkitMaskImage = "";
		highlightElement.style.maskImage = "";
		highlightElement.style.webkitMaskRepeat = "";
		highlightElement.style.maskRepeat = "";
		highlightElement.style.webkitMaskSize = "";
		highlightElement.style.maskSize = "";
	};

	const ensureMaskCanvas = (entry, width, height) => {
		if (!(entry.maskCanvas instanceof HTMLCanvasElement)) {
			entry.maskCanvas = document.createElement("canvas");
		}

		if (entry.maskCanvas.width !== width || entry.maskCanvas.height !== height) {
			entry.maskCanvas.width = width;
			entry.maskCanvas.height = height;
			entry.maskContext = entry.maskCanvas.getContext("2d", { willReadFrequently: false });
		}

		return entry.maskContext;
	};

	const ensureHighlightMaskCanvas = (entry, width, height) => {
		if (!(entry.highlightMaskCanvas instanceof HTMLCanvasElement)) {
			entry.highlightMaskCanvas = document.createElement("canvas");
		}

		if (entry.highlightMaskCanvas.width !== width || entry.highlightMaskCanvas.height !== height) {
			entry.highlightMaskCanvas.width = width;
			entry.highlightMaskCanvas.height = height;
			entry.highlightMaskContext = entry.highlightMaskCanvas.getContext("2d", {
				willReadFrequently: false,
			});
		}

		return entry.highlightMaskContext;
	};

	const ensureNoiseLookup = (entry, pixelWidth, pixelHeight, leftX, topY, width, height) => {
		const noiseLookupKey = `${pixelWidth}x${pixelHeight}:${leftX.toFixed(2)}:${topY.toFixed(2)}:${width.toFixed(2)}:${height.toFixed(2)}`;
		if (entry.noiseLookupKey === noiseLookupKey && entry.noiseLookup instanceof Uint8Array) {
			return entry.noiseLookup;
		}

		const noiseLookup = new Uint8Array(pixelWidth * pixelHeight);
		const xWorldStep = width / pixelWidth;
		const yWorldStep = height / pixelHeight;
		for (let y = 0; y < pixelHeight; y += 1) {
			const worldY = topY + (y + 0.5) * yWorldStep;
			const rowOffset = y * pixelWidth;
			for (let x = 0; x < pixelWidth; x += 1) {
				const worldX = leftX + (x + 0.5) * xWorldStep;
				noiseLookup[rowOffset + x] = Math.round(sampledPerlinNoise(worldX, worldY) * 255);
			}
		}

		entry.noiseLookup = noiseLookup;
		entry.noiseLookupKey = noiseLookupKey;
		return noiseLookup;
	};

	const prewarmRectangleNoiseLookups = () => {
		noisePrewarmToken += 1;
		const token = noisePrewarmToken;
		const pendingEntries = yearRectangleElements.filter((entry) => {
			if (entry.rectangle.style.display === "none" || entry.width <= 0 || entry.height <= 0) {
				return false;
			}

			const pixelWidth = Math.max(1, Math.round(entry.width * RECTANGLE_MASK_RESOLUTION_SCALE));
			const pixelHeight = Math.max(1, Math.round(entry.height * RECTANGLE_MASK_RESOLUTION_SCALE));
			const expectedKey = `${pixelWidth}x${pixelHeight}:${entry.leftX.toFixed(2)}:${entry.topY.toFixed(2)}:${entry.width.toFixed(2)}:${entry.height.toFixed(2)}`;
			return entry.noiseLookupKey !== expectedKey || !(entry.noiseLookup instanceof Uint8Array);
		});

		if (pendingEntries.length === 0) {
			return;
		}

		const processChunk = (startIndex) => {
			if (token !== noisePrewarmToken) {
				return;
			}

			const chunkEnd = Math.min(startIndex + 2, pendingEntries.length);
			for (let index = startIndex; index < chunkEnd; index += 1) {
				const entry = pendingEntries[index];
				const pixelWidth = Math.max(1, Math.round(entry.width * RECTANGLE_MASK_RESOLUTION_SCALE));
				const pixelHeight = Math.max(1, Math.round(entry.height * RECTANGLE_MASK_RESOLUTION_SCALE));
				ensureNoiseLookup(entry, pixelWidth, pixelHeight, entry.leftX, entry.topY, entry.width, entry.height);
			}

			if (chunkEnd >= pendingEntries.length) {
				return;
			}

			window.setTimeout(() => processChunk(chunkEnd), 0);
		};

		window.setTimeout(() => processChunk(0), 0);
	};

	const rowTemplateCache = new Map();
	const getRowTemplates = (pixelWidth) => {
		const cacheKey = String(pixelWidth);
		const existing = rowTemplateCache.get(cacheKey);
		if (existing) {
			return existing;
		}

		const rowLength = pixelWidth * 4;
		const opaqueRow = new Uint8ClampedArray(rowLength);
		const transparentRow = new Uint8ClampedArray(rowLength);
		for (let idx = 0; idx < rowLength; idx += 4) {
			opaqueRow[idx] = 255;
			opaqueRow[idx + 1] = 255;
			opaqueRow[idx + 2] = 255;
			opaqueRow[idx + 3] = 255;

			transparentRow[idx] = 255;
			transparentRow[idx + 1] = 255;
			transparentRow[idx + 2] = 255;
			transparentRow[idx + 3] = 0;
		}

		const templates = { opaqueRow, transparentRow };
		rowTemplateCache.set(cacheKey, templates);
		return templates;
	};

	const ensureMaskImageData = (entry, context2d, width, height) => {
		if (!(entry.maskImageData instanceof ImageData) || entry.maskImageData.width !== width || entry.maskImageData.height !== height) {
			entry.maskImageData = context2d.createImageData(width, height);
		}
		return entry.maskImageData;
	};

	const ensureHighlightMaskImageData = (entry, context2d, width, height) => {
		if (
			!(entry.highlightMaskImageData instanceof ImageData) ||
			entry.highlightMaskImageData.width !== width ||
			entry.highlightMaskImageData.height !== height
		) {
			entry.highlightMaskImageData = context2d.createImageData(width, height);
		}
		return entry.highlightMaskImageData;
	};

	const updateRectangleShaderReveal = (timestampMs) => {
		if (rectangleRevealStartTimestampMs === null) {
			rectangleRevealStartTimestampMs = timestampMs;
		}

		const minFrameIntervalMs = 1000 / RECTANGLE_REVEAL_MAX_FPS;
		if (timestampMs - lastRectangleRevealRenderTimestampMs < minFrameIntervalMs) {
			rectangleRevealAnimationFrameId = window.requestAnimationFrame(updateRectangleShaderReveal);
			return;
		}
		lastRectangleRevealRenderTimestampMs = timestampMs;

		const revealElapsedSeconds = Math.max(
			0,
			(timestampMs - rectangleRevealStartTimestampMs - RECTANGLE_REVEAL_START_DELAY_MS) / 1000,
		);
		const A = RECTANGLE_REVEAL_SPEED_PX_PER_SECOND * revealElapsedSeconds;
		const B = A - RECTANGLE_REVEAL_BAND_HEIGHT_PX;
		let allRevealed = true;

		yearRectangleElements.forEach((entry) => {
			const { rectangle, highlightOverlay, leftX, topY, width, height } = entry;
			if (rectangle.style.display === "none" || width <= 0 || height <= 0) {
				highlightOverlay.style.opacity = "0";
				clearHighlightMaskImage(highlightOverlay);
				clearMaskImage(rectangle);
				clearEntryMaskResources(entry);
				return;
			}

			const rectangleBottomY = topY + height;
			if (rectangleBottomY <= B) {
				rectangle.style.opacity = "0.9";
				highlightOverlay.style.opacity = "0";
				clearMaskImage(rectangle);
				clearHighlightMaskImage(highlightOverlay);
				clearEntryMaskResources(entry);
				return;
			}

			allRevealed = false;
			if (topY >= A) {
				rectangle.style.opacity = "0";
				highlightOverlay.style.opacity = "0";
				clearMaskImage(rectangle);
				clearHighlightMaskImage(highlightOverlay);
				clearEntryMaskResources(entry);
				return;
			}

			rectangle.style.opacity = "0.9";
			highlightOverlay.style.opacity = "0.95";
			const pixelWidth = Math.max(1, Math.round(width * RECTANGLE_MASK_RESOLUTION_SCALE));
			const pixelHeight = Math.max(1, Math.round(height * RECTANGLE_MASK_RESOLUTION_SCALE));
			const xWorldStep = width / pixelWidth;
			const yWorldStep = height / pixelHeight;
			const context2d = ensureMaskCanvas(entry, pixelWidth, pixelHeight);
			const highlightContext2d = ensureHighlightMaskCanvas(entry, pixelWidth, pixelHeight);
			if (!context2d || !highlightContext2d) {
				return;
			}
			const noiseLookup = ensureNoiseLookup(entry, pixelWidth, pixelHeight, leftX, topY, width, height);

			const imageData = ensureMaskImageData(entry, context2d, pixelWidth, pixelHeight);
			const data = imageData.data;
			const highlightImageData = ensureHighlightMaskImageData(entry, highlightContext2d, pixelWidth, pixelHeight);
			const highlightData = highlightImageData.data;
			const { opaqueRow, transparentRow } = getRowTemplates(pixelWidth);
			for (let y = 0; y < pixelHeight; y += 1) {
				const worldY = topY + (y + 0.5) * yWorldStep;
				const rowOffset = y * pixelWidth * 4;

				if (worldY > A) {
					data.set(transparentRow, rowOffset);
					highlightData.set(transparentRow, rowOffset);
					continue;
				}

				if (worldY < B) {
					data.set(opaqueRow, rowOffset);
					highlightData.set(transparentRow, rowOffset);
					continue;
				}

				const V = Math.max(0, Math.min(1, (A - worldY) / RECTANGLE_REVEAL_BAND_HEIGHT_PX));
				for (let x = 0; x < pixelWidth; x += 1) {
					const scaledPerlin = noiseLookup[y * pixelWidth + x];
					const scaledV = V * 255;
					const scaledUpperBand = scaledV + RECTANGLE_WHITE_BAND_WIDTH_PX;
					const isBelowThreshold = scaledPerlin < scaledV;
					const isWhiteBand = scaledPerlin > scaledV && scaledPerlin < scaledUpperBand;
					const alpha = isBelowThreshold || isWhiteBand ? 255 : 0;
					const highlightAlpha = isWhiteBand ? 255 : 0;
					const idx = rowOffset + x * 4;
					data[idx] = 255;
					data[idx + 1] = 255;
					data[idx + 2] = 255;
					data[idx + 3] = alpha;
					highlightData[idx] = 255;
					highlightData[idx + 1] = 255;
					highlightData[idx + 2] = 255;
					highlightData[idx + 3] = highlightAlpha;
				}
			}

			context2d.putImageData(imageData, 0, 0);
			highlightContext2d.putImageData(highlightImageData, 0, 0);
			applyMaskImage(rectangle, entry.maskCanvas.toDataURL("image/png"));
			applyHighlightMaskImage(highlightOverlay, entry.highlightMaskCanvas.toDataURL("image/png"));
		});

		if (!allRevealed) {
			rectangleRevealAnimationFrameId = window.requestAnimationFrame(updateRectangleShaderReveal);
			return;
		}

		rectangleRevealAnimationFrameId = 0;
	};

	const ensureRectangleRevealLoop = () => {
		if (rectangleRevealAnimationFrameId !== 0) {
			return;
		}

		rectangleRevealAnimationFrameId = window.requestAnimationFrame(updateRectangleShaderReveal);
	};

	const updateYearTickPositions = () => {
		let maxYearY = 0;
		yearTickElements.forEach((yearTick, index) => {
			const centerY = firstYearY + index * YEAR_SPACING_PX;
			yearTick.centerY = centerY;
			yearTick.tick.style.top = `${centerY}px`;
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

			if (typeof definition.color === "string" && definition.color.trim().length > 0) {
				rectangle.style.setProperty("--trajectory-rectangle-fill", definition.color.trim());
			} else {
				rectangle.style.removeProperty("--trajectory-rectangle-fill");
			}

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

		firstYearY = navRect.bottom + YEAR_START_OFFSET_PX;
		const isNarrowScreen = window.matchMedia("(max-width: 1000px)").matches;
		const lineViewportX = isNarrowScreen ? window.innerWidth / 2 : tabRect.left + tabRect.width / 2;
		const centerXWithinNav = tabRect.left + tabRect.width / 2 - navRect.left;
		linePageX = lineViewportX + window.scrollX;

		siteNav.style.setProperty("--trajectory-line-x", `${centerXWithinNav}px`);
		siteNav.style.setProperty("--trajectory-line-top-offset", `${navRect.top}px`);
		document.body.style.setProperty("--trajectory-line-screen-x", `${linePageX}px`);

		const maxYearY = updateYearTickPositions();
		const maxRectangleY = updateYearRectangles();
		prewarmRectangleNoiseLookups();
		updatePageMinHeight(Math.max(maxYearY, maxRectangleY));
		updateYearLabelOpacity();
	};

	window.updateTrajectoryLinePosition = updateLinePosition;
	window.trajectoryRectangleDefinitionsRight = TRAJECTORY_RECTANGLES_RIGHT;
	window.trajectoryRectangleDefinitionsLeft = TRAJECTORY_RECTANGLES_LEFT;
	ensurePerlinNoiseFilter();

	ensureYearTicks();
	ensureYearRectangles();
	updateLinePosition();
	ensureRectangleRevealLoop();

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
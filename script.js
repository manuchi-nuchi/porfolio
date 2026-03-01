const CAROUSEL_FOLDER = "img/carousel";
const CAROUSEL_MANIFEST_PATH = `${CAROUSEL_FOLDER}/manifest.json`;

function getImagesFromGlobalManifest() {
	const globalManifest = window.CAROUSEL_MANIFEST;
	if (!globalManifest || !Array.isArray(globalManifest.images)) {
		return [];
	}

	return globalManifest.images
		.filter((imageName) => typeof imageName === "string" && imageName.trim().length > 0)
		.map((imageName) => `${CAROUSEL_FOLDER}/${imageName}`);
}

async function loadCarouselImages() {
	const globalImages = getImagesFromGlobalManifest();
	if (globalImages.length > 0) {
		return globalImages;
	}

	const response = await fetch(CAROUSEL_MANIFEST_PATH, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`Unable to load carousel manifest: ${response.status}`);
	}

	const manifest = await response.json();
	const images = Array.isArray(manifest.images)
		? manifest.images.filter((imageName) => typeof imageName === "string" && imageName.trim().length > 0)
		: [];

	return images.map((imageName) => `${CAROUSEL_FOLDER}/${imageName}`);
}

async function initializeHomeCarousel() {
	const carouselImage = document.querySelector("#carousel-image");
	const previousButton = document.querySelector("#carousel-prev");
	const nextButton = document.querySelector("#carousel-next");
	const carouselViewport = document.querySelector(".carousel-viewport");
	const carouselMask = document.querySelector(".carousel-mask");

	if (!carouselImage || !previousButton || !nextButton || !carouselViewport || !carouselMask) {
		return;
	}

	carouselImage.draggable = false;
	carouselViewport.addEventListener("dragstart", (event) => {
		event.preventDefault();
	});
	carouselViewport.addEventListener("selectstart", (event) => {
		event.preventDefault();
	});

	let carouselImages = [];
	let currentIndex = 0;
	let isAnimating = false;

	try {
		carouselImages = await loadCarouselImages();
	} catch {
		carouselImages = [];
	}

	if (carouselImages.length === 0) {
		carouselImage.removeAttribute("src");
		carouselImage.alt = "No carousel images found";
		previousButton.disabled = true;
		nextButton.disabled = true;
		return;
	}

	const NEAR_EDGE_PX = 110;
	const SWIPE_TRIGGER_PX = 45;
	const SLIDE_DURATION_MS = 320;
	const AUTO_ADVANCE_MS = 4000;
	let slideFinishTimeoutId = null;
	let autoAdvanceTimeoutId = null;
	let activePointerId = null;
	let swipeStartX = 0;
	let swipeStartY = 0;
	let swipeHandled = false;
	let touchStartX = 0;
	let touchStartY = 0;
	let touchSwipeHandled = false;

	const transitionImage = document.createElement("img");
	transitionImage.alt = "";
	transitionImage.width = 760;
	transitionImage.height = 500;
	transitionImage.className = "carousel-transition-image";
	transitionImage.setAttribute("aria-hidden", "true");
	carouselMask.append(transitionImage);

	const updateArrowVisibility = (event) => {
		const bounds = carouselViewport.getBoundingClientRect();
		const pointerX = event.clientX - bounds.left;
		const nearLeft = pointerX <= NEAR_EDGE_PX;
		const nearRight = pointerX >= bounds.width - NEAR_EDGE_PX;

		carouselViewport.classList.toggle("show-prev", nearLeft);
		carouselViewport.classList.toggle("show-next", nearRight);
	};

	carouselViewport.addEventListener("mousemove", updateArrowVisibility);
	carouselViewport.addEventListener("mouseleave", () => {
		carouselViewport.classList.remove("show-prev");
		carouselViewport.classList.remove("show-next");
	});

	const setImageForIndex = (index) => {
		const source = carouselImages[index];
		carouselImage.src = source;
		carouselImage.alt = `Carousel image ${index + 1} of ${carouselImages.length}`;
	};

	const scheduleAutoAdvance = () => {
		if (autoAdvanceTimeoutId !== null) {
			window.clearTimeout(autoAdvanceTimeoutId);
		}

		autoAdvanceTimeoutId = window.setTimeout(() => {
			showNextImage();
		}, AUTO_ADVANCE_MS);
	};

	const animateToIndex = (nextIndex, direction) => {
		if (isAnimating || nextIndex === currentIndex) {
			return;
		}

		isAnimating = true;
		if (autoAdvanceTimeoutId !== null) {
			window.clearTimeout(autoAdvanceTimeoutId);
			autoAdvanceTimeoutId = null;
		}
		if (slideFinishTimeoutId !== null) {
			window.clearTimeout(slideFinishTimeoutId);
			slideFinishTimeoutId = null;
		}

		const slideDistancePx = Math.max(1, Math.round(carouselMask.offsetWidth));
		const incomingStartShift = direction > 0 ? `${slideDistancePx}px` : `-${slideDistancePx}px`;
		const outgoingEndShift = direction > 0 ? `-${slideDistancePx}px` : `${slideDistancePx}px`;

		carouselViewport.classList.add("is-sliding");

		transitionImage.src = carouselImages[nextIndex];
		transitionImage.alt = "";

		carouselImage.style.transition = "none";
		transitionImage.style.transition = "none";
		carouselImage.style.setProperty("--slide-shift", "0px");
		transitionImage.style.setProperty("--slide-shift", incomingStartShift);

		const finishAnimation = () => {
			if (!isAnimating) {
				return;
			}

			currentIndex = nextIndex;
			setImageForIndex(currentIndex);

			carouselImage.style.transition = "none";
			transitionImage.style.transition = "none";
			carouselImage.style.setProperty("--slide-shift", "0px");
			transitionImage.style.setProperty("--slide-shift", "0px");
			if (slideFinishTimeoutId !== null) {
				window.clearTimeout(slideFinishTimeoutId);
				slideFinishTimeoutId = null;
			}
			carouselViewport.classList.remove("is-sliding");
			isAnimating = false;
			scheduleAutoAdvance();
		};

		const handleTransitionEnd = (event) => {
			if (event.target !== transitionImage || event.propertyName !== "transform") {
				return;
			}

			transitionImage.removeEventListener("transitionend", handleTransitionEnd);
			finishAnimation();
		};

		transitionImage.addEventListener("transitionend", handleTransitionEnd);

		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				const transitionValue = `transform ${SLIDE_DURATION_MS}ms ease`;
				carouselImage.style.transition = transitionValue;
				transitionImage.style.transition = transitionValue;
				carouselImage.style.setProperty("--slide-shift", outgoingEndShift);
				transitionImage.style.setProperty("--slide-shift", "0px");

				slideFinishTimeoutId = window.setTimeout(() => {
					transitionImage.removeEventListener("transitionend", handleTransitionEnd);
					finishAnimation();
				}, SLIDE_DURATION_MS + 160);
			});
		});
	};

	const showPreviousImage = () => {
		const nextIndex = (currentIndex - 1 + carouselImages.length) % carouselImages.length;
		animateToIndex(nextIndex, -1);
	};

	const showNextImage = () => {
		const nextIndex = (currentIndex + 1) % carouselImages.length;
		animateToIndex(nextIndex, 1);
	};

	const handleSwipeDelta = (deltaX, deltaY) => {
		const isHorizontalSwipe = Math.abs(deltaX) >= SWIPE_TRIGGER_PX && Math.abs(deltaX) > Math.abs(deltaY);
		if (!isHorizontalSwipe) {
			return false;
		}

		if (deltaX < 0) {
			showNextImage();
			return true;
		}

		showPreviousImage();
		return true;
	};

	const handlePointerDown = (event) => {
		if (event.pointerType === "mouse" && event.button !== 0) {
			return;
		}

		const startedOnArrowButton = event.target instanceof Element && event.target.closest(".carousel-button");
		if (startedOnArrowButton) {
			return;
		}

		if (event.pointerType === "mouse") {
			event.preventDefault();
		}

		activePointerId = event.pointerId;
		swipeStartX = event.clientX;
		swipeStartY = event.clientY;
		swipeHandled = false;
		if (typeof carouselViewport.setPointerCapture === "function") {
			carouselViewport.setPointerCapture(event.pointerId);
		}
	};

	const handlePointerMove = (event) => {
		if (activePointerId === null || event.pointerId !== activePointerId || swipeHandled) {
			return;
		}

		const deltaX = event.clientX - swipeStartX;
		const deltaY = event.clientY - swipeStartY;
		if (!handleSwipeDelta(deltaX, deltaY)) {
			return;
		}

		swipeHandled = true;
	};

	const resetSwipeState = (event) => {
		if (activePointerId === null) {
			return;
		}

		if (event && event.pointerId !== activePointerId) {
			return;
		}

		if (event && typeof carouselViewport.releasePointerCapture === "function") {
			try {
				carouselViewport.releasePointerCapture(activePointerId);
			} catch {
			}
		}

		activePointerId = null;
		swipeHandled = false;
	};

	const handleTouchStart = (event) => {
		if (!event.touches || event.touches.length === 0) {
			return;
		}

		touchStartX = event.touches[0].clientX;
		touchStartY = event.touches[0].clientY;
		touchSwipeHandled = false;
	};

	const handleTouchMove = (event) => {
		if (touchSwipeHandled || !event.touches || event.touches.length === 0) {
			return;
		}

		const deltaX = event.touches[0].clientX - touchStartX;
		const deltaY = event.touches[0].clientY - touchStartY;
		if (!handleSwipeDelta(deltaX, deltaY)) {
			return;
		}

		touchSwipeHandled = true;
		event.preventDefault();
	};

	const resetTouchSwipeState = () => {
		touchSwipeHandled = false;
	};

	previousButton.addEventListener("click", showPreviousImage);
	nextButton.addEventListener("click", showNextImage);
	carouselViewport.addEventListener("pointerdown", handlePointerDown);
	carouselViewport.addEventListener("pointermove", handlePointerMove);
	carouselViewport.addEventListener("pointerup", resetSwipeState);
	carouselViewport.addEventListener("pointercancel", resetSwipeState);
	carouselViewport.addEventListener("pointerleave", resetSwipeState);
	carouselViewport.addEventListener("touchstart", handleTouchStart, { passive: true });
	carouselViewport.addEventListener("touchmove", handleTouchMove, { passive: false });
	carouselViewport.addEventListener("touchend", resetTouchSwipeState);
	carouselViewport.addEventListener("touchcancel", resetTouchSwipeState);

	setImageForIndex(currentIndex);
	scheduleAutoAdvance();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeHomeCarousel);
} else {
	initializeHomeCarousel();
}

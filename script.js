const LOREM_PARAGRAPHS = [
	"Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.",
	"Curabitur sodales ligula in libero. Sed dignissim lacinia nunc. Curabitur tortor. Pellentesque nibh. Aenean quam.",
	"Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Class aptent taciti sociosqu ad litora.",
	"Nam nec ante. Sed lacinia, urna non tincidunt mattis, tortor neque adipiscing diam, a cursus ipsum ante quis turpis.",
	"Morbi lectus risus, iaculis vel, suscipit quis, luctus non, massa. Fusce ac turpis quis ligula lacinia aliquet.",
];

function getRandomParagraph(paragraphs) {
	if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
		return "";
	}

	const randomIndex = Math.floor(Math.random() * paragraphs.length);
	return paragraphs[randomIndex];
}

function removeLegacyFoldables() {
	const foldables = Array.from(document.querySelectorAll("details"));

	foldables.forEach((foldable) => {
		const summary = foldable.querySelector(":scope > summary");
		if (!summary) {
			return;
		}

		const summaryText = summary.textContent.trim().toLowerCase();
		const isLegacySection = summaryText === "base content" || summaryText === "generated paragraphs";
		if (!isLegacySection) {
			return;
		}

		const parent = foldable.parentElement;
		if (!parent) {
			return;
		}

		const childrenToKeep = Array.from(foldable.children).filter((child) => child !== summary);
		childrenToKeep.forEach((child) => {
			parent.insertBefore(child, foldable);
		});

		foldable.remove();
	});
}

function addRandomLoremParagraph() {
	const main = document.querySelector("main");
	if (!main) {
		return;
	}

	const randomParagraph = getRandomParagraph(LOREM_PARAGRAPHS);
	if (!randomParagraph) {
		return;
	}

	const paragraphElement = document.createElement("p");
	paragraphElement.textContent = randomParagraph;
	paragraphElement.className = "random-lorem";

	main.append(paragraphElement);
}

function initializeParagraphControls() {
	removeLegacyFoldables();

	const addButton = document.querySelector("#add-paragraph-button");
	if (!addButton) {
		return;
	}

	addButton.addEventListener("click", addRandomLoremParagraph);
}

document.addEventListener("DOMContentLoaded", initializeParagraphControls);

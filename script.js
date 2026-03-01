const LOREM_PARAGRAPHS = [
	"Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet.",
	"Curabitur sodales ligula in libero. Sed dignissim lacinia nunc. Curabitur tortor. Pellentesque nibh. Aenean quam.",
	"Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla. Class aptent taciti sociosqu ad litora.",
	"Nam nec ante. Sed lacinia, urna non tincidunt mattis, tortor neque adipiscing diam, a cursus ipsum ante quis turpis.",
	"Morbi lectus risus, iaculis vel, suscipit quis, luctus non, massa. Fusce ac turpis quis ligula lacinia aliquet.",
	"Suspendisse potenti. Curabitur at lacus ac velit ornare lobortis. Curabitur a felis in nunc fringilla tristique.",
	"Praesent congue erat at massa. Sed cursus turpis vitae tortor. Donec posuere vulputate arcu non facilisis.",
	"Phasellus accumsan cursus velit. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.",
	"In ac dui quis mi consectetuer lacinia. Nam pretium turpis et arcu. Duis arcu tortor, suscipit eget, imperdiet nec, imperdiet iaculis.",
	"Aenean ut eros et nisl sagittis vestibulum. Nullam nulla eros, ultricies sit amet, nonummy id, imperdiet feugiat.",
	"Etiam ultricies nisi vel augue. Curabitur ullamcorper ultricies nisi. Nam eget dui etiam rhoncus.",
	"Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero, sit amet adipiscing sem neque sed ipsum.",
	"Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim.",
	"Donec pede justo, fringilla vel, aliquet nec, vulputate eget, arcu. In enim justo, rhoncus ut, imperdiet a.",
	"Nullam dictum felis eu pede mollis pretium. Integer tincidunt. Cras dapibus vivamus elementum semper nisi.",
	"Aenean vulputate eleifend tellus. Aenean leo ligula, porttitor eu, consequat vitae, eleifend ac, enim.",
	"Aliquam lorem ante, dapibus in, viverra quis, feugiat a, tellus. Phasellus viverra nulla ut metus varius laoreet.",
	"Quisque rutrum. Aenean imperdiet. Etiam ultricies nisi vel augue, curabitur ullamcorper ultricies nisi.",
	"Nunc nonummy metus. Vestibulum volutpat pretium libero. Cras id dui aenean ut eros et nisl sagittis.",
	"Ut a nisl id ante tempus hendrerit. Curabitur ligula sapien, tincidunt non, euismod vitae, posuere imperdiet.",
	"Maecenas malesuada. Praesent congue erat at massa. Sed cursus turpis vitae tortor donec posuere vulputate.",
	"Proin sapien ipsum, porta a, auctor quis, euismod ut, mi. Aenean viverra rhoncus pede.",
	"Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.",
	"Vivamus elementum semper nisi. Aenean vulputate eleifend tellus. Aenean leo ligula, porttitor eu, consequat vitae.",
	"Sed fringilla mauris sit amet nibh. Donec sodales sagittis magna. Sed consequat, leo eget bibendum sodales.",
	"Donec elit libero, sodales nec, volutpat a, suscipit non, turpis. Nullam sagittis. Suspendisse pulvinar.",
	"Vestibulum suscipit nulla quis orci. Nam commodo suscipit quam. Sed a libero pellentesque.",
	"Integer ante arcu, accumsan a, consectetuer eget, posuere ut, mauris. Praesent adipiscing.",
	"Praesent blandit laoreet nibh. Fusce convallis metus id felis luctus adipiscing pellentesque posuere.",
	"Etiam iaculis nunc ac metus. Ut id nisl quis enim dignissim sagittis. Etiam sollicitudin, ipsum eu pulvinar rutrum.",
	"Vestibulum eu odio. Phasellus nec sem in justo pellentesque facilisis. Etiam imperdiet imperdiet orci.",
	"Nunc nec neque. Phasellus leo dolor, tempus non, auctor et, hendrerit quis, nisi.",
	"Curabitur ligula sapien, tincidunt non, euismod vitae, posuere imperdiet, leo. Maecenas malesuada.",
	"Fusce fermentum odio nec arcu. Sed aliquam ultrices mauris. Integer ante arcu, accumsan a.",
	"In consectetuer turpis ut velit. Nulla sit amet est. Aenean posuere, tortor sed cursus feugiat.",
	"Curabitur turpis. Vestibulum facilisis, purus nec pulvinar iaculis, ligula mi congue nunc, vitae euismod ligula urna in dolor.",
	"Mauris sollicitudin fermentum libero. Praesent nonummy mi in odio. Nunc interdum lacus sit amet orci.",
	"Donec vitae sapien ut libero venenatis faucibus. Nullam quis ante. Etiam sit amet orci eget eros faucibus tincidunt.",
	"Duis leo. Sed fringilla mauris sit amet nibh. Donec sodales sagittis magna sed consequat leo.",
	"Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.",
	"In dui magna, posuere eget, vestibulum et, tempor auctor, justo. In ac felis quis tortor malesuada pretium.",
	"Pellentesque auctor neque nec urna. Proin sapien ipsum, porta a, auctor quis, euismod ut, mi.",
	"Ut varius tincidunt libero. Phasellus dolor. Maecenas vestibulum mollis diam pellentesque ut neque.",
	"Phasellus ullamcorper ipsum rutrum nunc. Nunc nonummy metus vestibulum volutpat pretium libero.",
	"Vestibulum rutrum, mi nec elementum vehicula, eros quam gravida nisl, id fringilla neque ante vel mi.",
	"Nunc egestas, augue at pellentesque laoreet, felis eros vehicula leo, at malesuada velit leo quis pede.",
	"Morbi ac felis. Nunc egestas, augue at pellentesque laoreet, felis eros vehicula leo.",
	"Fusce vulputate eleifend sapien. Vestibulum purus quam, scelerisque ut, mollis sed, nonummy id, metus.",
	"Nullam accumsan lorem in dui. Cras ultricies mi eu turpis hendrerit fringilla vestibulum ante.",
	"Morbi vestibulum volutpat enim. Aliquam eu nunc. Nunc sed turpis sed purus porta iaculis.",
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
		const firstChild = foldable.firstElementChild;
		const summary = firstChild && firstChild.tagName.toLowerCase() === "summary" ? firstChild : null;
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

function removeRandomLoremParagraph() {
	const allParagraphs = Array.from(document.querySelectorAll("main p"));
	if (allParagraphs.length === 0) {
		return;
	}

	const randomIndex = Math.floor(Math.random() * allParagraphs.length);
	allParagraphs[randomIndex].remove();
}

function initializeParagraphControls() {
	try {
		removeLegacyFoldables();
	} catch {
	}

	for (let index = 0; index < 3; index += 1) {
		addRandomLoremParagraph();
	}

	const addButton = document.querySelector("#add-paragraph-button");
	if (addButton) {
		addButton.addEventListener("click", addRandomLoremParagraph);
	}

	const removeButton = document.querySelector("#remove-paragraph-button");
	if (removeButton) {
		removeButton.addEventListener("click", removeRandomLoremParagraph);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initializeParagraphControls);
} else {
	initializeParagraphControls();
}

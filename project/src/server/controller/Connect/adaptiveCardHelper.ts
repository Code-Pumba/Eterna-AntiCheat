export interface AdaptiveCard {
	$schema: string;
	type: 'AdaptiveCard';
	version: string;
	body: CardElement[];
}

export type CardElement = TextBlock | Container | ColumnSet | ProgressBar;

export interface TextBlock {
	type: 'TextBlock';
	text: string;
	weight?: 'Bolder' | 'Lighter';
	size?: 'Small' | 'Medium' | 'Large' | 'ExtraLarge';
	wrap?: boolean;
	isSubtle?: boolean;
	horizontalAlignment?: 'Left' | 'Center' | 'Right';
	color?: 'Default' | 'Attention' | 'Good' | 'Warning' | 'Accent';
}

export interface Container {
	type: 'Container';
	items: CardElement[];
	style?: 'default' | 'emphasis';
	bleed?: boolean;
	spacing?: 'None' | 'Small' | 'Medium' | 'Large' | 'ExtraLarge' | 'Padding';
}

export interface ColumnSet {
	type: 'ColumnSet';
	columns: Column[];
}

export interface Column {
	type: 'Column';
	width: 'auto' | 'stretch' | number;
	items: CardElement[];
}

export interface ProgressBar {
	type: 'ProgressBar';
}

export function getAdaptiveCard(): AdaptiveCard {
	return JSON.parse(LoadResourceFile(GetCurrentResourceName(), 'static/card.json')) as AdaptiveCard;
}

export function replacePlaceholders(card: AdaptiveCard, values: Record<string, string>): AdaptiveCard {
	function replaceInElement(element: CardElement): CardElement {
		if (element.type === 'TextBlock') {
			let updatedText = element.text;
			for (const [key, value] of Object.entries(values)) {
				const placeholder = `##${key}##`;
				updatedText = updatedText.replaceAll(placeholder, value);
			}
			return { ...element, text: updatedText };
		}

		// Container
		if (element.type === 'Container') {
			return {
				...element,
				items: element.items.map(replaceInElement),
			};
		}

		// ColumnSet
		if (element.type === 'ColumnSet') {
			return {
				...element,
				columns: element.columns.map((col) => ({
					...col,
					items: col.items.map(replaceInElement),
				})),
			};
		}

		// ProgressBar (No change required)
		return element;
	}

	// return card (immutable)
	return {
		...card,
		body: card.body.map(replaceInElement),
	};
}

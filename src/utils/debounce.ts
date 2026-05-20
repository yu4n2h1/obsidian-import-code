// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
	fn: T,
	delay: number
): T {
	let timeoutId: number | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ((...args: any[]) => {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
		timeoutId = window.setTimeout(() => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			fn(...args);
			timeoutId = null;
		}, delay);
	}) as T;
}

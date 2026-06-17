/**
 * 移除并重建设置页中的某个 section。
 *
 * 供 remote-sources-tab / upload-sources-tab / extensions-tab 共享，
 * 统一「querySelector(sectionClass) → remove → rebuild」的 DOM 重建逻辑，
 * 避免每个设置页各自内联同样的三元组。
 */
export function rebuildSettingsSection(
	containerEl: HTMLElement,
	sectionClass: string,
	rebuild: (containerEl: HTMLElement) => void
): void {
	const old = containerEl.querySelector(`.${sectionClass}`);
	if (!old) return;
	old.remove();
	rebuild(containerEl);
}

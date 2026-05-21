import { Setting } from "obsidian";
import { RemoteServiceType } from "../types";
import { SERVICE_LABELS } from "../utils/constants";

export interface RemoteConfigState {
	url: string;
	token: string;
	username?: string;
	repo?: string;
	branch?: string;
	path?: string;
}

function placeholderUrl(svc: RemoteServiceType): string {
	switch (svc) {
		case "webdav": return "https://webdav.example.com";
		case "gitlab": return "https://gitlab.com";
		case "gitea": return "https://gitea.com";
		case "github": return "https://api.github.com";
		case "generic": return "https://example.com";
		case "local": return "/Users/me/projects";
	}
}

export function buildRemoteConfigFields(
	container: HTMLElement,
	serviceType: RemoteServiceType,
	state: RemoteConfigState,
	onChange: (key: keyof RemoteConfigState, value: string) => void
): void {
	const label = SERVICE_LABELS[serviceType];
	const isLocal = serviceType === "local";

	new Setting(container)
		.setName(isLocal ? `${label} Base Directory` : `${label} URL`)
		.addText((text) => {
			text.setPlaceholder(placeholderUrl(serviceType));
			text.setValue(state.url);
			text.onChange((value) => onChange("url", value.trim()));
		});

	if (!isLocal) {
		new Setting(container)
			.setName(`${label} Token`)
			.addText((text) => {
				text.setPlaceholder("Access token");
				text.inputEl.type = "password";
				text.setValue(state.token);
				text.onChange((value) => onChange("token", value.trim()));
			});
	}

	if (serviceType === "webdav") {
		new Setting(container)
			.setName(`${label} Username`)
			.addText((text) => {
				text.setPlaceholder("WebDAV username (optional)");
				text.setValue(state.username || "");
				text.onChange((value) => onChange("username", value.trim()));
			});
	}

	if (serviceType === "github" || serviceType === "gitlab" || serviceType === "gitea") {
		new Setting(container)
			.setName(`${label} Repository`)
			.addText((text) => {
				text.setPlaceholder("owner/repo");
				text.setValue(state.repo || "");
				text.onChange((value) => onChange("repo", value.trim()));
			});

		new Setting(container)
			.setName(`${label} Branch`)
			.addText((text) => {
				text.setPlaceholder("main");
				text.setValue(state.branch || "main");
				text.onChange((value) => onChange("branch", value.trim() || "main"));
			});
	}

	new Setting(container)
		.setName(`${label} Path`)
		.addText((text) => {
			text.setPlaceholder("code-snippets");
			text.setValue(state.path || "");
			text.onChange((value) => onChange("path", value.trim()));
		});
}

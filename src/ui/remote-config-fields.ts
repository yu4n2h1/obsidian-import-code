import { Setting } from "obsidian";
import { RemoteServiceType } from "../types";
import { SERVICE_LABELS } from "../utils/constants";

export interface RemoteConfigState {
	url: string;
	token: string;
	username?: string;
	repo?: string;
	branch?: string;
	uploadPath?: string;
}

function placeholderUrl(svc: RemoteServiceType): string {
	switch (svc) {
		case "webdav": return "https://webdav.example.com";
		case "gitlab": return "https://gitlab.com";
		case "gitea": return "https://gitea.com";
		case "github": return "https://api.github.com";
	}
}

export function buildRemoteConfigFields(
	container: HTMLElement,
	serviceType: RemoteServiceType,
	state: RemoteConfigState,
	onChange: (key: keyof RemoteConfigState, value: string) => void
): void {
	const label = SERVICE_LABELS[serviceType];

	new Setting(container)
		.setName(`${label} URL`)
		.addText((text) => {
			text.setPlaceholder(placeholderUrl(serviceType));
			text.setValue(state.url);
			text.onChange((value) => onChange("url", value.trim()));
		});

	new Setting(container)
		.setName(`${label} Token`)
		.addText((text) => {
			text.setPlaceholder("访问令牌");
			text.inputEl.type = "password";
			text.setValue(state.token);
			text.onChange((value) => onChange("token", value.trim()));
		});

	if (serviceType === "webdav") {
		new Setting(container)
			.setName(`${label} 用户名`)
			.addText((text) => {
				text.setPlaceholder("WebDAV 用户名（可选）");
				text.setValue(state.username || "");
				text.onChange((value) => onChange("username", value.trim()));
			});
	}

	if (serviceType === "github" || serviceType === "gitlab" || serviceType === "gitea") {
		new Setting(container)
			.setName(`${label} 仓库`)
			.addText((text) => {
				text.setPlaceholder("owner/repo");
				text.setValue(state.repo || "");
				text.onChange((value) => onChange("repo", value.trim()));
			});

		new Setting(container)
			.setName(`${label} 分支`)
			.addText((text) => {
				text.setPlaceholder("main");
				text.setValue(state.branch || "main");
				text.onChange((value) => onChange("branch", value.trim() || "main"));
			});
	}

	new Setting(container)
		.setName(`${label} 上传路径`)
		.addText((text) => {
			text.setPlaceholder("code-snippets");
			text.setValue(state.uploadPath || "");
			text.onChange((value) => onChange("uploadPath", value.trim()));
		});
}

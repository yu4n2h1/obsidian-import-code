import type { RemoteServiceType } from "../types";

export const SERVICE_LABELS: Record<RemoteServiceType, string> = {
	webdav: "WebDAV",
	github: "GitHub",
	gitlab: "GitLab",
	gitea: "Gitea",
};

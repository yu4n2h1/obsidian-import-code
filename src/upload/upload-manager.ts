import { RemoteServiceConfig, RemoteServiceType } from "../types";
import { UploadOptions, UploadResult } from "./types";
import { webdavUploader } from "./webdav-uploader";
import { githubUploader } from "./github-uploader";
import { gitlabUploader } from "./gitlab-uploader";
import { giteaUploader } from "./gitea-uploader";

const uploaders = {
	webdav: webdavUploader,
	github: githubUploader,
	gitlab: gitlabUploader,
	gitea: giteaUploader,
};

export function uploadToRemote(
	serviceType: RemoteServiceType,
	content: string,
	fileName: string,
	config: RemoteServiceConfig,
	skipSslVerify: boolean = false
): Promise<UploadResult> {
	const uploader = uploaders[serviceType];
	if (!uploader) {
		return Promise.resolve({
			success: false,
			error: `不支持的服务类型: ${serviceType}`,
		});
	}
	const options: UploadOptions = {
		content,
		fileName,
		config,
		skipSslVerify,
	};
	return uploader.upload(options);
}

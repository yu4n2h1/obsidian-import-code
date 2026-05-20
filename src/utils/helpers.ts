// 统一工具函数导出 — 从 parse-embed-source 和 settings-helpers 集中导出
export {
	isRemoteUrl,
	isPartialIpv6Url,
	tryRestoreIpv6Url,
	parseEmbedSource,
	parseLineRange,
} from "./parse-embed-source";

export { isExtensionSupported } from "./settings-helpers";

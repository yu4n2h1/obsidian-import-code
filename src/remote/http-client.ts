// 重新导出 https 模块的所有函数，作为 remote/ 的统一 HTTP 客户端入口
export {
	dispatchHttpRequest,
	httpsRequest,
	getHttps,
} from "../utils/https-module";
export type { HttpsRequestOptions, HttpsRequestResponse } from "../utils/https-module";

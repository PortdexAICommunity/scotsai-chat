import { LanguageModelV1 } from "@ai-sdk/provider";
import { OpenAICompatibleChatLanguageModel } from "@ai-sdk/openai-compatible";
import {
	FetchFunction,
	loadApiKey,
	withoutTrailingSlash,
} from "@ai-sdk/provider-utils";
import {
	PortdexChatModelId,
	PortdexChatSettings,
} from "./portdex-chat-setting";

export interface PortdexProviderSettings {
	/**
	 * Portdex API key.
	 */
	apiKey?: string;
	/**
	 * Base URL for the API calls.
	 */
	baseURL?: string;
	/**
	 * Custom headers to include in the requests.
	 */
	headers?: Record<string, string>;
	/**
	 * Optional custom url query parameters to include in request urls.
	 */
	queryParams?: Record<string, string>;
	/**
	 * Custom fetch implementation. You can use it as a middleware to intercept requests,
	 * or to provide a custom fetch implementation for e.g. testing.
	 */
	fetch?: FetchFunction;
}

export interface PortdexProvider {
	/**
	 * Creates a language model for text generation.
	 */
	(
		modelId: PortdexChatModelId,
		settings?: PortdexChatSettings
	): LanguageModelV1;

	/**
	 * Creates a chat model for text generation.
	 */
	languageModel(
		modelId: PortdexChatModelId,
		settings?: PortdexChatSettings
	): LanguageModelV1;
}

export function createPortdex(
	options: PortdexProviderSettings = {}
): PortdexProvider {
	const baseURL = withoutTrailingSlash(
		options.baseURL ?? "https://api.portdex.ai"
	);
	const getHeaders = () => ({
		Authorization: `Bearer ${loadApiKey({
			apiKey: options.apiKey,
			environmentVariableName: "PORTDEX_API_KEY",
			description: "Portdex API key",
		})}`,
		...options.headers,
	});

	interface CommonModelConfig {
		provider: string;
		url: ({ path }: { path: string }) => string;
		headers: () => Record<string, string>;
		fetch?: FetchFunction;
	}

	const getCommonModelConfig = (modelType: string): CommonModelConfig => ({
		provider: `portdex.${modelType}`,
		url: ({ path }) => {
			const url = new URL(`${baseURL}${path}`);
			if (options.queryParams) {
				url.search = new URLSearchParams(options.queryParams).toString();
			}
			return url.toString();
		},
		headers: getHeaders,
		fetch: options.fetch,
	});

	const createChatModel = (
		modelId: PortdexChatModelId,
		settings: PortdexChatSettings = {}
	) => {
		return new OpenAICompatibleChatLanguageModel(modelId, settings, {
			...getCommonModelConfig("chat"),
			defaultObjectGenerationMode: "tool",
		});
	};

	const provider = (
		modelId: PortdexChatModelId,
		settings?: PortdexChatSettings
	) => createChatModel(modelId, settings);

	provider.languageModel = createChatModel;

	return provider;
}

// Export default instance
export const portdex = createPortdex();

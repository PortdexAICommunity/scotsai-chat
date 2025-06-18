import { OpenAICompatibleChatSettings } from "@ai-sdk/openai-compatible";

export type PortdexChatModelId =
	| "thinker"
	| "maker"
	| "chatter"
	| (string & {});

export interface PortdexChatSettings extends OpenAICompatibleChatSettings {
	// Add any Portdex-specific settings here
}

export const DEFAULT_CHAT_MODEL: string = "chat-model";

export interface ChatModel {
	id: string;
	name: string;
	description: string;
}

export const chatModels: Array<ChatModel> = [
	{
		id: "chat-model",
		name: "Legal Search Model",
		description: "Primary model for all-purpose chat",
	},
	{
		id: "chat-model-reasoning",
		name: "Search and Automate Documents",
		description: "Create and automate documents",
	},
	{
		id: "chat-model-search",
		name: "Realtime Legal",
		description: "Provide Realtime data",
	},
	{
		id: "chat-model-news",
		name: "Legal News Search",
		description: "Provide Legal News",
	},
	{
		id: "chat-model-find",
		name: "Find Legal Help",
		description: "Find Legal Help like Lawyers, Solicitors, and more",
	},
];

import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import {
	artifactModel,
	chatModel,
	reasoningModel,
	titleModel,
} from "./models.test";
import { portdex } from "./portdex";
import { qwen } from "qwen-ai-provider";

export const myProvider = isTestEnvironment
	? customProvider({
			languageModels: {
				"chat-model": chatModel,
				"chat-model-reasoning": reasoningModel,
				"title-model": titleModel,
				"artifact-model": artifactModel,
			},
	  })
	: customProvider({
			languageModels: {
				"chat-model": qwen("qwen-turbo-latest"),
				"chat-model-search": portdex("chatter"),
				"chat-model-reasoning": portdex("chatter"),
				"title-model": qwen("qwen-plus"),
				"artifact-model": qwen("qwen-max-latest"),
				"chat-model-news": portdex("chatter"),
				"chat-model-find": portdex("chatter"),
			},
			// imageModels: {
			//   'small-model': qwen.imageModel("qwen-plus"),
			// },
	  });

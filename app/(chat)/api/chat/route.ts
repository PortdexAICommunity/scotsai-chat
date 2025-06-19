import {
	appendResponseMessages,
	createDataStream,
	experimental_createMCPClient,
	smoothStream,
	streamText,
} from "ai";
import { auth, type UserType } from "@/app/(auth)/auth";
import {
	createStreamId,
	deleteChatById,
	ensureUserExists,
	getChatById,
	getMessageCountByUserId,
	getMessagesByChatId,
	saveChat,
	saveMessages,
} from "@/lib/db/queries";
import { generateUUID, getTrailingMessageId } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { myProvider } from "@/lib/ai/providers";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { postRequestBodySchema } from "./schema";
import type { ResumableStreamContext } from "resumable-stream";
import { ChatSDKError } from "@/lib/errors";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
	FALLBACK_PROMPT,
	LEGAL_FIND_PROMPT,
	LEGAL_NEWS_PROMPT,
	LEGAL_SEARCH_PROMPT,
} from "@/lib/ai/prompts";

export const maxDuration = 60;

const globalStreamContext: ResumableStreamContext | null = null;

function getStreamContext() {
	// Temporarily disable resumable streams to avoid Redis errors
	return null;

	// Original implementation:
	/*
	if (!globalStreamContext) {
		try {
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
		} catch (error: any) {
			if (error.message.includes("REDIS_URL")) {
				console.log(
					" > Resumable streams are disabled due to missing REDIS_URL"
				);
			} else {
				console.error(error);
			}
		}

	return globalStreamContext;
	*/
}

export async function POST(request: Request) {
	const { readable, writable } = new TransformStream();
	const writer = writable.getWriter();

	const response = new Response(readable, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});

	// Run everything else in background
	(async () => {
		let customClient;
		const startTime = Date.now();

		try {
			// Quick validation upfront
			let requestBody;
			try {
				const json = await request.json();
				requestBody = postRequestBodySchema.parse(json);
			} catch (_) {
				writer.write(
					`data: ${JSON.stringify({ error: "Invalid request" })}\n\n`
				);
				await writer.close();
				return;
			}

			const session = await auth();
			if (!session?.user) {
				writer.write(`data: ${JSON.stringify({ error: "Unauthorized" })}\n\n`);
				await writer.close();
				return;
			}

			const { id, message, selectedChatModel, selectedVisibilityType } =
				requestBody;
			const userType: UserType = session.user.type;

			// Initialize transport and client only when needed
			let toolSetPromise = Promise.resolve({});

			if (
				selectedChatModel === "chat-model-search" ||
				selectedChatModel === "chat-model-find" ||
				selectedChatModel === "chat-model-news"
			) {
				let mcpUrl: string;
				if (selectedChatModel === "chat-model-search") {
					mcpUrl = `https://server.smithery.ai/exa/mcp?api_key=${process.env.MCP_API_KEY}`;
				} else {
					mcpUrl = `https://server.smithery.ai/@nickclyde/duckduckgo-mcp-server/mcp?api_key=${process.env.MCP_API_KEY}`;
				}

				const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
				customClient = await experimental_createMCPClient({ transport });
				toolSetPromise = customClient.tools();
			}

			// Run critical checks in parallel
			const [messageCount, chat] = await Promise.all([
				getMessageCountByUserId({
					id: session.user.id,
					differenceInHours: 24,
				}).catch((error) => {
					console.error("Failed to get message count:", error);
					return 0;
				}),
				getChatById({ id }).catch((error) => {
					console.error("Failed to get chat:", error);
					return null;
				}),
			]);

			if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
				writer.write(
					`data: ${JSON.stringify({ error: "Rate limit exceeded" })}\n\n`
				);
				await writer.close();
				return;
			}

			if (chat?.userId && chat.userId !== session.user.id) {
				writer.write(`data: ${JSON.stringify({ error: "Forbidden" })}\n\n`);
				await writer.close();
				return;
			}

			// Start AI response immediately, handle database operations in background
			const saveOperationsPromise = (async () => {
				try {
					// Ensure user exists in database first
					await ensureUserExists(
						session.user.id,
						session.user.email || undefined
					);

					if (!chat) {
						// Create chat first, then save message
						const title = await generateTitleFromUserMessage({ message });
						await saveChat({
							id,
							userId: session.user.id,
							title,
							visibility: selectedVisibilityType,
						});
					}

					// Save user message
					await saveMessages({
						messages: [
							{
								chatId: id,
								id: message.id,
								role: "user",
								parts: message.parts,
								attachments: message.experimental_attachments ?? [],
								createdAt: new Date(),
							},
						],
					});

					// Create stream ID after chat and message are saved
					await createStreamId({
						streamId: generateUUID(),
						chatId: id,
					});
				} catch (error) {
					console.error("Background database operations failed:", error);
				}
			})();

			// Start model response streaming quickly
			const needsTools =
				selectedChatModel === "chat-model-search" ||
				selectedChatModel === "chat-model-find" ||
				selectedChatModel === "chat-model-news";

			const result = streamText({
				model: myProvider.languageModel(selectedChatModel),
				tools: needsTools ? { ...(await toolSetPromise) } : {},
				toolChoice: needsTools ? "auto" : "none",
				system:
					selectedChatModel === "chat-model-search"
						? LEGAL_SEARCH_PROMPT
						: selectedChatModel === "chat-model-find"
						? LEGAL_FIND_PROMPT
						: selectedChatModel === "chat-model-news"
						? LEGAL_NEWS_PROMPT
						: FALLBACK_PROMPT,
				messages: [message],
				maxSteps: 3,
				temperature: 0.7,
				experimental_transform: smoothStream({
					chunking: "word",
				}),
				experimental_generateMessageId: generateUUID,
				toolCallStreaming: false,
				// onChunk: ({ chunk }) => {
				// 	// Debug: Log all chunk types to see what's coming through
				// 	console.log("Stream chunk type:", chunk.type);
				// 	// Log tool-related chunks including tool-result
				// 	if (
				// 		chunk.type === "tool-call-streaming-start" ||
				// 		chunk.type === "tool-call-delta" ||
				// 		(chunk as any).type === "tool-result"
				// 	) {
				// 		console.log("Tool chunk:", JSON.stringify(chunk, null, 2));
				// 	}
				// },
				onFinish: async ({ response }) => {
					if (!session?.user?.id) return;

					const assistantMessages = response.messages.filter(
						(msg) => msg.role === "assistant"
					);
					const assistantId = getTrailingMessageId({
						messages: assistantMessages,
					});

					if (!assistantId) return;

					const [, assistantMessage] = appendResponseMessages({
						messages: [message],
						responseMessages: response.messages,
					});

					// Wait for background operations to complete before saving assistant message
					saveOperationsPromise.then(async () => {
						try {
							await saveMessages({
								messages: [
									{
										id: assistantId,
										chatId: id,
										role: assistantMessage.role,
										parts: assistantMessage.parts,
										attachments:
											assistantMessage.experimental_attachments ?? [],
										createdAt: new Date(),
									},
								],
							});
						} catch (error) {
							console.error("Failed to save assistant message:", error);
						}
					});
				},
			});

			// Don't wait for database operations to complete - let them run in background

			// Process the stream with error handling
			try {
				const reader = result.toDataStream().getReader();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					await writer.write(value);
				}
				console.log(`Request processed in ${Date.now() - startTime}ms`);
			} catch (streamError) {
				console.error("Stream error:", streamError);
				writer.write(
					`data: ${JSON.stringify({ error: "Stream processing error" })}\n\n`
				);
			}
		} catch (err) {
			const error = err as Error;
			console.error("Fatal error:", error);
			writer.write(
				`data: ${JSON.stringify({
					error: "Internal server error",
					details: error?.message || "Unknown error",
				})}\n\n`
			);
		} finally {
			try {
				if (customClient) {
					await customClient.close();
				}
			} catch (err) {
				console.error("Error closing client:", err);
			}
			await writer.close();
		}
	})();

	return response;
}

export async function GET(request: Request) {
	const streamContext = getStreamContext();
	const resumeRequestedAt = new Date();

	// Create an empty data stream since we don't have the resumable context
	const emptyDataStream = createDataStream({
		execute: () => {},
	});

	const { searchParams } = new URL(request.url);
	const chatId = searchParams.get("chatId");

	if (!chatId) {
		return new ChatSDKError("bad_request:api").toResponse();
	}

	const session = await auth();

	if (!session?.user) {
		return new ChatSDKError("unauthorized:chat").toResponse();
	}

	try {
		// Check if chat exists and user has access
		const chat = await getChatById({ id: chatId });

		if (!chat) {
			return new ChatSDKError("not_found:chat").toResponse();
		}

		if (chat.visibility === "private" && chat.userId !== session.user.id) {
			return new ChatSDKError("forbidden:chat").toResponse();
		}

		// Get the messages
		const messages = await getMessagesByChatId({ id: chatId });
		const mostRecentMessage = messages.at(-1);

		if (mostRecentMessage && mostRecentMessage.role === "assistant") {
			const restoredStream = createDataStream({
				execute: (buffer) => {
					buffer.writeData({
						type: "append-message",
						message: JSON.stringify(mostRecentMessage),
					});
				},
			});
			return new Response(restoredStream, { status: 200 });
		}

		return new Response(emptyDataStream, { status: 200 });
	} catch (error) {
		console.error("Error retrieving messages:", error);
		return new Response(emptyDataStream, { status: 200 });
	}
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");

	if (!id) {
		return new ChatSDKError("bad_request:api").toResponse();
	}

	const session = await auth();

	if (!session?.user) {
		return new ChatSDKError("unauthorized:chat").toResponse();
	}

	const chat = await getChatById({ id });

	if (chat.userId !== session.user.id) {
		return new ChatSDKError("forbidden:chat").toResponse();
	}

	const deletedChat = await deleteChatById({ id });

	return Response.json(deletedChat, { status: 200 });
}

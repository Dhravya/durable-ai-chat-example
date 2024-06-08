import { DurableObject } from "cloudflare:workers";
import { events } from "fetch-event-stream";
import { Env } from "../worker-configuration";

type ChatHistory = {
	role: string;
	content: string;
};

export class AIChatHandler extends DurableObject<Env> {
	chatHistory: ChatHistory[] = [];

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.env = env;
		this.loadChatHistory();
	}

	async loadChatHistory() {
		const history = (await this.ctx.storage.get('chatHistory')) as ChatHistory[];
		if (history) {
			this.chatHistory = history;
		}
		console.log('[Durable Object] loaded chat history', this.chatHistory);
	}

	async currentHistory(): Promise<string> {
		return this.chatHistory.map((x) => `${x.role}: ${x.content}`).join('\n');
	}

	async fetch(request: Request) {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		this.ctx.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}

	async addToChatHistory(message: ChatHistory) {
		this.chatHistory.push(message);
		this.ctx.storage.put('chatHistory', this.chatHistory);
	}

	async getChatHistory() {
		return this.chatHistory;
	}

	async webSocketMessage(ws: WebSocket, message: string) {
		if (message.startsWith('(GET_HISTORY)')) {
			ws.send(JSON.stringify(await this.getChatHistory()));
			return;
		}

		await this.addToChatHistory({ role: 'user', content: message });

		ws.send('[LOADING]');

		const resp = (await this.env.AI.run('@cf/meta/llama-2-7b-chat-fp16', {
			messages: await this.getChatHistory(),
			stream: true,
		})) as ReadableStream<Uint8Array>;

		let responseStr = '';

		const chunks = events(new Response(resp));
		for await (const chunk of chunks) {
			if (chunk.data && chunk.data !== '[DONE]') {
				const data = JSON.parse(chunk.data);
				const responseText = data.response.replace('<|im_end|>', '');
				responseStr += responseText;
				ws.send(responseText);
			}
		}

		ws.send('[DONE]');

		await this.addToChatHistory({ role: 'assistant', content: responseStr });
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string) {
		this.ctx.storage.put('chatHistory', this.chatHistory);
		ws.close(code, 'Durable Object is closing WebSocket');
	}
}

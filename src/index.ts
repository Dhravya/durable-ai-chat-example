import { Hono } from 'hono';
import { Env } from '../worker-configuration';
import { AIChatHandler } from './chatHandler';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono<{ Bindings: Env }>();

app.get(
	'/websocket',
	zValidator(
		'query',
		z.object({
			threadID: z.string(),
		})
	),
	async (c) => {
		const { threadID } = c.req.valid('query');

		const upgradeHeader = c.req.raw.headers.get('Upgrade');
		if (!upgradeHeader || upgradeHeader !== 'websocket') {
			return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
		}

		const id = c.env.AI_CHAT_HANDLER.idFromName(threadID);
		const stub = c.env.AI_CHAT_HANDLER.get(id);

		return stub.fetch(c.req.raw);
	}
);

app.get('/list', async (c) => {
	const chats = await c.env.CHATBOT_KV.list();
	return c.json(chats.keys.map((key) => key.name));
});

export { AIChatHandler };
export default app;

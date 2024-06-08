## Cloudflare Durable Objects for AI chat demo

This is a demo of how to use Cloudflare Durable objects to build multi-user, multi-thread chat applications. 

### Why?

While building https://supermemory.ai (OSS at https://git.new/memory), we wanted to build a scalable, easy to implement, maintainable, secure and peformant chat UI, with multi threads support.
But, we realised that making a database call after every message was a bit too much, and not doing the DB call would mean that ther would be inconsistencies in the history if a user opened our app in two tabs at the same time.

Also, it would be a huge development effort for us to add the database stuff and the multi-threading to our existing codebase. A more scalable, easy to implement approach was needed, so we choose Durable objects. This way, we now no longer have to worry about DB and using multiple chat histories, getting chat histories and stuff like that. It's all handled by this 80 line codebase and works perfectly.

#### How do durable objects help?

By making use of the Durable objects' transactional storage and other features, there's no need to worry about:
- Data consistency
- Chat history and threads
- Back and forth large packets between the client and the server
- Handling of multiple users in the same room

#### How does it work?

We make use of the [Transactional storage API](https://developers.cloudflare.com/durable-objects/api/transactional-storage-api/) and [hibernating websockets](https://developers.cloudflare.com/durable-objects/api/websockets/) to store the chat history and the current user's state. 
The only request needed to the server is the chat thread ID and the prompt, and a websocket is opened to the server that streams the chat to the client.

There is a certain "Special" websocket events that were added to make it easier to handle and get the chat history on the client side - `(GET_HISTORY)` - When this event is sent to the server, the server will return the chat history for the current user in a list of messages.

The server also sends `[LOADING]` and `[DONE]` events to the client to indicate that the AI response has started to load, so that loading state can be shown to the user. 

The chathistory is consistent even if the websocket is closed and reopened because the server will store the chat history in the transactional storage and the client will get the chat history from the server when the websocket is opened again.

#### Costs

One more consideration for us while building this for supermemory was costs. We had to make sure that the costs are reasonable. Since we are using the Workers Paid plan, we already have 1 million invocations and 400,000 GB-s duration of execution. For the purpose of supermemory, this is a good option.
1. We don't want to do 100000 database calls a day, because that would also be expensive
2. We are already paying for workers paid plan, so we don't need to pay for more
3. we are able to give a better user experience by using websockets and sending smaller packets between the client and the server.
4. It's super easy for us to implement and maintain in our existing codebase because we're already on the workers developer platform.
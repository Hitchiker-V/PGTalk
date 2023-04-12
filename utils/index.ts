import { createClient } from "@supabase/supabase-js";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";
export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

let MESSAGE_SYS = `You are a mimic of Paul Graham that answers queries about his essay's in his style. Respond to the queries in 5-10 sentences. Do not compromise on mimicing his style.`
const MAX_TOKENS = 150;
const TEMP = 0.2 // Can be between 0 to 2 ; Lower the value, less randomness when passed the same prompt i.e more deterministic
export const SIMILARITY_THRESHOLD = 0.8;

// Creating a function that handles streaming and parsing from OpenAI
export const OpenAIStream = async (prompt: string) => {
    // hitting chat-completion endpoint of OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: 'system',
                    content: MESSAGE_SYS
                },
                {
                    role: 'user',
                    content: prompt
                }],
                max_tokens: MAX_TOKENS,
                temperature: TEMP,
                stream: true
            })
        });

    if (response.status !== 200) {
        throw new Error("Error");
    }

    // Data stream from OpenAI is in form of server-side events, encoded in utf-8
    // Hence we need a decoder and encoder to communicate with it 
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
        async start(controller) {
            // ReconnectInterval : An event emitted from the parser when the server sends a value in the retry field, 
            // indicating how many seconds the client should wait before attempting to reconnect.
            const onParse = (event: ParsedEvent | ReconnectInterval) => {
                if (event.type === 'event') {
                    const data = event.data;
                    // When all tokens streamed, API sends this
                    if (data == "[DONE]") {
                        controller.close();
                        return;
                    }
                    try {
                        // The response contains a similar structure
                        // {
                        //     "choices": [
                        //       {
                        //         "delta": {
                        //           "role": "assistant"
                        //         },
                        //         "finish_reason": null,
                        //         "index": 0
                        //       }
                        //     ],
                        //     "created": 1677825464,
                        //     "id": "chatcmpl-6ptKyqKOGXZT6iQnqiXAH8adNLUzD",
                        //     "model": "gpt-3.5-turbo-0301",
                        //     "object": "chat.completion.chunk"
                        //   }
                        //   {
                        //     "choices": [
                        //       {
                        //         "delta": {
                        //           "content": "\n\n"
                        //         },
                        //         "finish_reason": null,
                        //         "index": 0
                        //       }
                        //     ],
                        //     "created": 1677825464,
                        //     "id": "chatcmpl-6ptKyqKOGXZT6iQnqiXAH8adNLUzD",
                        //     "model": "gpt-3.5-turbo-0301",
                        //     "object": "chat.completion.chunk"
                        //   }
                        const json = JSON.parse(data);
                        const text = json.choices[0].delta.content || "";
                        // Cleaning the text for '\n\n'
                        // const counter = 0;
                        // if (counter < 2 && (text.match(/\n/) || []).length) {
                        //     // this is a prefix character (i.e., "\n\n"), do nothing
                        //     return;
                        // }

                        // initializing a queue-object to capture and process streamed data
                        const queue = encoder.encode(text);

                        // Putting the queue-object in controller processing queue
                        controller.enqueue(queue);
                    } catch (e) {
                        controller.error(e);
                    }
                }
            }

            // stream response (SSE) from OpenAI may be fragmented into multiple chunks
            // this ensures we properly read chunks and invoke an event for each SSE event stream

            const parser = createParser(onParse);
            // Looping over encoded chunks and feeding it to decoder 
            for await(const chunk of response.body as any){
                parser.feed(decoder.decode(chunk));
            }
        }
    });

    return stream;
}
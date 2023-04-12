import { PGChunk } from '@/types';
import Head from 'next/head'
import endent from 'endent';
import { useState } from 'react'
import { Answer } from '@/Components/Answer/Answer';

const guestName = "Paul Graham"
const guestDescription = "Legendary startup investor, founder, programmer and one of the most knowledgable personalities in the startup ecosystem"

export default function Home() {
  // Using states to handle data 
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [chunks, setChunks] = useState<PGChunk[]>([]);
  const [loading, setLoading] = useState(false);

  
  // writing the frontend handler function to handle search query logic
  const handleAnswer = async () => {
    setLoading(true);
    const searchResponse = await fetch("/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query })
    });

    if (!searchResponse.ok) {
      setLoading(false);
      // console.log('NO');
      return;
    }

    const results: PGChunk[] = await searchResponse.json();
    setChunks(results);

    // Framing the prompt to send to chat completion
    const prompt = endent`
    I want to ask you, a mimic of ${guestName}, the ${guestDescription}.
    Use the passages attached to this prompt to answer the query to the personality you are mimicing: ${query}

    ${results.map((chunk) => chunk.content).join("\n")}
    `;

    const answerResponse = await fetch("api/answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    if (!answerResponse.ok) {
      setLoading(false);
      console.log(answerResponse);
      return;
    }

    // Getting the data from the answer endpoint. It's a stream so we need to open a reader and a decoder as well
    const data = answerResponse.body;

    if (!data) {
      setLoading(false);
      return;
    }

    const reader = data.getReader();
    const decoder = new TextDecoder();

    // Creating a done flag to check end of streaming sequence
    let done = false;
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading
      const chunkValue = decoder.decode(value);
      // Let's set the answer state variable value to chunkvalue
      setAnswer((prev) => prev + chunkValue);
    }
    // Logging to check everything ok
    // console.log(results);
    console.log(answer);
    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Paul Graham GPT</title>
        <meta name="description" content="Getting anyone to brainstorm with you, on your commmand" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex flex-col h-screen">
        <input
          className='border border-gray-300 rounded-md p-2'
          type='text'
          placeholder='Ask Paul Graham anything'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          onClick={handleAnswer}
        >
          Submit
        </button>
        <div className='mt-4'>
          {loading ? <div>Loading...</div>:<div><Answer text={answer}></Answer></div>}
        </div>
      </div>
    </>
  )
}

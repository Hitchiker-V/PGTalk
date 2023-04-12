import { SIMILARITY_THRESHOLD, supabaseAdmin } from "@/utils";

export const config = {
  runtime: "edge" // Running on edge functions makes processing super fast 
};

// Constructing an API handler to send search query to OpenAI Embedding Model to generate
// Embedding Vector to be used for Similarity based search

const handler = async (req: Request): Promise<Response> => {
  try {    
    // Sending Query to Embedding model to create embedding
    const { query } = (await req.json()) as { query: string };
    
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: query
      })
    });

    // Awaiting response from API containing embeddings
    const json = await response.json();
    console.log(json);
    // Extract embedding from json
    const embedding = json.data[0].embedding;

    const { data: chunks, error } = await supabaseAdmin.rpc(
      "pg_embsim_search", {
      query_embeddings: embedding,
      similary_threshold: SIMILARITY_THRESHOLD,
      match_count: 5 // Returing 5 matches of chunks found in the db similar to query
    }
    );

    if (error) {
      // console.log(error);
      return new Response("Error 1", { status: 500 });
    }

    return new Response(JSON.stringify(chunks), { status: 200 });
  } catch (e) {
    console.log(e);
    return new Response("Error 2", { status: 500 });
  }
}

export default handler;
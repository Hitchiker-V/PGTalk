// Generate Embedding and save to Supabase
import { loadEnvConfig } from "@next/env";
import fs from 'fs';
import { PGEssay, PGJson } from "./../types/index";
import { Configuration, OpenAIApi } from "openai";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig("");

// Embedding generator for created JSON using openai embedding model

const generateEmbeddings = async (essays: PGEssay[]) => {
    const configuration = new Configuration({ apiKey: process.env.OPENAI_API_KEY });
    const openai = new OpenAIApi(configuration);

    const supabase = createClient(
        // Using ! to tell ts these constants exists and aren't undefined
        process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Looping through all essays
    for (let i = 0; i < essays.length; i++) {
        const essay = essays[i];
        for (let j = 0; j < essay.chunks.length; j++) {
            const chunk = essay.chunks[j];

            // Using openai embedding model
            const embeddingResponseOpenAi = await openai.createEmbedding({
                model: "text-embedding-ada-002",
                input: chunk.content
            });

            // Creating an 'embedding' structure
            const [{ embedding }] = embeddingResponseOpenAi.data.data;

            const { data, error } = await supabase.from("pgtalk_db").insert({
                essay_title: chunk.essay_title,
                essay_url: chunk.essay_url,
                essay_date: chunk.essay_date,
                content: chunk.content,
                content_tokens: chunk.content_tokens,
                embedding
            }).select("*");

            // error handling in openai api and logging upload to supabase

            if (error) {
                console.log("error");
            } else {
                console.log("saved", i, j);
            }

            // Preventing rate limits being hit, we use Promise here
            await new Promise((resolve) => setTimeout(resolve, 300));
        }
    }
};



// Calling the functions
(async () => {
    const json: PGJson = JSON.parse(fs.readFileSync('scripts/pgdata.json', 'utf-8'
    ))

    await generateEmbeddings(json.essays);
})();
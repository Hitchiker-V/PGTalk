import { PGChunk, PGEssay, PGJson } from "@/types";
import axios from "axios";
import * as cheerio from "cheerio";
import fs from "fs";
import { encode } from "gpt-3-encoder";

const BASE_URL = "http://www.paulgraham.com"
const CHUNK_SIZE = 200

// Getting all the links from Paul Graham's site for article
const getLinks = async () => {
    const html = await axios.get(`${BASE_URL}/articles.html`);
    const $ = cheerio.load(html.data);

    const tables = $("table");
    const linkArr: { url: string, title: string }[] = [];

    tables.each((i, table) => {
        if (i === 2) {
            const links = $(table).find("a");
            links.each((i, link) => {
                const url = $(link).attr('href')
                const title = $(link).text();

                // Checking if url exists and ends with .html and title not empty (specific to PG's page, index.html has no title)
                if (url && url.endsWith(".html") && title) {
                    const linkObj = {
                        url,
                        title
                    }

                    linkArr.push(linkObj);
                }
            })
        }
    })
    return linkArr;

};

// Getting the essays from each link
const getEssay = async (url: string, title: string) => {

    let essay: PGEssay = {
        title: "",
        url: "",
        date: "",
        content: "",
        tokens: 0,
        chunks: []
    };

    const html = await axios.get(`${BASE_URL}/${url}`);
    const $ = cheerio.load(html.data);
    const tables = $("table");

    tables.each((i, table) => {
        if (i === 1) {
            const text = $(table).text();
            // Creating regexes for cleaning and pre-processing text
            // Regex 1: find whitespaces; Regex 2: finds cases where period followed by char (.K) and replace such with . K
            let cleanedText = text.replace(/\s+/g, " ").replace(/\.([a-zA-Z])/g, ". $1");

            // Extracting the date using the Regex 3
            const splitText = cleanedText.match(/([A-Z][a-z]+ [0-9]{4})/);
            let dateStr = "";
            let textWithoutDate = "";

            if (splitText) {
                dateStr = splitText[0];
                textWithoutDate = cleanedText.replace(dateStr, "");
            }

            // Regex 4: replacing next line with empty space
            let essayText = textWithoutDate.replace(/\n/g, " ").trim();

            // converting the fetched and processed data to PGEssay type

            essay = {
                title,
                url,
                date: dateStr,
                content: essayText,
                tokens: encode(essayText).length,
                chunks: []
            }
        }
    });
    return essay;
};

// Getting 'chunks' from the fetched 'essays' from the 'links'
const getChunks = async (essay: PGEssay) => {
    const { title, url, date, content } = essay;

    let essayTextChunks: string[] = [];

    // CHecking if encoded essay into token is > chunk size (200), we break it to smaller chunks, else push the whole encoded content into essayTextChunks
    if (encode(content).length > CHUNK_SIZE) {
        // Splitting the text into sentences
        const split = content.split(". ")
        let chunkText = "";

        for (let i = 0; i < split.length; i++) {
            const sentence = split[i];
            const sentenceTokenLength = encode(sentence).length;
            const chunkTextTokenLength = encode(chunkText).length;

            if (chunkTextTokenLength + sentenceTokenLength > CHUNK_SIZE) {
                essayTextChunks.push(chunkText);
                chunkText = ""
            }

            // i is flag for case-insensitive
            if (sentence[sentence.length - 1].match(/[a-z0-9]/i)) {
                chunkText += sentence + ". ";
            } else {
                chunkText += sentence + " ";
            }
        }
        essayTextChunks.push(chunkText);
    }
    else {
        essayTextChunks.push(content);
    }

    // With those chunks, convert this into PGChunk object
    const essayChunks: PGChunk[] = essayTextChunks.map((chunkTest, i) => {
        const chunk: PGChunk = {
            essay_title: title,
            essay_url: url,
            essay_date: date,
            content: chunkTest,
            content_tokens: encode(chunkTest).length,
            embedding: []
        };
        return chunk
    });

    // We need to have a final check where the last set of data to chunk isn't less than 100 tokens
    // Checking if entire chunked essay has more than 1 chunks (given we'll a reverse add chunks to it and deleting the added from the essay untill tokens of any chunk !< 100)
    if (essayChunks.length > 1) {
        for (let i = 0; i < essayChunks.length; i++) {
            const chunk = essayChunks[i];
            const prevChunk = essayChunks[i - 1];

            // If token of any chunk < 100, we add more chunks to it to increase it's token size to 100 and content them up
            if (chunk.content_tokens < 100 && prevChunk) {
                prevChunk.content += " " + chunk.content;
                prevChunk.content_tokens = encode(prevChunk.content).length;

                // After encode we remove 1 chunk from the entire chunked essay
                essayChunks.splice(i, 1)
            }
        }
    }

    const chunkedEssay: PGEssay = {
        ...essay,
        chunks: essayChunks
    }

    return chunkedEssay;

};

(async () => {
    const links = await getLinks();

    let essays: PGEssay[] = [];
    for (let i = 0; i < links.length; i++) {

        // Let's get 7 chunks of the essay
        const link = links[i];
        const essay = await getEssay(link.url, link.title);
        const chunkedEssay = await getChunks(essay)
        essays.push(chunkedEssay);
    }
    // Saving all this to a PGJson
    const json: PGJson = {
        // Aggregate all token count into one count
        tokens: essays.reduce((acc, essay) => acc + essay.tokens, 0),
        essays
    };

    // Saving to file system, this json
    fs.writeFileSync("scripts/pgdata.json", JSON.stringify(json));
})();
import axios from "axios";
import * as cheerio from "cheerio";
import { url } from "inspector";

const BASE_URL = "http://www.paulgraham.com"

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
                if (url && url.endsWith(".html") && title !== '') {
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


(async () => {
    const links = await getLinks();
    console.log(links);
})();
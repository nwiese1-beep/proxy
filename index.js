const express   = require("express");
const fetch     = require("node-fetch");
const cheerio   = require("cheerio");
const path      = require("path");

const app = express();

// Serve all static files (style.css, index.html won’t be exposed directly here because we send it explicitly)
app.use(express.static(__dirname));

// Home: send your HTML form
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Proxy endpoint
app.get("/proxy", async (req, res) => {
  let url = req.query.url;
  if (!url) return res.status(400).send("No URL provided");

  // Ensure http://
  if (!/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }

  try {
    const upstream = await fetch(url);
    const contentType = upstream.headers.get("content-type") || "";

    // Non-HTML -> stream straight through (audio, images, CSS, etc.)
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return upstream.body.pipe(res);
    }

    // HTML -> rewrite links
    const body = await upstream.text();
    const $ = cheerio.load(body, { decodeEntities: false });

    // Rewrite href/src/action so assets/forms go through /proxy
    $("*[href], *[src], form[action]").each((_, el) => {
      ["href", "src", "action"].forEach(attr => {
        const link = $(el).attr(attr);
        if (!link || link.startsWith("#") || link.startsWith("javascript:")) return;

        let absolute;
        if (link.startsWith("//"))       absolute = "http:" + link;
        else if (link.startsWith("/"))    absolute = new URL(url).origin + link;
        else if (/^https?:\/\//i.test(link)) absolute = link;
        else                              absolute = new URL(link, url).href;

        $(el).attr(attr, "/proxy?url=" + encodeURIComponent(absolute));
      });
    });

    res.send($.html());
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching URL");
  }
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));

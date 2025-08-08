const express = require("express");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
app.use(express.urlencoded({ extended: true }));

// Serve static assets (CSS, JS)
app.use("/public", express.static(path.join(__dirname, "public")));

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Proxy route
app.get("/proxy", async (req, res) => {
  let url = req.query.url;
  if (!url) {
    return res.status(400).send("No URL provided");
  }

  // Normalize URL
  if (!/^https?:\/\//i.test(url)) {
    url = "http://" + url;
  }

  try {
    const upstream = await fetch(url);
    const contentType = upstream.headers.get("content-type") || "";

    // If not HTML, pipe it directly (e.g. images, audio, fonts)
    if (!contentType.includes("text/html")) {
      res.set("Content-Type", contentType);
      return upstream.body.pipe(res);
    }

    // Otherwise rewrite the HTML
    const text = await upstream.text();
    const $ = cheerio.load(text, { decodeEntities: false });

    // Rewrite all links, scripts, images, audio, forms
    $("*[href], *[src], form[action]").each((i, el) => {
      ["href", "src", "action"].forEach((attr) => {
        let link = $(el).attr(attr);
        if (!link) return;

        // Skip anchors & JS pseudo-links
        if (link.startsWith("#") || link.startsWith("javascript:")) return;

        // Resolve protocol‐relative, absolute, and relative URLs
        let absolute;
        if (link.startsWith("//")) {
          absolute = "http:" + link;
        } else if (link.startsWith("/")) {
          const base = new URL(url);
          absolute = base.origin + link;
        } else if (/^https?:\/\//i.test(link)) {
          absolute = link;
        } else {
          const base = new URL(url);
          absolute = new URL(link, base).href;
        }

        // Point back through our proxy
        $(el).attr(attr, "/proxy?url=" + encodeURIComponent(absolute));
      });
    });

    res.send($.html());
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching the requested URL");
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Proxy server running at http://localhost:${port}`);
});

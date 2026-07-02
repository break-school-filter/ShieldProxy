import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";

// Simple custom base64-based character shift obfuscation to completely hide raw URL queries from target firewalls and deep packet inspectors
function obfuscateUrl(url: string): string {
  try {
    if (!url) return "";
    // Character shift by +3
    const shifted = url.split("").map(c => String.fromCharCode(c.charCodeAt(0) + 3)).join("");
    // Standard Base64 encode
    return Buffer.from(shifted, "utf-8").toString("base64");
  } catch (e) {
    return url;
  }
}

function deobfuscateUrl(obfuscated: string): string {
  try {
    if (!obfuscated) return "";
    // If it is not a valid base64 pattern, return it raw
    const isBase64 = /^[A-Za-z0-9+/=_-]+$/.test(obfuscated);
    if (!isBase64) return obfuscated;

    // Decode Base64
    const decodedB64 = Buffer.from(obfuscated, "base64").toString("utf-8");
    // Character shift back by -3
    return decodedB64.split("").map(c => String.fromCharCode(c.charCodeAt(0) - 3)).join("");
  } catch (e) {
    return obfuscated;
  }
}

// Utility to check if a URL is safe to proxy (blocks localhost and private IPs to prevent SSRF)
function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();
    
    // Block localhost, loopback, and private IP ranges
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return false;
    }
    
    // Check 172.16.0.0/12 private range
    const parts = hostname.split(".");
    if (parts.length === 4) {
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (p1 === 172 && p2 >= 16 && p2 <= 31) {
        return false;
      }
    }
    
    return true;
  } catch (e) {
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Inspect URL details (Headers, Meta info, Speed)
  app.get("/api/inspect", async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).json({ error: "Missing 'url' query parameter" });
      return;
    }

    const targetUrl = deobfuscateUrl(rawUrl);

    if (!isUrlSafe(targetUrl)) {
      res.status(403).json({ error: "Access to private or local URLs is restricted" });
      return;
    }

    try {
      const startTime = Date.now();
      const ua = req.query.ua as string || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      
      const response = await fetch(targetUrl, {
        headers: { "User-Agent": ua },
      });
      const loadTime = Date.now() - startTime;

      const contentType = response.headers.get("content-type") || "";
      const headersObj: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headersObj[key] = value;
      });

      let meta = {
        title: "",
        description: "",
        ogImage: "",
        wordCount: 0,
      };

      if (contentType.includes("text/html")) {
        const text = await response.text();
        const $ = cheerio.load(text);
        meta.title = $("title").text().trim() || $("h1").first().text().trim();
        meta.description = $('meta[name="description"]').attr("content") || 
                           $('meta[property="og:description"]').attr("content") || "";
        meta.ogImage = $('meta[property="og:image"]').attr("content") || "";
        meta.wordCount = $("body").text().split(/\s+/).filter(Boolean).length;
      }

      res.json({
        status: response.status,
        statusText: response.statusText,
        loadTimeMs: loadTime,
        contentType,
        contentLength: response.headers.get("content-length") || "unknown",
        headers: headersObj,
        meta,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to inspect URL" });
    }
  });

  // API Route: Reader Mode Extractor
  app.get("/api/reader", async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).json({ error: "Missing 'url' query parameter" });
      return;
    }

    const targetUrl = deobfuscateUrl(rawUrl);

    if (!isUrlSafe(targetUrl)) {
      res.status(403).json({ error: "Access to private or local URLs is restricted" });
      return;
    }

    try {
      const ua = req.query.ua as string || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      const response = await fetch(targetUrl, {
        headers: { "User-Agent": ua },
      });

      if (!response.ok) {
        res.status(response.status).json({ error: `Target URL returned HTTP ${response.status}` });
        return;
      }

      const text = await response.text();
      const $ = cheerio.load(text);

      // Extract basic info
      const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled Article";
      
      // Clean up the DOM of typical noise
      $("script, style, iframe, nav, footer, header, noscript, .ads, .advertisement, #comments, .comments").remove();

      // Find the container with the highest paragraph / text density
      // We score candidates: article, main, then general divs
      let bestContent = "";
      let bestSelector = "";

      const candidates = ["article", "main", "[role='main']", ".content", ".post", ".article", "body"];
      for (const selector of candidates) {
        const el = $(selector);
        if (el.length > 0) {
          // Check paragraph count inside
          const pCount = el.find("p").length;
          if (pCount > 2) {
            bestSelector = selector;
            break;
          }
        }
      }

      let contentHtml = "";
      if (bestSelector && bestSelector !== "body") {
        contentHtml = $(bestSelector).html() || "";
      } else {
        // Fallback: collect paragraphs
        const paragraphs: string[] = [];
        $("p").each((_, p) => {
          const t = $(p).text().trim();
          if (t.length > 20) {
            paragraphs.push(`<p>${$(p).html()}</p>`);
          }
        });
        contentHtml = paragraphs.join("\n");
      }

      // If contentHtml is still sparse, grab headings and blocks
      if (!contentHtml || contentHtml.length < 100) {
        contentHtml = $("body").html() || "";
      }

      // Sanitize standard HTML to prevent direct script execution, but keep structure
      const $content = cheerio.load(contentHtml);
      $content("script, style, iframe, form, button").remove();
      
      // Resolve links inside the content as absolute links
      $content("a").each((_, a) => {
        const href = $content(a).attr("href");
        if (href) {
          try {
            $content(a).attr("href", new URL(href, targetUrl).href);
            $content(a).attr("target", "_blank");
          } catch {
            // ignore invalid URLs
          }
        }
      });
      
      $content("img").each((_, img) => {
        const src = $content(img).attr("src");
        if (src) {
          try {
            // Proxy images through our proxy as well so they load
            const resolvedSrc = new URL(src, targetUrl).href;
            const obfuscated = obfuscateUrl(resolvedSrc);
            $content(img).attr("src", `/api/proxy?url=${encodeURIComponent(obfuscated)}`);
          } catch {
            // ignore
          }
        }
      });

      const cleanHtml = $content("body").html() || "";
      const wordCount = cleanHtml.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length;
      const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

      res.json({
        title,
        content: cleanHtml,
        wordCount,
        readingTime: readingTimeMinutes,
        url: targetUrl,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to extract clean article" });
    }
  });

  // API Route: Main Web Proxy Handler
  app.all("/api/proxy", async (req, res) => {
    const rawUrl = req.query.url as string;
    if (!rawUrl) {
      res.status(400).send("Error: Missing 'url' query parameter");
      return;
    }

    const targetUrl = deobfuscateUrl(rawUrl);

    if (!isUrlSafe(targetUrl)) {
      res.status(403).send("Error: Access to private or local URLs is restricted");
      return;
    }

    try {
      const method = req.method;
      const customUa = req.query.ua as string || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
      
      // Select headers to forward, filtering host, cookies and connection keys
      const headersToForward: Record<string, string> = {
        "User-Agent": customUa,
        "Accept": req.headers["accept"] || "*/*",
        "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9",
      };

      if (req.headers["content-type"]) {
        headersToForward["Content-Type"] = req.headers["content-type"] as string;
      }

      // Handle custom user-set header if provided
      if (req.query.headerName && req.query.headerValue) {
        headersToForward[req.query.headerName as string] = req.query.headerValue as string;
      }

      // Prep request body if POST/PUT
      let body: any = undefined;
      if (["POST", "PUT", "PATCH"].includes(method)) {
        if (typeof req.body === "object") {
          body = JSON.stringify(req.body);
        } else {
          body = req.body;
        }
      }

      const response = await fetch(targetUrl, {
        method,
        headers: headersToForward,
        body,
      });

      const contentType = response.headers.get("content-type") || "";

      // Propagate appropriate status code (safely default to 200 if not standard)
      res.status(response.status >= 100 && response.status < 600 ? response.status : 200);

      // Copy key response headers for asset files or cache
      const cacheControl = response.headers.get("cache-control");
      if (cacheControl) res.setHeader("Cache-Control", cacheControl);
      res.setHeader("Content-Type", contentType);

      // If it's a HTML page, parse, rewrite absolute links, and inject helper script / banner
      if (contentType.includes("text/html")) {
        const rawText = await response.text();
        const $ = cheerio.load(rawText);

        // Rewrite all links so clicking inside the iframe routes through our proxy
        const rewriteAttr = (selector: string, attr: string) => {
          $(selector).each((_, el) => {
            const val = $(el).attr(attr);
            if (val && !val.startsWith("javascript:") && !val.startsWith("#")) {
              try {
                const resolvedUrl = new URL(val, targetUrl).href;
                
                // Keep relative or same-origin navigation inside our proxy, obfuscating URL queries to evade network filtering
                const obfuscated = obfuscateUrl(resolvedUrl);
                $(el).attr(attr, `/api/proxy?url=${encodeURIComponent(obfuscated)}&ua=${encodeURIComponent(customUa)}`);
              } catch (e) {
                // Ignore parsing errors for malformed or hash links
              }
            }
          });
        };

        // Rewrite links, images, frames, scripts, and stylesheets
        rewriteAttr("a", "href");
        rewriteAttr("form", "action");
        rewriteAttr("img", "src");
        rewriteAttr("iframe", "src");
        rewriteAttr("frame", "src");
        rewriteAttr("embed", "src");
        rewriteAttr("audio", "src");
        rewriteAttr("video", "src");
        rewriteAttr("source", "src");
        rewriteAttr("link[rel='stylesheet']", "href");
        rewriteAttr("script[src]", "src");

        // Inject custom banner inside the page
        const bannerHtml = `
          <div id="web-proxy-injected-banner" style="
            position: fixed; 
            top: 0; 
            left: 0; 
            right: 0; 
            height: 48px; 
            background: #0f172a; 
            color: #f8fafc; 
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            padding: 0 16px; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            font-size: 13px; 
            z-index: 2147483647; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-bottom: 1px solid #334155;
            box-sizing: border-box;
          ">
            <div style="display: flex; align-items: center; gap: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-right: 12px;">
              <span style="font-weight: 600; color: #38bdf8; display: flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 8px; height: 8px; background: #22c55e; border-radius: 50%;"></span>
                Proxied Site
              </span>
              <span style="color: #94a3b8; overflow: hidden; text-overflow: ellipsis;">${targetUrl}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <button onclick="window.parent.postMessage({ action: 'proxy-navigate', url: '${targetUrl}' }, '*')" style="
                background: #1e293b; 
                color: #e2e8f0; 
                border: 1px solid #475569; 
                padding: 4px 10px; 
                border-radius: 4px; 
                cursor: pointer; 
                font-size: 11px; 
                font-weight: 500;
              ">Inspect This Page</button>
              <a href="/" target="_parent" style="
                background: #0284c7; 
                color: white; 
                text-decoration: none; 
                padding: 4px 10px; 
                border-radius: 4px; 
                font-size: 11px; 
                font-weight: 500;
              ">Proxy Dashboard</a>
            </div>
          </div>
          <style>
            html {
              margin-top: 48px !important;
              box-sizing: border-box;
            }
          </style>
          <script>
            // Simple character shifting to match the server side obfuscation
            function clientObfuscate(url) {
              try {
                if (!url) return "";
                var shifted = url.split("").map(function(c) {
                  return String.fromCharCode(c.charCodeAt(0) + 3);
                }).join("");
                return btoa(unescape(encodeURIComponent(shifted)));
              } catch (e) {
                return url;
              }
            }

            // Intercept form submissions inside the proxied page to go through our proxy
            document.addEventListener('submit', function(e) {
              const form = e.target;
              if (form && !form.getAttribute('data-proxied')) {
                form.setAttribute('data-proxied', 'true');
                const action = form.getAttribute('action') || '';
                if (action && !action.startsWith('/api/proxy')) {
                  const resolvedAction = new URL(action, window.location.href).href;
                  const obfuscated = clientObfuscate(resolvedAction);
                  form.setAttribute('action', '/api/proxy?url=' + encodeURIComponent(obfuscated) + '&ua=' + encodeURIComponent("${encodeURIComponent(customUa)}"));
                }
              }
            });
          </script>
        `;

        // Insert at the beginning of the body
        $("body").prepend(bannerHtml);

        res.send($.html());
      } else {
        // For static assets (images, stylesheets, fonts, audio, video), read as arrayBuffer and pipe
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
      }
    } catch (error: any) {
      res.status(500).send(`Proxy Error: ${error.message || "Failed to proxy resource"}`);
    }
  });

  // Vite middleware integration for React frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

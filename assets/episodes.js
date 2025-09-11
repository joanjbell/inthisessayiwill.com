
(function(){
  const FEED = window.PODCAST_FEED_URL || "";
  const MAX_ON_HOME = 8;

  const stripTags = (html) => {
    if (!html) return "";
    const div = document.createElement("div");
    div.innerHTML = html;
    Array.from(div.querySelectorAll("script,style,noscript")).forEach(n => n.remove());
    return div.textContent || div.innerText || "";
  };

  const fmtDate = (dstr) => {
    const d = new Date(dstr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString(undefined, {year:"numeric", month:"short", day:"numeric"});
  };

  const tmplCard = (ep) => {
    const img = ep.image || "assets/logo.svg";
    const desc = (ep.description || "").slice(0, 240);
    const audio = ep.audio || "";
    const link = ep.link || "#";
    return `
      <article class="card">
        <div class="card-media cover" ${img ? `style="background-image:url('${img.replace(/"/g,'&quot;')}')"` : ""}></div>
        <div class="card-body">
          <h3>${ep.title || "Untitled episode"}</h3>
          <p class="muted tiny">${fmtDate(ep.pubDate)}</p>
          <p class="muted">${desc}${ep.description && ep.description.length>240 ? "…" : ""}</p>
          <div class="card-actions">
            ${audio ? `<audio controls preload="none" src="${audio}"></audio>` : ""}
            <div class="links">
              <a class="btn small" href="${link}" target="_blank" rel="noopener">Episode page</a>
            </div>
          </div>
        </div>
      </article>`;
  };

  const render = (episodes) => {
    if (!episodes || !episodes.length) return;
    const latestWrap = document.querySelector("#latest-episode");
    const listWrapAll = document.querySelectorAll("#episode-list");

    if (latestWrap) {
      latestWrap.classList.add("cards","one");
      latestWrap.innerHTML = tmplCard(episodes[0]);
    }
    listWrapAll.forEach((wrap) => {
      const toShow = episodes; // show all on both pages
      wrap.innerHTML = toShow.map(tmplCard).join("");
    });
  };

  const parseXML = async (xmlText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    if (doc.querySelector("parsererror")) throw new Error("Bad XML");
    const items = Array.from(doc.querySelectorAll("item"));
    const episodes = items.map(item => {
      const get = sel => item.querySelector(sel)?.textContent?.trim() || "";
      const enc = item.querySelector("enclosure");
      const itunesImg = item.querySelector("itunes\\:image, image");
      const imgHref = itunesImg?.getAttribute("href") || itunesImg?.getAttribute("url") || "";
      return {
        title: get("title"),
        link: get("link"),
        pubDate: get("pubDate"),
        description: stripTags(get("content\\:encoded") || get("description")),
        audio: enc?.getAttribute("url") || "",
        image: imgHref
      };
    });
    return episodes;
  };

  const fetchRSS = async () => {
    try {
      const res = await fetch(FEED, {mode:"cors", credentials:"omit"});
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const eps = await parseXML(text);
      if (!eps.length) throw new Error("No items");
      return eps;
    } catch (e) {
      const url = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(FEED);
      const res = await fetch(url, {mode:"cors"});
      if (!res.ok) throw new Error("Fallback HTTP " + res.status);
      const data = await res.json();
      if (!data || !data.items) throw new Error("Bad JSON");
      const eps = data.items.map(it => ({
        title: it.title,
        link: it.link,
        pubDate: it.pubDate || it.published || it.pubDate,
        description: stripTags(it.content || it.description),
        audio: (it.enclosure && it.enclosure.link) || it.enclosure || "",
        image: (it.thumbnail || (it.enclosure && it.enclosure.thumbnail)) || ""
      }));
      return eps;
    }
  };

  const init = async () => {
    if (!FEED) return;
    try {
      const eps = await fetchRSS();
      eps.sort((a,b) => new Date(b.pubDate) - new Date(a.pubDate));
      render(eps);
    } catch (err) {
      console.error("Failed to load feed:", err);
      const listWrap = document.querySelector("#episode-list");
      if (listWrap) listWrap.innerHTML = `<p class="muted">We’re having trouble loading episodes right now. <a href="${FEED}" target="_blank" rel="noopener">View RSS feed</a>.</p>`;
    }
  };
  document.addEventListener("DOMContentLoaded", init);
})();

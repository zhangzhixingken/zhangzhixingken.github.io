#!/usr/bin/env python3
"""Keep the navigation bar, favicons and Open Graph tags identical on both sites.

    python3 tools/sync-shared.py                     # www.zhixingzhang.com (this repo)
    python3 tools/sync-shared.py ../career --career  # career.zhixingzhang.com

Run it after adding a page or changing the nav. It rewrites only two marked blocks in
each page — <!-- shared-head:start/end --> before </head> and <!-- shared-nav:start/end -->
where the <nav class="site-nav"> sits — so it is safe to run repeatedly.
Pages that only redirect (meta refresh) are skipped.

Open Graph: title and description come from each page's <title> and meta description;
the image comes from OG_IMAGES below (1200 x 630 JPEG in assets/og/). A new page without
an entry uses the site's default image.
"""
import html
import re
import sys
from pathlib import Path

WWW = "https://www.zhixingzhang.com"
CAREER = "https://career.zhixingzhang.com"
NAV_VERSION = "20261020"
INSTAGRAM = "https://www.instagram.com/zhixing_gallery/"
INSTAGRAM_SVG = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false">'
                 '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/>'
                 '<circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>')

# page path -> (og image in assets/og/, alt text). "*" is the default.
OG_IMAGES = {
    "www": {
        "*": ("home.jpg", "BABEL by Zhixing Zhang: canvas heads on an aluminium ring"),
        "arts.html": ("arts.jpg", "Works by Zhixing Zhang: BABEL, Ephemeral, Undetected and Untitled"),
        "about.html": ("about.jpg", "Portrait of Zhixing Zhang"),
        "art/babel.html": ("babel.jpg", "BABEL: canvas heads on an aluminium ring, each with a speaker"),
        "art/cangjie.html": ("cangjie.jpg", "Tsang Chieh: carved blocks suspended from a ring"),
        "art/ephemeral.html": ("ephemeral.jpg", "Ephemeral, 2021: lighting the line of light at night"),
        "art/undetected.html": ("undetected.jpg", "Undetected: a subway tunnel under construction in Shenzhen"),
        "art/untitled.html": ("untitled.jpg", "Untitled: a staged domestic scene in a kitchen at dusk"),
        "careers.html": ("shanghai-gift.jpg", "Shanghai architecture tea packaging"),
        "career/shanghai-gift.html": ("shanghai-gift.jpg", "Shanghai architecture tea packaging"),
        "career/event-photography.html": ("event-photography.jpg", "Event photography"),
        "career/stillness.html": ("stillness.jpg", "Stillness: Shanghai street at night"),
        "career/aigc-title.html": ("aigc-title.jpg", "AIGC title sequence still"),
    },
    "career": {
        "*": ("home.jpg", "Selected design work by Zhixing Zhang"),
        "mingde-2021/index.html": ("mingde-2021.jpg", "MINGDE 2021: a line of light drawn across the sports ground"),
        "brewing-shanghai/index.html": ("brewing-shanghai.jpg", "Brewing Shanghai: landmark tea-bag hangers on cups"),
        "commercial-photography/index.html": ("commercial-photography.jpg", "Commercial photography"),
        "mapstudio-branding/index.html": ("mapstudio-branding.jpg", "MAPStudio branding"),
        "animation-video/index.html": ("animation-video.jpg", "Animation video still"),
    },
}

# Used only where a page has no meta description of its own.
DESCRIPTIONS = {
    "www": {
        "about.html": "Zhixing Zhang (张知行) is an artist working across interactive installation, photography and moving image. Biography, education and exhibitions.",
        "*": "Zhixing Zhang — artist working across interactive installation, photography and moving image.",
    },
    "career": {"*": "Visual design, motion and photography by Zhixing Zhang."},
}


def nav_html(site, rel):
    """The one nav. www links are root-relative (they work locally too); career links are absolute."""
    if site == "www":
        home, arts, about, contact = "/", "/arts.html", "/about.html", "/contact.html"
        section = ("arts" if rel == "arts.html" or rel.startswith("art/") else
                   "career" if rel == "careers.html" or rel.startswith("career/") else
                   "about" if rel == "about.html" else "contact" if rel == "contact.html" else "")
    else:
        home, arts, contact = f"{WWW}/", f"{WWW}/arts.html", f"{WWW}/contact.html"
        about = "/about/"  # the career site keeps its own professional About page
        section = "about" if rel == "about/index.html" else "career"
    career = f"{CAREER}/" if site == "www" else "/"

    def link(key, href, label):
        active = ' class="is-active" aria-current="page"' if key == section else ""
        return f'<li><a href="{href}"{active}>{label}</a></li>'

    return ("<!-- shared-nav:start -->\n"
            '<nav class="site-nav" aria-label="Main navigation">'
            f'<a class="logo" href="{home if site == "www" else WWW + "/"}">Zhixing Zhang</a>'
            '<ul class="nav-links">'
            + link("arts", arts, "Arts") + link("career", career, "Career")
            + link("about", about, "About") + link("contact", contact, "Contact")
            + '</ul>'
            f'<div class="nav-docs"><a class="nav-instagram" href="{INSTAGRAM}" target="_blank" rel="noopener" aria-label="Instagram">{INSTAGRAM_SVG}</a></div>'
            '<button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span></button>'
            "</nav>\n<!-- shared-nav:end -->")


def page_url(site, rel):
    base = WWW if site == "www" else CAREER
    if rel == "index.html":
        return base + "/"
    if rel.endswith("/index.html"):
        return f"{base}/{rel[:-len('index.html')]}"
    return f"{base}/{rel}"


def head_html(site, rel, text):
    esc = lambda s: html.escape(s, quote=True)
    title = re.search(r"<title>(.*?)</title>", text, re.S)
    title = html.unescape(title.group(1).strip()) if title else "Zhixing Zhang"
    desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', text)
    desc = html.unescape(desc.group(1)) if desc else DESCRIPTIONS[site].get(rel, DESCRIPTIONS[site]["*"])
    canonical = re.search(r'<link\s+rel="canonical"\s+href="([^"]*)"', text)
    url = canonical.group(1) if canonical else page_url(site, rel)
    lang = re.search(r'<html[^>]*\blang="([^"]+)"', text)
    locale = "zh_CN" if lang and lang.group(1).lower().startswith("zh") else "en_US"
    image, alt = OG_IMAGES[site].get(rel, OG_IMAGES[site]["*"])
    image_url = f"{WWW if site == 'www' else CAREER}/assets/og/{image}"
    shared = f"{WWW}/assets/nav" if site == "career" else "/assets/nav"

    lines = ["<!-- shared-head:start -->"]
    if not re.search(r'<meta\s+name="description"', text):
        lines.append(f'<meta name="description" content="{esc(desc)}">')
    if not canonical and "noindex" not in text:
        lines.append(f'<link rel="canonical" href="{url}">')
    lines += [
        '<link rel="icon" href="/favicon.ico" sizes="48x48">',
        '<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="Zhixing Zhang">',
        f'<meta property="og:title" content="{esc(title)}">',
        f'<meta property="og:description" content="{esc(desc)}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{image_url}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{esc(alt)}">',
        f'<meta property="og:locale" content="{locale}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{esc(title)}">',
        f'<meta name="twitter:description" content="{esc(desc)}">',
        f'<meta name="twitter:image" content="{image_url}">',
        f'<link rel="stylesheet" href="{shared}/nav.css?v={NAV_VERSION}">',
        f'<script src="{shared}/nav.js?v={NAV_VERSION}" defer></script>',
        "<!-- shared-head:end -->",
    ]
    return "\n".join(lines)


def sync(root, site):
    pages = sorted(p for p in root.rglob("*.html") if ".git" not in p.parts and "node_modules" not in p.parts)
    for path in pages:
        rel = path.relative_to(root).as_posix()
        text = path.read_text(encoding="utf-8")
        if re.search(r'http-equiv="refresh"', text):
            print(f"skip (redirect)  {rel}")
            continue
        original = text
        # Head: drop old icon links and any OG/Twitter tags, then (re)write the shared block.
        text = re.sub(r"\n?<!-- shared-head:start -->.*?<!-- shared-head:end -->", "", text, flags=re.S)
        text = re.sub(r'[ \t]*<link\s+rel="(?:shortcut )?icon"[^>]*>\s*', "", text)
        text = re.sub(r'[ \t]*<link\s+rel="apple-touch-icon"[^>]*>\s*', "", text)
        text = re.sub(r'[ \t]*<meta\s+(?:property|name)="(?:og|twitter):[^"]*"[^>]*>\s*', "", text)
        block = head_html(site, rel, text)
        text = re.sub(r"\s*</head>", lambda m: "\n" + block + "\n</head>", text, count=1)
        # Nav: replace the marked block, or the first <nav class="site-nav ...">…</nav>.
        nav = nav_html(site, rel)
        if "<!-- shared-nav:start -->" in text:
            text = re.sub(r"<!-- shared-nav:start -->.*?<!-- shared-nav:end -->", lambda m: nav, text, count=1, flags=re.S)
        elif re.search(r'<nav class="site-nav[^"]*"', text):
            text = re.sub(r'<nav class="site-nav[^"]*"[^>]*>.*?</nav>', lambda m: nav, text, count=1, flags=re.S)
        else:
            text = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + "\n" + nav, text, count=1)
        if text != original:
            path.write_text(text, encoding="utf-8")
            print(f"updated          {rel}")
        else:
            print(f"unchanged        {rel}")


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    site = "career" if "--career" in sys.argv else "www"
    root = Path(args[0]) if args else Path(__file__).resolve().parent.parent
    sync(root.resolve(), site)

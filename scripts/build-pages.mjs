#!/usr/bin/env node
/**
 * GitHub Pages static export — institutional frontend only.
 * Output: dist-pages-publish/ → pushed to gh-pages branch (no Laravel, no docs).
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { allPublicPaths, pathToComponent } from '../resources/js/lib/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const viteOut = join(root, 'dist-pages');
const publishDir = join(root, 'dist-pages-publish');
const domain = 'biu-gholdings.org';

rmSync(publishDir, { recursive: true, force: true });
mkdirSync(publishDir, { recursive: true });

const nestedIndex = join(viteOut, 'resources/pages/index.html');
const flatIndex = join(viteOut, 'index.html');
const sourceIndex = existsSync(flatIndex) ? flatIndex : nestedIndex;

if (!existsSync(sourceIndex)) {
    console.error('Missing Vite output. Run: vite build --config vite.config.pages.js');
    process.exit(1);
}

cpSync(join(viteOut, 'assets'), join(publishDir, 'assets'), { recursive: true });

for (const name of [
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
]) {
    cpSync(join(root, 'public', name), join(publishDir, name));
}

let shellHtml = readFileSync(sourceIndex, 'utf8');
shellHtml = shellHtml.replace(/\.\.\/\.\.\/assets\//g, '/assets/');
shellHtml = shellHtml.replace(/\/resources\/pages\//g, '/');

function writePageAtPath(routePath, html) {
    if (routePath === '/') {
        writeFileSync(join(publishDir, 'index.html'), html);
        return;
    }

    const dir = join(publishDir, routePath.replace(/^\//, ''));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
}

/* ------------------------------------------------------------------ */
/* Per-route SEO head (title, description, canonical, OG, hreflang).   */
/* Values are read from each page component (MainLayout title and the */
/* first paragraph after <h1>) so the static HTML matches the page.    */
/* ------------------------------------------------------------------ */

const origin = `https://${domain}`;

// EN <-> PT pairs, used for hreflang alternates.
const languagePairs = [
    ['/', '/pt'],
    ['/about', '/sobre'],
    ['/leadership', '/lideranca'],
    ['/corporate-structure', '/estrutura-corporativa'],
    ['/subsidiaries', '/subsidiarias'],
    ['/investor-relations', '/relacoes-com-investidores'],
    ['/contact', '/contacto'],
];
const ptPaths = new Set(languagePairs.map(([, pt]) => pt).concat(['/relacoes-com-investidores/obrigado', '/contacto/obrigado']));
const isThankYou = (routePath) => /\/(thank-you|obrigado)$/.test(routePath);

function canonicalUrl(routePath) {
    return routePath === '/' ? `${origin}/` : `${origin}${routePath}/`;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function jsxToText(fragment) {
    return fragment
        .replace(/\{['"`]([^'"`]*)['"`]\}/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text, max = 160) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

function pageMeta(routePath) {
    const component = pathToComponent[routePath];
    const file = component ? join(root, 'resources/js/Pages', `${component}.jsx`) : null;
    const source = file && existsSync(file) ? readFileSync(file, 'utf8') : '';
    const titleMatch = source.match(/<MainLayout[^>]*title="([^"]+)"/);
    const h1Index = source.indexOf('<h1');
    const afterH1 = h1Index >= 0 ? source.slice(h1Index) : source;
    const paraMatch = afterH1.match(/<p\b[^>]*>([\s\S]*?)<\/p>/);
    return {
        title: titleMatch ? titleMatch[1] : 'Biu-g Holdings',
        description: paraMatch ? truncate(jsxToText(paraMatch[1])) : '',
    };
}

function alternatesFor(routePath) {
    const pair = languagePairs.find(([en, pt]) => en === routePath || pt === routePath);
    if (!pair) return '';
    const [en, pt] = pair;
    return [
        `<link rel="alternate" hreflang="en" href="${canonicalUrl(en)}" />`,
        `<link rel="alternate" hreflang="pt" href="${canonicalUrl(pt)}" />`,
        `<link rel="alternate" hreflang="x-default" href="${canonicalUrl(en)}" />`,
    ].join('\n        ');
}

/*
 * Analytics (optional, disabled by default). Set ONE build-time variable
 * (GitHub Actions secret) to enable it; nothing is committed:
 *   VITE_CF_ANALYTICS_TOKEN  Cloudflare Web Analytics token (cookieless)
 *   VITE_GA4_MEASUREMENT_ID  GA4 ID such as G-XXXXXXXXXX (needs a consent decision)
 */
function analyticsSnippet() {
    const cfToken = process.env.VITE_CF_ANALYTICS_TOKEN || '';
    const ga4Id = process.env.VITE_GA4_MEASUREMENT_ID || '';
    if (cfToken) {
        return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: cfToken })}'></script>`;
    }
    if (ga4Id) {
        const id = escapeHtml(ga4Id);
        return [
            `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
            `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>`,
        ].join('\n        ');
    }
    return '<!-- analytics: disabled (set VITE_CF_ANALYTICS_TOKEN or VITE_GA4_MEASUREMENT_ID at build time) -->';
}

function htmlForRoute(routePath) {
    const { title, description } = pageMeta(routePath);
    const lang = ptPaths.has(routePath) ? 'pt' : 'en';
    const url = canonicalUrl(routePath);
    const head = [
        description ? `<meta name="description" content="${escapeHtml(description)}" />` : '',
        isThankYou(routePath) ? '<meta name="robots" content="noindex, follow" />' : '',
        `<link rel="canonical" href="${url}" />`,
        alternatesFor(routePath),
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="Biu-g Holdings" />',
        `<meta property="og:title" content="${escapeHtml(title)}" />`,
        description ? `<meta property="og:description" content="${escapeHtml(description)}" />` : '',
        `<meta property="og:url" content="${url}" />`,
        `<meta property="og:locale" content="${lang === 'pt' ? 'pt_PT' : 'en_US'}" />`,
        '<meta name="twitter:card" content="summary" />',
        analyticsSnippet(),
    ]
        .filter(Boolean)
        .join('\n        ');

    return shellHtml
        .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>\n        ${head}`);
}

for (const routePath of allPublicPaths) {
    writePageAtPath(routePath, htmlForRoute(routePath));
}

const indexable = allPublicPaths.filter((p) => !isThankYou(p));
writeFileSync(
    join(publishDir, 'sitemap.xml'),
    [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...indexable.map((p) => `  <url>\n    <loc>${canonicalUrl(p)}</loc>\n  </url>`),
        '</urlset>',
        '',
    ].join('\n'),
);
writeFileSync(
    join(publishDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`,
);

writeFileSync(join(publishDir, '404.html'), shellHtml.replace('<title>', '<meta name="robots" content="noindex" />\n        <title>'));
writeFileSync(join(publishDir, '.nojekyll'), '\n');
writeFileSync(join(publishDir, 'CNAME'), `${domain}\n`);

const verify = spawnSync('node', [join(__dirname, 'verify-pages-artifact.mjs'), publishDir], {
    stdio: 'inherit',
    cwd: root,
});

if (verify.status !== 0) {
    process.exit(verify.status ?? 1);
}

console.log(`Static export ready: ${publishDir}/`);
console.log(`Pages: ${allPublicPaths.length} EN/PT routes + 404.html + assets/`);

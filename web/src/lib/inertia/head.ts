import { Children, cloneElement, createContext, isValidElement, useContext, useEffect, useMemo, type ReactElement, type ReactNode } from 'react';

// Port <Head> + createHeadManager @inertiajs/react & core 2.0.3 (src/Head.ts, src/head.ts). Tag selain <title>
// (mis. <meta name="description">) dikelola persis seperti Inertia: elemen ber-atribut `inertia` di <head>.
// Bedanya judul: Laravel mengganti teks <title inertia> app.blade.php lewat DOM. Di Next.js <title> dimiliki React
// (elemen hoistable): React mengklaim <title> pertama yang belum dimiliki setiap kali sebuah <title> React terpasang,
// jadi judul yang ditulis lewat DOM bisa ditimpa. Karena itu judul dikirim ke <InertiaApp> (`aturJudul`), yang
// merender satu-satunya <title> React di halaman (root layout tidak memasang judul metadata).

type Provider = { update: (elemen: string[]) => void; disconnect: () => void };
export type HeadManager = { forceUpdate: () => void; createProvider: () => Provider };

export const HeadContext = createContext<HeadManager | undefined>(undefined);
HeadContext.displayName = 'InertiaHeadContext';

function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
    let t: ReturnType<typeof setTimeout> | undefined;
    return (...a: A) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
}

function buatElemen(tag: string): Element {
    const template = document.createElement('template');
    template.innerHTML = tag;
    const node = template.content.firstChild as Element;
    if (!tag.startsWith('<script ')) return node;
    const script = document.createElement('script');
    script.innerHTML = node.innerHTML;
    node.getAttributeNames().forEach((n) => script.setAttribute(n, node.getAttribute(n) || ''));
    return script;
}

/** Renderer.update Inertia untuk tag selain <title>. */
function perbaruiHead(tags: string[]) {
    const sumber = tags.map(buatElemen);
    const target = Array.from(document.head.childNodes).filter(
        (el): el is Element => el.nodeType === Node.ELEMENT_NODE && (el as Element).getAttribute('inertia') !== null && el.nodeName !== 'TITLE',
    );
    for (const el of target) {
        const kunci = el.getAttribute('inertia');
        const i = sumber.findIndex((s) => s.getAttribute('inertia') === kunci);
        if (i === -1) {
            el.parentNode?.removeChild(el);
            continue;
        }
        const s = sumber.splice(i, 1)[0];
        if (s && !el.isEqualNode(s)) el.parentNode?.replaceChild(s, el);
    }
    sumber.forEach((s) => document.head.appendChild(s));
}

/** Terapkan kumpulan tag (debounce 1 ms seperti Renderer.update): <title> → `aturJudul`, sisanya ke <head>. */
export function penerapHead(aturJudul: (judul: string) => void) {
    return debounce((tags: string[]) => {
        const judul = tags.find((t) => t.startsWith('<title'));
        if (judul !== undefined) aturJudul(buatElemen(judul).textContent ?? '');
        perbaruiHead(tags.filter((t) => !t.startsWith('<title')));
    }, 1);
}

/** createHeadManager (mode browser). `judul` = callback `title` createInertiaApp. */
export function buatHeadManager(judul: (title: string) => string, terapkanKe: (tags: string[]) => void): HeadManager {
    const states: Record<string, string[]> = {};
    let idTerakhir = 0;

    function kumpulkan(): string[] {
        const t = judul('');
        const bawaan: Record<string, string> = t ? { title: `<title inertia="">${t}</title>` } : {};
        const elemen = Object.values(states)
            .flat()
            .reduce((carry, el) => {
                if (el.indexOf('<') === -1) return carry;
                if (el.indexOf('<title ') === 0) {
                    const m = el.match(/(<title [^>]+>)(.*?)(<\/title>)/);
                    carry.title = m ? `${m[1]}${judul(m[2])}${m[3]}` : el;
                    return carry;
                }
                const m = el.match(/ inertia="[^"]+"/);
                if (m) carry[m[0]] = el;
                else carry[Object.keys(carry).length] = el;
                return carry;
            }, bawaan);
        return Object.values(elemen);
    }

    const commit = () => terapkanKe(kumpulkan());
    commit();

    return {
        forceUpdate: commit,
        createProvider() {
            const id = String((idTerakhir += 1));
            states[id] = [];
            return {
                update: (el) => {
                    if (Object.hasOwn(states, id)) states[id] = el;
                    commit();
                },
                disconnect: () => {
                    if (!Object.hasOwn(states, id)) return;
                    delete states[id];
                    commit();
                },
            };
        },
    };
}

const TAG_TUNGGAL = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

type Node_ = ReactElement<Record<string, unknown> & { children?: unknown }, string>;

function awalTag(node: Node_): string {
    const attrs = Object.keys(node.props).reduce((carry, name) => {
        if (['head-key', 'children', 'dangerouslySetInnerHTML'].includes(name)) return carry;
        const value = node.props[name];
        return value === '' ? `${carry} ${name}` : `${carry} ${name}="${value}"`;
    }, '');
    return `<${node.type}${attrs}>`;
}

function renderTag(node: Node_): string {
    let html = awalTag(node);
    const anak = node.props.children;
    if (anak) html += typeof anak === 'string' ? anak : (anak as Node_[]).reduce((h, c) => h + renderTag(c), '');
    const inner = node.props.dangerouslySetInnerHTML as { __html: string } | undefined;
    if (inner) html += inner.__html;
    if (!TAG_TUNGGAL.includes(node.type)) html += `</${node.type}>`;
    return html;
}

function renderNodes(children: ReactNode, title?: string): string[] {
    const hasil = Children.toArray(children)
        .filter((n): n is Node_ => isValidElement(n))
        .map((n) => renderTag(cloneElement(n, { inertia: n.props['head-key'] !== undefined ? n.props['head-key'] : '' }) as Node_));
    if (title && !hasil.find((t) => t.startsWith('<title'))) hasil.push(`<title inertia>${title}</title>`);
    return hasil;
}

/** <Head> Inertia: daftar tag diperbarui saat render (seperti aslinya), dilepas saat unmount. */
export function Head({ children, title }: { title?: string; children?: ReactNode }) {
    const manager = useContext(HeadContext);
    if (!manager) throw new Error('Head harus berada di dalam <InertiaApp>');
    const provider = useMemo(() => manager.createProvider(), [manager]);
    useEffect(() => () => provider.disconnect(), [provider]);
    provider.update(renderNodes(children, title));
    return null;
}

// Padanan `route()` Ziggy 2.6.4 (sigap/vendor/tightenco/ziggy/src/js: Router.js, Route.js) untuk rute bernama
// Laravel. Daftar rute per peran dibuat server (src/server/inertia/ziggy.ts, grup config/ziggy.php) dan dipasang
// <InertiaApp> sebagai global `Ziggy` + `route` di browser, seperti `@routes` di app.blade.php.
// shortcut: hanya route(nama, params?, absolute?); route() tanpa nama (current(), has(), params), `defaults`, domain
// rute, dan query bertingkat → galat jelas. Tambah bila halaman yang dipindah memakainya (saat S1 tidak ada halaman
// hidup yang memanggil route()).

export interface RuteZiggy {
    uri: string;
    methods: string[];
    wheres?: Record<string, string>;
    parameters?: string[];
    bindings?: Record<string, string>;
    domain?: string;
}

export interface ZiggyConfig {
    url: string;
    port: number | null;
    defaults: Record<string, unknown>;
    routes: Record<string, RuteZiggy>;
}

type Nilai = string | number | boolean | null | undefined;
export type ParamRute = Nilai | Nilai[] | Record<string, Nilai | Record<string, Nilai>>;

declare global {
    var Ziggy: ZiggyConfig | undefined;
    var route: typeof routeZiggy;
}

/** rawurlencode PHP / qs RFC3986: hanya A-Z a-z 0-9 - _ . ~ yang tidak di-encode. */
export const rawurlencode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const segmenParam = (template: string) =>
    template.match(/{[^}?]+\??}/g)?.map((s) => ({ name: s.replace(/{|\??}/g, ''), required: !/\?}$/.test(s) })) ?? [];

export function routeZiggy(nama?: string, params?: ParamRute, absolute = true, config: ZiggyConfig | undefined = globalThis.Ziggy): string {
    if (!nama) throw new Error('route() tanpa nama (current(), has(), params) belum didukung (src/lib/ziggy.ts)');
    if (!config) throw new Error('Ziggy error: missing configuration. Ensure that a `Ziggy` variable is defined globally.');
    if (!Object.hasOwn(config.routes, nama)) throw new Error(`Ziggy error: route '${nama}' is not in the route list.`);
    if (Object.keys(config.defaults).length > 0) throw new Error('route(): Ziggy defaults belum didukung (src/lib/ziggy.ts)');
    const def = config.routes[nama];
    if (def.domain) throw new Error('route(): rute ber-domain belum didukung (src/lib/ziggy.ts)');
    const wheres = def.wheres ?? {};

    // Route.template
    const t = `${absolute ? config.url : ''}/${def.uri}`.replace(/\/+$/, '');
    const template = t === '' ? '/' : t;
    const segmen = segmenParam(template);

    const bindings = def.bindings ?? {};

    // Router._parse (tanpa defaults): skalar → larik; larik diurutkan sesuai segmen; objek model untuk satu segmen.
    let p: Record<string, unknown> = {};
    const masuk = params === null || params === undefined ? {} : ['string', 'number'].includes(typeof params) ? [params] : params;
    if (Array.isArray(masuk)) {
        masuk.forEach((v, i) => {
            if (segmen[i]) p[segmen[i].name] = v;
            else if (typeof v === 'object' && v !== null) Object.assign(p, v);
            else p[String(v)] = '';
        });
    } else if (typeof masuk === 'object') {
        p = { ...masuk };
        const kunciModel = Object.values(bindings)[0];
        if (
            segmen.length === 1 &&
            !Object.hasOwn(p, segmen[0].name) &&
            ((kunciModel !== undefined && Object.hasOwn(p, kunciModel)) || Object.hasOwn(p, 'id'))
        ) {
            p = { [segmen[0].name]: p };
        }
    }
    // _substituteBindings: objek model → nilai kunci binding rute (atau `id`).
    for (const { name } of segmen) {
        const v = p[name];
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            const kunci = Object.hasOwn(v, bindings[name]) ? bindings[name] : Object.hasOwn(v, 'id') ? 'id' : undefined;
            if (kunci === undefined)
                throw new Error(`Ziggy error: object passed as '${name}' parameter is missing route model binding key '${bindings[name]}'.`);
            p[name] = (v as Record<string, unknown>)[kunci];
        }
    }

    // Route.compile
    let url = template;
    if (segmen.length > 0) {
        url = template
            .replace(/{([^}?]+)(\??)}/g, (_, s: string, opsional: string) => {
                const v = p[s] as Nilai;
                if (!opsional && (v === null || v === undefined)) throw new Error(`Ziggy error: '${s}' parameter is required for route '${nama}'.`);
                if (wheres[s] && !new RegExp(`^${opsional ? `(${wheres[s]})?` : wheres[s]}$`).test(String(v ?? ''))) {
                    throw new Error(`Ziggy error: '${s}' parameter '${v}' does not match required format '${wheres[s]}' for route '${nama}'.`);
                }
                return encodeURI(String(v ?? ''))
                    .replace(/%7C/g, '|')
                    .replace(/%25/g, '%')
                    .replace(/\$/g, '%24');
            })
            .replace(absolute ? /(\.[^/]+?)(\/\/)/ : /(^)(\/\/)/, '$1/')
            .replace(/\/+$/, '');
    }

    // Router.toString: sisa parameter → query (qs: encodeValuesOnly, skipNulls, boolean → 0/1).
    const query = Object.entries(p)
        .filter(([k]) => !segmen.some((s) => s.name === k))
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => {
            if (typeof v === 'object') throw new Error('route(): parameter query bertingkat belum didukung (src/lib/ziggy.ts)');
            return `${k}=${rawurlencode(String(typeof v === 'boolean' ? Number(v) : v))}`;
        });
    return url + (query.length > 0 ? `?${query.join('&')}` : '');
}

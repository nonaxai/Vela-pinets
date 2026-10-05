import { defineConfig, type Plugin } from 'vite';
import * as esbuild from 'esbuild';
import { dirname, resolve, join } from 'node:path';
import * as fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

function pineScriptsFsPlugin(): Plugin {
    const scriptsDir = resolve(process.cwd(), 'scripts');
    const metaFile = join(scriptsDir, '.meta.json');

    const readMeta = (): { favorites: string[]; activeFile?: string } => {
        try {
            if (fs.existsSync(metaFile)) {
                return JSON.parse(fs.readFileSync(metaFile, 'utf8')) as { favorites: string[]; activeFile?: string };
            }
        } catch {
            // Ignore parse errors, return defaults
        }
        return { favorites: [] };
    };

    const writeMeta = (meta: { favorites: string[]; activeFile?: string }) => {
        try {
            fs.writeFileSync(metaFile, JSON.stringify(meta, null, 4), 'utf8');
        } catch {
            // Ignore write errors
        }
    };

    return {
        name: 'pine-scripts-fs',
        configureServer(server) {
            server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
                const url = req.url ?? '';
                if (!url.startsWith('/api/pine-scripts')) {
                    next();
                    return;
                }

                if (!fs.existsSync(scriptsDir)) {
                    fs.mkdirSync(scriptsDir, { recursive: true });
                }

                if (req.method === 'GET') {
                    try {
                        const meta = readMeta();
                        const files = fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.pine'));
                        const scripts = files.map((filename) => {
                            const full = join(scriptsDir, filename);
                            const stat = fs.statSync(full);
                            const content = fs.readFileSync(full, 'utf8');
                            const name = filename.replace(/\.pine$/, '');
                            const isFavorite = meta.favorites.includes(filename);
                            return {
                                id: filename,
                                name,
                                filename,
                                content,
                                isFavorite,
                                updatedAt: stat.mtimeMs,
                            };
                        });
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ scripts, activeFile: meta.activeFile ?? scripts[0]?.filename }));
                        return;
                    } catch (err: unknown) {
                        res.statusCode = 500;
                        res.end(JSON.stringify({ error: String(err) }));
                        return;
                    }
                }

                if (req.method === 'POST') {
                    let bodyStr = '';
                    req.on('data', (chunk) => {
                        bodyStr += chunk;
                    });
                    req.on('end', () => {
                        try {
                            const body = JSON.parse(bodyStr) as {
                                filename?: string;
                                name?: string;
                                content: string;
                                isFavorite?: boolean;
                                setActive?: boolean;
                                renameFrom?: string;
                            };
                            let filename = (body.filename || body.name || 'Untitled').trim();
                            if (!filename.endsWith('.pine')) filename += '.pine';
                            filename = filename.replace(/[/\\]/g, '_');

                            if (body.renameFrom && body.renameFrom !== filename) {
                                const oldPath = join(scriptsDir, body.renameFrom);
                                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                            }

                            const filePath = join(scriptsDir, filename);
                            fs.writeFileSync(filePath, body.content ?? '', 'utf8');

                            const meta = readMeta();
                            if (body.isFavorite !== undefined) {
                                if (body.isFavorite && !meta.favorites.includes(filename)) {
                                    meta.favorites.push(filename);
                                } else if (!body.isFavorite && meta.favorites.includes(filename)) {
                                    meta.favorites = meta.favorites.filter((f) => f !== filename);
                                }
                            }
                            if (body.setActive) {
                                meta.activeFile = filename;
                            }
                            writeMeta(meta);

                            const stat = fs.statSync(filePath);
                            res.setHeader('Content-Type', 'application/json');
                            res.end(
                                JSON.stringify({
                                    ok: true,
                                    script: {
                                        id: filename,
                                        name: filename.replace(/\.pine$/, ''),
                                        filename,
                                        content: body.content,
                                        isFavorite: meta.favorites.includes(filename),
                                        updatedAt: stat.mtimeMs,
                                    },
                                })
                            );
                        } catch (err: unknown) {
                            res.statusCode = 500;
                            res.end(JSON.stringify({ error: String(err) }));
                        }
                    });
                    return;
                }

                if (req.method === 'DELETE') {
                    const parsed = new URL(url, 'http://localhost');
                    let targetFile = parsed.searchParams.get('file');
                    if (!targetFile) {
                        const parts = parsed.pathname.split('/');
                        targetFile = decodeURIComponent(parts[parts.length - 1] ?? '');
                    }
                    if (targetFile && targetFile.endsWith('.pine')) {
                        const filePath = join(scriptsDir, targetFile);
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                        }
                        const meta = readMeta();
                        meta.favorites = meta.favorites.filter((f) => f !== targetFile);
                        if (meta.activeFile === targetFile) delete meta.activeFile;
                        writeMeta(meta);
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ ok: true }));
                        return;
                    }
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Missing or invalid file parameter' }));
                    return;
                }

                next();
            });
        },
    };
}

/**
 * Playground server: `npm run playground` serves playground/ with the ENGINE imported
 * straight from src/ (HMR) and Vela consumed as the built package (`file:../Vela`,
 * dist through its exports map — rebuild Vela there to see a Vela change here). Port
 * 5192 (Vela OS uses 5190, Vela-pro 5191).
 *
 * The `inline-worker:` scheme is resolved FOR REAL here (same semantics as the tsup
 * plugin): the worker entry is bundled into a self-contained IIFE string, so
 * `PineWorkerEngine` is fully functional and the worker path can be exercised end to
 * end. (vitest keeps its empty stub; unit tests inject fake workers instead.)
 */
export default defineConfig({
    root: 'playground',
    server: { port: 5192, strictPort: true },
    plugins: [
        pineScriptsFsPlugin(),
        {
            name: 'inline-worker',
            resolveId(id: string, importer?: string) {
                if (!id.startsWith('inline-worker:')) return undefined;
                const entry = resolve(dirname(importer ?? ''), id.slice('inline-worker:'.length));
                return `\0inline-worker:${entry}`;
            },
            async load(id: string) {
                if (!id.startsWith('\0inline-worker:')) return undefined;
                const entry = id.slice('\0inline-worker:'.length);
                const out = await esbuild.build({
                    entryPoints: [entry],
                    bundle: true,
                    write: false,
                    format: 'iife',
                    platform: 'browser',
                    minify: false, // dev: fast + debuggable; the production build minifies
                    sourcemap: false,
                    target: 'es2020',
                });
                this.addWatchFile(entry);
                return `export default ${JSON.stringify(out.outputFiles?.[0]?.text ?? '')};`;
            },
        },
    ],
});

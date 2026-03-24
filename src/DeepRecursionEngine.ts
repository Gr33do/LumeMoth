import * as fs from 'fs';
import * as path from 'path';

export interface FileContext {
    filePath: string;
    content: string;
}

export class DeepRecursionEngine {
    private maxDepth: number;
    private projectRoot: string;

    constructor(projectRoot: string, maxDepth: number = 2) {
        this.maxDepth = maxDepth;
        this.projectRoot = projectRoot;
    }

    /**
     * Statically analyzes import/require statements and recursively extracts context.
     */
    public buildContext(targetFile: string, currentDepth: number = 0, visited: Set<string> = new Set()): FileContext[] {
        if (currentDepth >= this.maxDepth) return [];
        if (visited.has(targetFile)) return [];

        visited.add(targetFile);

        let content: string;
        try {
            content = fs.readFileSync(targetFile, 'utf-8');
        } catch (e) {
            return []; // Ignore unreadable files
        }

        const contexts: FileContext[] = [];

        // Identify local imports (rudimentary regex for static analysis)
        // Matches roughly: import { x } from './path', require('../path')
        const importRegex = /(?:import\s+.*?\s+from\s+|require\(\s*)(['"`])(\.[^'"`]+)\1/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            const relPath = match[2];
            const dir = path.dirname(targetFile);
            let resolvedPath = path.resolve(dir, relPath);

            // Append extensions if missing
            if (!fs.existsSync(resolvedPath)) {
                if (fs.existsSync(resolvedPath + '.ts')) resolvedPath += '.ts';
                else if (fs.existsSync(resolvedPath + '.js')) resolvedPath += '.js';
            }

            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
                // Ensure we don't escape the project root into external node_modules or system files
                if (resolvedPath.startsWith(this.projectRoot)) {
                    try {
                        const depContent = fs.readFileSync(resolvedPath, 'utf-8');
                        contexts.push({
                            filePath: path.relative(this.projectRoot, resolvedPath),
                            content: depContent
                        });
                        // Recurse deeper
                        contexts.push(...this.buildContext(resolvedPath, currentDepth + 1, visited));
                    } catch (e) {
                        // Ignored
                    }
                }
            }
        }

        // Deduplicate
        const unique = new Map<string, FileContext>();
        for (const ctx of contexts) {
            unique.set(ctx.filePath, ctx);
        }

        return Array.from(unique.values());
    }
}

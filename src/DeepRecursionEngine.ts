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
        this.projectRoot = path.resolve(projectRoot);
    }

    public buildContext(targetFile: string, currentDepth: number = 0, visited: Set<string> = new Set()): FileContext[] {
        if (currentDepth >= this.maxDepth) return [];
        if (visited.has(targetFile)) return [];

        const resolvedTarget = path.resolve(targetFile);
        if (!resolvedTarget.startsWith(this.projectRoot + path.sep)) {
            return [];
        }

        visited.add(resolvedTarget);

        let content: string;
        try {
            content = fs.readFileSync(resolvedTarget, 'utf-8');
        } catch (e) {
            return [];
        }

        const contexts: FileContext[] = [];

        const importRegex = /(?:import\s+.*?\s+from\s+|require\(\s*)(['"`])(\.[^'"`]+)\1/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            const relPath = match[2];
            const dir = path.dirname(resolvedTarget);
            let resolvedPath = path.resolve(dir, relPath);
            resolvedPath = path.normalize(resolvedPath);

            if (!resolvedPath.startsWith(this.projectRoot + path.sep)) {
                continue;
            }

            if (!fs.existsSync(resolvedPath)) {
                if (fs.existsSync(resolvedPath + '.ts')) resolvedPath += '.ts';
                else if (fs.existsSync(resolvedPath + '.js')) resolvedPath += '.js';
            }

            if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
                try {
                    const depContent = fs.readFileSync(resolvedPath, 'utf-8');
                    contexts.push({
                        filePath: path.relative(this.projectRoot, resolvedPath),
                        content: depContent
                    });
                    contexts.push(...this.buildContext(resolvedPath, currentDepth + 1, visited));
                } catch (e) {
                    // Ignored
                }
            }
        }

        const unique = new Map<string, FileContext>();
        for (const ctx of contexts) {
            unique.set(ctx.filePath, ctx);
        }

        return Array.from(unique.values());
    }
}

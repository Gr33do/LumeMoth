import * as ts from 'typescript';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

export class RefactorEngine {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = path.resolve(projectRoot);
    }

    public attemptDryRun(originalFilePath: string, newContent: string): boolean {
        const resolvedPath = path.resolve(originalFilePath);
        if (!resolvedPath.startsWith(this.projectRoot + path.sep)) {
            throw new Error('Invalid file path: outside project root');
        }

        const originalErrors = this.countSyntaxErrors(fs.readFileSync(resolvedPath, 'utf-8'), resolvedPath);

        const tmpExt = path.extname(resolvedPath) || '.ts';
        const randomId = crypto.randomBytes(8).toString('hex');
        const tmpFilePath = path.join(os.tmpdir(), `lumemoth_dryrun_${randomId}${tmpExt}`);

        let newErrors = 0;
        try {
            fs.writeFileSync(tmpFilePath, newContent, 'utf-8');
            newErrors = this.countSyntaxErrors(newContent, tmpFilePath);
        } finally {
            try {
                fs.unlinkSync(tmpFilePath);
            } catch (_) {
                // ignore
            }
        }

        return newErrors <= originalErrors;
    }

    private countSyntaxErrors(content: string, fileName: string): number {
        const src = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
        const diags: any[] = (src as any).parseDiagnostics || [];
        return diags.length;
    }

    public applyFix(filePath: string, newContent: string): void {
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(this.projectRoot + path.sep)) {
            throw new Error('Invalid file path: outside project root');
        }

        fs.writeFileSync(resolvedPath, newContent, 'utf-8');
    }
}

import * as ts from 'typescript';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class RefactorEngine {
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    /**
     * Validates refactored code via TypeScript syntax check BEFORE writing to disk.
     * Temp file is written to OS temp dir so the scanner never picks it up.
     */
    public attemptDryRun(originalFilePath: string, newContent: string): boolean {
        const originalErrors = this.countSyntaxErrors(fs.readFileSync(originalFilePath, 'utf-8'), originalFilePath);

        const tmpExt = path.extname(originalFilePath) || '.ts';
        const tmpFilePath = path.join(os.tmpdir(), `lumemoth_dryrun_${Date.now()}${tmpExt}`);

        let newErrors = 0;
        try {
            fs.writeFileSync(tmpFilePath, newContent, 'utf-8');
            newErrors = this.countSyntaxErrors(newContent, tmpFilePath);
        } finally {
            try { fs.unlinkSync(tmpFilePath); } catch (_) { /* ignore */ }
        }

        return newErrors <= originalErrors;
    }

    private countSyntaxErrors(content: string, fileName: string): number {
        const src = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
        const diags: any[] = (src as any).parseDiagnostics || [];
        return diags.length;
    }

    public applyFix(filePath: string, newContent: string): void {
        fs.writeFileSync(filePath, newContent, 'utf-8');
    }
}

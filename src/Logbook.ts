import * as fs from 'fs';
import * as path from 'path';

export class Logbook {
    private logsDir: string;

    constructor(projectRoot: string) {
        this.logsDir = path.join(projectRoot, '.lumemoth', 'logs');
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    /**
     * Writes a detailed technical explanation of the fix to the local logbook.
     */
    public appendLog(file: string, layer: string, problem: string, intent: string, explanation: string, line: number): void {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `log_${date}.md`);

        let existing = '';
        if (fs.existsSync(logFile)) {
            existing = fs.readFileSync(logFile, 'utf-8');
        } else {
            existing = `# 🦋 LumeMoth Technical Logbook\n\n*These logs explain logical intent and fixes executed by the AI engine.*\n\n`;
        }

        const timestamp = new Date().toLocaleTimeString();
        const entry = `## [${timestamp}] Fix in \`${file}\` (Line ${line})
**Layer:** \`${layer}\`

### Problem Identified
${problem}

### Developer's Original Intent
${intent}

### Technical Refactoring Strategy & Explanation
${explanation}

---
`;

        fs.writeFileSync(logFile, existing + entry, 'utf-8');
    }
}

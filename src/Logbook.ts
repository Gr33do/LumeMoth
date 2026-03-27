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

    public appendLog(file: string, layer: string, problem: string, intent: string, explanation: string, line: number): void {
        const date = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logsDir, `log_${date}.md`);

        let existing = '';
        if (fs.existsSync(logFile)) {
            existing = fs.readFileSync(logFile, 'utf-8');
        } else {
            existing = `# 🦋 LumeMoth Technical Logbook\n\n*These logs explain logical intent and fixes executed by the AI engine.*\n\n`;
        }

        const sanitize = (input: string, maxLen: number = 500): string => {
            return (input || '')
                .replace(/[\r\n]/g, ' ')
                .slice(0, maxLen);
        };

        const timestamp = new Date().toLocaleTimeString();
        const entry = `## [${timestamp}] Fix in \`${sanitize(file, 100)}\` (Line ${line})
**Layer:** \`${sanitize(layer, 50)}\`

### Problem Identified
${sanitize(problem, 500)}

### Developer's Original Intent
${sanitize(intent, 500)}

### Technical Refactoring Strategy & Explanation
${sanitize(explanation, 1000)}

---
`;

        fs.writeFileSync(logFile, existing + entry, 'utf-8');
    }
}

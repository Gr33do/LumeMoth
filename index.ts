import * as fs from 'fs';
import * as path from 'path';

// Bulletproof Imports (using require because chalk 4 ist CJS)
const inquirer = require('inquirer');
const chalk = require('chalk');
const clipboard = require('clipboardy');
const figures = require('figures');

// === 🦋 PREMIUM MOTH THEME ===
const THEME = {
    primary: chalk.hex('#B624FF'),    // Moth Purple
    glow: chalk.hex('#00F0FF'),       // Neon Cyan
    text: chalk.hex('#E2E8F0'),       // Clean White
    success: chalk.hex('#10B981'),    // Emerald Green
    warning: chalk.hex('#F59E0B'),    // Amber
    critical: chalk.hex('#EF4444'),   // Rose Red
    border: chalk.hex('#334155'),     // Slate
    dim: chalk.hex('#64748B'),        // Gray
};

const IGNORE_LIST = ['node_modules', '.git', 'dist', '.vscode', '.idea'];

// === 🧠 LOGIK-SCANNER ===
const PATTERNS = [
    {
        id: 'EMPTY_CATCH',
        regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
        severity: 'CRITICAL',
        problem: 'Silenced Error Handling (Empty Catch Block)',
        fixPreview: 'Injects an error logger into the empty brackets.',
        canAutoFix: true,
        fix: (content: string) => content.replace(/catch\s*\(([^)]*)\)\s*\{\s*\}/g, 'catch ($1) {\n        console.error("🦋 LumeMoth Auto-Fix: Error ->", $1);\n    }')
    },
    {
        id: 'DEBUG_LOG',
        regex: /^[ \t]*console\.log\(['"`].*?['"`]\);?$/gm,
        severity: 'WARNING',
        problem: 'Forgotten Console Log',
        fixPreview: 'Comments out the log to prevent it from reaching production.',
        canAutoFix: true,
        fix: (content: string) => content.replace(/^[ \t]*console\.log\(['"`].*?['"`]\);?$/gm, (match: string) => `// 🦋 LumeMoth disabled: ${match.trim()}`)
    }
];

const drawLine = () => console.info(THEME.border(figures.line.repeat(65)));
const getLineNumber = (text: string, index: number) => text.substring(0, index).split('\n').length;

// Interface for Tracking
interface IssueTrack {
    file: string;
    problem: string;
    line: number;
    autoFixed: boolean;
    patternId: string;
}

// Deep-Scan (Rekursion)
function walkDir(dir: string, callback: (filePath: string) => void) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (IGNORE_LIST.includes(file)) continue;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            walkDir(fullPath, callback);
        } else {
            callback(fullPath);
        }
    }
}

// === 🚀 MAIN ARCHITECT ===
async function run() {
    console.info(`\n${THEME.primary.bold(`   ${figures.play} L U M E   M O T H`)}  ${THEME.glow('v1.0')}`);
    console.info(THEME.dim('   High-End Project Architect & Auto-Fixer (Gr33do)\n'));
    drawLine();

    const trackedIssues: IssueTrack[] = [];
    const allFiles: string[] = [];

    // Sammle alle passenden Dateien (Start immer im cwd)
    walkDir(process.cwd(), (filePath) => {
        if (['.ts', '.js', '.py', '.java'].includes(path.extname(filePath))) {
            allFiles.push(filePath);
        }
    });

    const filesScanned = allFiles.length;
    let filesWithIssues = 0;

    for (const file of allFiles) {
        let content = fs.readFileSync(file, 'utf-8');
        let fileHasIssues = false;
        let issuesInFile: { pattern: any, line: number, matchText: string }[] = [];

        // Datei scannen
        for (const p of PATTERNS) {
            let match;
            while ((match = p.regex.exec(content)) !== null) {
                issuesInFile.push({ pattern: p, line: getLineNumber(content, match.index), matchText: match[0] });
                fileHasIssues = true;
            }
        }

        if (fileHasIssues) {
            filesWithIssues++;
            const relativePath = path.relative(process.cwd(), file);
            let fileModified = false;
            let currentContent = content;

            const remainingIssues = [];

            // 1. AUTO-HEALING für CRITICAL Fehler (ohne Nachfrage!)
            for (const issue of issuesInFile) {
                const isCrit = issue.pattern.severity === 'CRITICAL';

                if (isCrit && issue.pattern.canAutoFix) {
                    currentContent = issue.pattern.fix(currentContent);
                    fileModified = true;
                    trackedIssues.push({
                        file: relativePath,
                        problem: issue.pattern.problem,
                        line: issue.line,
                        autoFixed: true,
                        patternId: issue.pattern.id
                    });
                } else {
                    remainingIssues.push(issue);
                }
            }

            // Physikalisch auf Festplatte speichern wenn modifiziert
            if (fileModified) {
                fs.writeFileSync(file, currentContent, 'utf-8');
                content = currentContent; // Bereit für manuelle Fixes
            }

            // 2. MANUELLE DINGE ABFRAGEN (z.B. Warnings)
            if (remainingIssues.length > 0) {
                console.info(`\n ${figures.pointerSmall} ${THEME.glow.bold(relativePath)}`);

                for (const issue of remainingIssues) {
                    const color = THEME.warning;
                    const icon = figures.warning;

                    console.info(`    ${icon}  ${color.bold(issue.pattern.problem)} ${THEME.dim(`(Line ${issue.line})`)}`);

                    const { action } = await inquirer.prompt([{
                        type: 'list',
                        name: 'action',
                        message: THEME.text('How should we proceed?'),
                        prefix: THEME.glow('?'),
                        choices: [
                            ...(issue.pattern.canAutoFix ? [{ name: `${THEME.success(`${figures.tick} Auto-Fix:`)} ${THEME.dim(issue.pattern.fixPreview)}`, value: 'FIX' }] : []),
                            { name: `${THEME.warning(`${figures.info} Ticket:`)} ${THEME.dim('Copy GitHub Issue to clipboard')}`, value: 'TICKET' },
                            { name: THEME.dim(`${figures.arrowRight} Ignore & Continue`), value: 'SKIP' }
                        ]
                    }]);

                    if (action === 'FIX') {
                        content = issue.pattern.fix(content);
                        fs.writeFileSync(file, content, 'utf-8');
                        console.info(`    ${THEME.success(`${figures.tick} Code rewritten & saved!`)}\n`);
                        trackedIssues.push({
                            file: relativePath,
                            problem: issue.pattern.problem,
                            line: issue.line,
                            autoFixed: true,
                            patternId: issue.pattern.id
                        });
                    } else if (action === 'TICKET') {
                        clipboard.writeSync(`### 🦋 LumeMoth Report\n**File:** \`${relativePath}\`\n**Problem:** ${issue.pattern.problem}\n**Line:** ${issue.line}`);
                        console.info(`    ${THEME.success(`${figures.tick} Ticket copied to clipboard!`)}\n`);
                        trackedIssues.push({
                            file: relativePath,
                            problem: issue.pattern.problem,
                            line: issue.line,
                            autoFixed: false,
                            patternId: issue.pattern.id
                        });
                    } else {
                        trackedIssues.push({
                            file: relativePath,
                            problem: issue.pattern.problem,
                            line: issue.line,
                            autoFixed: false,
                            patternId: issue.pattern.id
                        });
                    }
                }
                drawLine();
            }
        }
    }

    // === 🏆 VISUAL DASHBOARD ===
    console.info('\n');
    console.info(THEME.primary.bold(`   ${figures.hamburger}  S C A N   R E P O R T  ${figures.hamburger}`));
    console.info(THEME.border(`  ╭${figures.line.repeat(60)}╮`));

    console.info(`  ${THEME.border('│')}  ${THEME.text('Scanned Files: ')} ${THEME.glow(filesScanned.toString().padEnd(41))} ${THEME.border('│')}`);
    console.info(`  ${THEME.border('│')}  ${THEME.text('Affected Files:')} ${THEME.warning(filesWithIssues.toString().padEnd(41))} ${THEME.border('│')}`);

    const autoFixedCount = trackedIssues.filter(i => i.autoFixed).length;
    const pendingCount = trackedIssues.length - autoFixedCount;

    console.info(`  ${THEME.border('│')}  ${THEME.text('Auto-Healed:   ')} ${THEME.success(autoFixedCount.toString().padEnd(41))} ${THEME.border('│')}`);
    console.info(`  ${THEME.border('│')}  ${THEME.text('Pending:       ')} ${THEME.critical(pendingCount.toString().padEnd(41))} ${THEME.border('│')}`);
    console.info(THEME.border(`  ╰${figures.line.repeat(60)}╯`));

    if (trackedIssues.length > 0) {
        console.info(`\n  ${THEME.primary.bold('Detailed Fixes:')}`);
        for (const issue of trackedIssues) {
            const statusIcon = issue.autoFixed ? THEME.success(figures.tick) : THEME.warning(figures.cross);
            const statusText = issue.autoFixed ? THEME.success('Healed ') : THEME.critical('Pending');
            console.info(`    ${statusIcon} [${statusText}] ${THEME.glow(issue.file)}:${THEME.dim(issue.line.toString())} - ${THEME.text(issue.problem)}`);
        }
        console.info('\n');
    } else {
        console.info(`\n   ${THEME.success(`✨ ${chalk.bold('ALL CLEAR!')} LumeMoth found no bugs.`)}`);
        console.info(`   ${THEME.success(`Flawless code. Ready for release.`)}\n`);
    }
}

const args = process.argv.slice(2);
if (args[0] === 'fly' || args.length === 0) {
    run().catch(e => console.error(THEME.critical("\n[FATAL ERROR]"), e));
} else {
    console.info(THEME.text('\n🦋 Usage: ') + THEME.primary.bold('moth fly') + '\n');
}
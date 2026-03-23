import * as fs from 'fs';
import * as path from 'path';

// Bulletproof Imports
const inquirer = require('inquirer');
const chalk = require('chalk');
const clipboard = require('clipboardy');

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

const IGNORE_LIST = ['node_modules', '.git', 'dist', '.vscode'];

// === 🧠 LOGIK-SCANNER ===
const PATTERNS = [
    {
        id: 'EMPTY_CATCH',
        regex: /catch\s*\([^)]*\)\s*\{\s*\}/g,
        severity: 'CRITICAL',
        problem: 'Silenced Error Handling (Leerer Catch-Block)',
        fixPreview: 'Fügt einen Error-Logger in die leeren Klammern ein.',
        canAutoFix: true,
        fix: (content: string) => content.replace(/catch\s*\(([^)]*)\)\s*\{\s*\}/g, 'catch ($1) {\n        console.error("🦋 LumeMoth Auto-Fix: Error ->", $1);\n    }')
    },
    {
        id: 'DEBUG_LOG',
        regex: /^[ \t]*console\.log\(['"`].*?['"`]\);?$/gm,
        severity: 'WARNING',
        problem: 'Vergessener Konsolen-Log',
        fixPreview: 'Kommentiert den Log aus, damit er nicht in Produktion geht.',
        canAutoFix: true,
        fix: (content: string) => content.replace(/^[ \t]*console\.log\(['"`].*?['"`]\);?$/gm, (match: string) => `// 🦋 LumeMoth disabled: ${match.trim()}`)
    }
];

const drawLine = () => console.log(THEME.border('━'.repeat(65)));
const getLineNumber = (text: string, index: number) => text.substring(0, index).split('\n').length;

// === 🚀 MAIN ARCHITECT ===
async function run() {
    console.clear();
// 🦋 LumeMoth disabled: console.log(`\n${THEME.primary.bold('   🦋 L U M E   M O T H')}  ${THEME.glow('v1.0')}`);
    console.log(THEME.dim('   High-End Project Architect & Auto-Fixer\n'));
    drawLine();

    let issueCount = 0;
    const files = fs.readdirSync(process.cwd());

    for (const file of files) {
        if (IGNORE_LIST.includes(file) || fs.statSync(file).isDirectory()) continue;
        if (!['.ts', '.js', '.py', '.java'].includes(path.extname(file))) continue;

        let content = fs.readFileSync(file, 'utf-8');
        let fileHasIssues = false;
        let issuesInFile: any[] = [];

        // Datei scannen
        for (const p of PATTERNS) {
            let match;
            while ((match = p.regex.exec(content)) !== null) {
                issuesInFile.push({ pattern: p, line: getLineNumber(content, match.index), matchText: match[0] });
                issueCount++;
                fileHasIssues = true;
            }
        }

        // Probleme anzeigen & beheben
        if (fileHasIssues) {
// 🦋 LumeMoth disabled: console.log(`\n 📄 ${THEME.glow.bold(file)}`);
            
            for (const issue of issuesInFile) {
                const isCrit = issue.pattern.severity === 'CRITICAL';
                const color = isCrit ? THEME.critical : THEME.warning;
                const icon = isCrit ? '❌' : '⚠️';
                
// 🦋 LumeMoth disabled: console.log(`    ${icon}  ${color.bold(issue.pattern.problem)} ${THEME.dim(`(Zeile ${issue.line})`)}`);
                
                const { action } = await inquirer.prompt([{
                    type: 'list',
                    name: 'action',
                    message: THEME.text('Wie sollen wir vorgehen?'),
                    prefix: THEME.glow('?'),
                    choices: [
                        { name: `${THEME.success('✨ Auto-Fix:')} ${THEME.dim(issue.pattern.fixPreview)}`, value: 'FIX' },
                        { name: `${THEME.warning('🎫 Ticket:')} ${THEME.dim('GitHub Issue in Zwischenablage kopieren')}`, value: 'TICKET' },
                        { name: THEME.dim('⏭️  Ignorieren & Weiter'), value: 'SKIP' }
                    ]
                }]);

                if (action === 'FIX' && issue.pattern.canAutoFix) {
                    // HIER PASSIERT DIE MAGIE: Code überschreiben und physisch speichern!
                    content = issue.pattern.fix(content);
                    fs.writeFileSync(file, content, 'utf-8');
// 🦋 LumeMoth disabled: console.log(`    ${THEME.success('✔ Code wurde erfolgreich umgeschrieben und Datei gespeichert!')}\n`);
                } else if (action === 'TICKET') {
                    clipboard.writeSync(`### 🦋 LumeMoth Report\n**Datei:** \`${file}\`\n**Problem:** ${issue.pattern.problem}`);
// 🦋 LumeMoth disabled: console.log(`    ${THEME.success('✔ Ticket in Zwischenablage kopiert!')}\n`);
                }
            }
            drawLine();
        }
    }

    // === 🏆 PERFEKTIONS-SCREEN (Keine Bugs) ===
    if (issueCount === 0) {
// 🦋 LumeMoth disabled: console.log(`\n${THEME.success('   ╭────────────────────────────────────────────────────────╮')}`);
// 🦋 LumeMoth disabled: console.log(`${THEME.success('   │')}                                                        ${THEME.success('│')}`);
// 🦋 LumeMoth disabled: console.log(`${THEME.success('   │')}   ✨ ${chalk.bold('ALL CLEAR!')} LumeMoth konnte keine Bugs finden.   ${THEME.success('│')}`);
// 🦋 LumeMoth disabled: console.log(`${THEME.success('   │')}   Dein Code ist makellos und bereit für den Release.   ${THEME.success('│')}`);
// 🦋 LumeMoth disabled: console.log(`${THEME.success('   │')}                                                        ${THEME.success('│')}`);
// 🦋 LumeMoth disabled: console.log(`${THEME.success('   ╰────────────────────────────────────────────────────────╯')}\n`);
    } else {
// 🦋 LumeMoth disabled: console.log(`\n${THEME.text(`   Scan beendet. ${THEME.glow(issueCount)} Probleme gefunden.`)}\n`);
    }
}

run().catch(e => console.error(THEME.critical("\n[FATAL ERROR]"), e));
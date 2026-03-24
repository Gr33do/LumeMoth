import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const inquirer = require('inquirer');
const chalk = require('chalk');
const clipboard = require('clipboardy');
const figures = require('figures');

import { AnalysisEngine, LumeIssue } from './src/AIEngine';
import { DeepRecursionEngine } from './src/DeepRecursionEngine';
import { RefactorEngine } from './src/RefactorEngine';
import { Logbook } from './src/Logbook';
import { TicketManager } from './src/TicketManager';

// ── Palette ────────────────────────────────────────────────────────────────────
const T = {
    primary: chalk.hex('#B624FF'),
    glow: chalk.hex('#00F0FF'),
    text: chalk.hex('#E2E8F0'),
    success: chalk.hex('#10B981'),
    warning: chalk.hex('#F59E0B'),
    critical: chalk.hex('#EF4444'),
    border: chalk.hex('#334155'),
    dim: chalk.hex('#64748B'),
    purple2: chalk.hex('#7C3AED'),
    cyan2: chalk.hex('#06B6D4'),
};

const LAYER_COLORS: Record<string, any> = {
    SYNTAX: chalk.hex('#EF4444'),
    SEMANTICS: chalk.hex('#F59E0B'),
    SECURITY: chalk.hex('#FF4D6D'),
    PERFORMANCE: chalk.hex('#06B6D4'),
};
const LAYER_ICONS: Record<string, string> = {
    SYNTAX: '⛔', SEMANTICS: '🧠', SECURITY: '🔒', PERFORMANCE: '⚡',
};
const SEV_COLORS: Record<string, any> = {
    CRITICAL: chalk.hex('#EF4444').bold,
    WARNING: chalk.hex('#F59E0B').bold,
    INFO: chalk.hex('#64748B').bold,
};

// ── Box drawing helpers ─────────────────────────────────────────────────────────
const W = 66;
const hline = (w = W) => T.border('─'.repeat(w));
const topBar = () => T.border('╭' + '─'.repeat(W) + '╮');
const botBar = () => T.border('╰' + '─'.repeat(W) + '╯');
const midBar = () => T.border('├' + '─'.repeat(W) + '┤');

function row(content: string, w = W): string {
    const raw = content.replace(/\x1B\[[0-9;]*m/g, '');
    const pad = Math.max(0, w - raw.length);
    return T.border('│') + content + ' '.repeat(pad) + T.border('│');
}

// ── Walker ─────────────────────────────────────────────────────────────────────
const IGNORE = ['node_modules', '.git', 'dist', '.vscode', '.idea', '.lumemoth', '.github', 'lumemoth', 'LumeMoth'];
function walkDir(dir: string, cb: (f: string) => void) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (IGNORE.some(ig => file.toLowerCase() === ig.toLowerCase())) continue;
        if (fs.statSync(full).isDirectory()) walkDir(full, cb);
        else if (/\.(ts|js|tsx|jsx)$/.test(file)) cb(full);
    }
}

// ── Spinner ─────────────────────────────────────────────────────────────────────
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
function spinner(msg: string) {
    let i = 0;
    const iv = setInterval(() => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`  ${T.glow(FRAMES[i++ % FRAMES.length])}  ${T.dim(msg)}`);
    }, 80);
    return () => {
        clearInterval(iv);
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
async function run() {
    // ── Banner ───────────────────────────────────────────────────────────────────
    console.info('\n');
    console.info(topBar());
    console.info(row(''));
    console.info(row('  ' + T.primary.bold('██╗     ██╗   ██╗███╗   ███╗███████╗')));
    console.info(row('  ' + T.primary.bold('██║     ██║   ██║████╗ ████║██╔════╝')));
    console.info(row('  ' + T.primary.bold('██║     ██║   ██║██╔████╔██║█████╗  ')));
    console.info(row('  ' + T.purple2.bold('██║     ██║   ██║██║╚██╔╝██║██╔══╝  ')));
    console.info(row('  ' + T.purple2.bold('███████╗╚██████╔╝██║ ╚═╝ ██║███████╗')));
    console.info(row('  ' + T.purple2.bold('╚══════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝')));
    console.info(row(''));
    console.info(row('  ' + T.cyan2.bold('███╗   ███╗ ██████╗ ████████╗██╗  ██╗')));
    console.info(row('  ' + T.cyan2.bold('████╗ ████║██╔═══██╗╚══██╔══╝██║  ██║')));
    console.info(row('  ' + T.glow.bold('██╔████╔██║██║   ██║   ██║   ███████║')));
    console.info(row('  ' + T.glow.bold('██║╚██╔╝██║██║   ██║   ██║   ██╔══██║')));
    console.info(row('  ' + T.glow.bold('██║ ╚═╝ ██║╚██████╔╝   ██║   ██║  ██║')));
    console.info(row('  ' + T.glow.bold('╚═╝     ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝')));
    console.info(row(''));
    console.info(row('  ' + T.dim('Multi-Layer Static Analysis Engine') + T.border('  ·  ') + T.glow('v1.1')));
    console.info(row('  ' + T.dim('Syntax  ·  Semantics  ·  Security  ·  Performance')));
    console.info(row(''));
    console.info(botBar());
    console.info('');

    // ── Mode selection ────────────────────────────────────────────────────────────
    const { mode } = await inquirer.prompt([{
        type: 'list', name: 'mode',
        message: T.text('Select scan mode'),
        prefix: T.primary('🦋'),
        choices: [
            { name: T.success('⚡  Auto-Fix Mode  ') + T.dim('     — Fix ALL auto-fixable issues, save tickets for the rest'), value: 'auto' },
            { name: T.glow('🔍  Interactive Mode') + T.dim('     — Review each issue and choose: Fix / Ticket / Skip'), value: 'interactive' },
            { name: T.cyan2('📋  Report Only    ') + T.dim('     — Scan only, save issue templates, write nothing'), value: 'report' },
        ]
    }]);

    const isAuto = mode === 'auto';
    const isReport = mode === 'report';
    console.info('');

    // ── Engines ────────────────────────────────────────────────────────────────────
    const projectRoot = process.cwd();
    const analysisEngine = new AnalysisEngine();
    const recursionEngine = new DeepRecursionEngine(projectRoot, 2);
    const refactorEngine = new RefactorEngine(projectRoot);
    const logbook = new Logbook(projectRoot);
    const ticketManager = new TicketManager(projectRoot);

    // ── Collect files ──────────────────────────────────────────────────────────────
    const allFiles: string[] = [];
    walkDir(projectRoot, (f) => {
        if (['.ts', '.js', '.jsx', '.tsx'].includes(path.extname(f))) allFiles.push(f);
    });

    const tracked: { file: string; problem: string; layer: string; sev: string; autoFixed: boolean; status: string }[] = [];
    let filesWithIssues = 0;

    // ── Header ─────────────────────────────────────────────────────────────────────
    console.info(topBar());
    console.info(row(' ' + T.primary.bold('SCAN INITIALISED') + T.border('  ─────────────────────────────────────')));
    console.info(midBar());
    const modeLabel = isAuto ? T.success('Auto-Fix') : isReport ? T.cyan2('Report Only') : T.glow('Interactive');
    console.info(row(` ${T.dim('Files:')} ${T.glow(String(allFiles.length).padEnd(6))}  ${T.dim('Mode:')} ${modeLabel}`));
    console.info(row(` ${T.dim('Root: ')} ${T.text(projectRoot.slice(-(W - 8)))}`));
    console.info(botBar());
    console.info('');

    // ═══════════════════════════════════════════════════════════════════════════════
    //                             FILE SCAN LOOP
    // ═══════════════════════════════════════════════════════════════════════════════
    for (const file of allFiles) {
        const rel = path.relative(projectRoot, file);
        const content = fs.readFileSync(file, 'utf-8');
        const ctx = recursionEngine.buildContext(file);

        const stop = spinner(`Analyzing ${rel}`);
        const analysis = analysisEngine.analyze(file, content, ctx);
        stop();

        if (analysis.isFlawless) {
            console.info(`  ${T.success(figures.tick)}  ${T.dim(rel)}`);
            continue;
        }

        filesWithIssues++;
        console.info('');
        console.info(topBar());
        console.info(row(` ${T.warning(figures.warning)}  ${T.glow.bold(rel)}  ${T.dim(`· ${analysis.issues.length} issue${analysis.issues.length !== 1 ? 's' : ''}`)}`));
        console.info(midBar());

        for (const issue of analysis.issues) {
            const lc = LAYER_COLORS[issue.layer] || T.dim;
            const icon = LAYER_ICONS[issue.layer] || '◆';
            const sc = SEV_COLORS[issue.severity] || T.dim;
            console.info(row(`  ${icon} ${lc(issue.layer.padEnd(12))} ${sc(issue.severity.padEnd(9))} Line ${T.dim(String(issue.line).padEnd(5))} ${T.text(issue.problem.slice(0, 25))}`));
        }
        console.info(botBar());

        let current = content;

        // ═══ AUTO-FIX MODE ════════════════════════════════════════════════════════
        if (isAuto) {
            let healed = 0;
            for (const issue of analysis.issues) {
                if (issue.canAutoFix && issue.fix) {
                    const fixed = issue.fix(current);
                    // Guard: only apply if the fix actually changed something
                    if (fixed === current) {
                        tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'No Match' });
                        continue;
                    }
                    if (refactorEngine.attemptDryRun(file, fixed)) {
                        current = fixed;
                        healed++;
                        logbook.appendLog(rel, issue.layer, issue.problem, issue.intent, issue.explanation, issue.line);
                        tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: true, status: 'Auto-Healed' });
                    } else {
                        tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'Dry-Run Failed' });
                    }
                } else {
                    ticketManager.writeTemplate(issue, rel);
                    tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'Ticket Saved' });
                }
            }
            if (healed > 0) {
                refactorEngine.applyFix(file, current);
                console.info(`  ${T.success(figures.tick)}  ${T.success.bold(String(healed))} fix${healed !== 1 ? 'es' : ''} applied → ${T.glow(rel)}`);
            }
            const unfixable = analysis.issues.filter(i => !i.canAutoFix).length;
            if (unfixable > 0) console.info(`  ${T.warning(figures.info)}  ${unfixable} issue${unfixable !== 1 ? 's' : ''} require manual review — tickets saved.`);
            console.info('');
            continue;
        }

        // ═══ REPORT MODE ═══════════════════════════════════════════════════════════
        if (isReport) {
            for (const issue of analysis.issues) {
                const mdPath = ticketManager.writeTemplate(issue, rel);
                tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'Ticket Saved' });
                console.info(`  ${T.cyan2(figures.info)}  ${T.dim('Ticket →')} ${T.cyan2(path.relative(projectRoot, mdPath))}`);
            }
            console.info('');
            continue;
        }

        // ═══ INTERACTIVE MODE ═════════════════════════════════════════════════════
        for (const issue of analysis.issues) {
            const lc = LAYER_COLORS[issue.layer] || T.dim;
            const icon = LAYER_ICONS[issue.layer] || '◆';
            const sc = SEV_COLORS[issue.severity] || T.dim;

            console.info('');
            console.info(topBar());
            console.info(row(` ${icon}  ${lc(issue.layer)}   ${sc(issue.severity)}   ${T.dim('Line ' + issue.line)}`));
            console.info(midBar());
            console.info(row(' ' + T.text.bold(issue.problem.slice(0, W - 2))));
            console.info(row(''));
            console.info(row(' ' + T.dim('Intent → ') + T.text(issue.intent.slice(0, W - 11))));
            console.info(row(''));
            console.info(row(' ' + T.dim(issue.explanation.slice(0, W - 2))));
            if (issue.explanation.length > W - 2) {
                console.info(row(' ' + T.dim(issue.explanation.slice(W - 2, (W - 2) * 2))));
            }
            console.info(botBar());
            console.info('');

            const choices: any[] = [];
            if (issue.canAutoFix && issue.fix) {
                choices.push({ name: T.success('⚡  Fix it') + T.dim('       — apply a dry-run validated refactor & save'), value: 'FIX' });
            }
            choices.push({ name: T.warning('🎫  Ticket') + T.dim('      — generate a GitHub issue template + clipboard'), value: 'TICKET' });
            choices.push({ name: T.dim('⏭   Skip'), value: 'SKIP' });

            const { action } = await inquirer.prompt([{
                type: 'list', name: 'action',
                message: T.text('  What should LumeMoth do?'),
                prefix: T.glow('  ?'),
                choices
            }]);

            if (action === 'FIX' && issue.canAutoFix && issue.fix) {
                const fixed = issue.fix(current);
                if (refactorEngine.attemptDryRun(file, fixed)) {
                    refactorEngine.applyFix(file, fixed);
                    current = fixed;
                    logbook.appendLog(rel, issue.layer, issue.problem, issue.intent, issue.explanation, issue.line);
                    console.info(`  ${T.success(figures.tick)}  ${T.success('Fix applied & saved!')}`);
                    tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: true, status: 'Fixed' });
                } else {
                    console.info(`  ${T.critical(figures.cross)}  Dry-run failed — no changes written.`);
                    tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'Dry-Run Failed' });
                }
            } else if (action === 'TICKET') {
                const created = ticketManager.createRemoteIssue(issue, rel);
                if (created) {
                    console.info(`  ${T.success(figures.tick)}  GitHub issue created!`);
                } else {
                    const mdPath = ticketManager.writeTemplate(issue, rel);
                    clipboard.writeSync(fs.readFileSync(mdPath, 'utf8'));
                    console.info(`  ${T.warning(figures.info)}  Ticket saved & copied to clipboard.`);
                }
                tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'Ticket' });
            } else {
                tracked.push({ file: rel, problem: issue.problem, layer: issue.layer, sev: issue.severity, autoFixed: false, status: 'Skipped' });
            }
            console.info('');
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    //                           FINAL DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════════
    const healed = tracked.filter(i => i.autoFixed).length;
    const pending = tracked.length - healed;

    console.info('\n');
    console.info(topBar());
    console.info(row(''));
    console.info(row('  ' + T.primary.bold('⬡  MOTH SCAN COMPLETE  ⬡')));
    console.info(row(''));
    console.info(midBar());
    console.info(row(''));
    console.info(row(
        `  ${T.dim('Files scanned')} ${T.glow(String(allFiles.length).padEnd(4))}` +
        `  ${T.dim('Affected')} ${T.warning(String(filesWithIssues).padEnd(4))}` +
        `  ${T.dim('Healed')} ${T.success(String(healed).padEnd(4))}` +
        `  ${T.dim('Pending')} ${T.critical(String(pending))}`
    ));
    console.info(row(''));

    if (tracked.length > 0) {
        console.info(midBar());
        console.info(row(''));
        console.info(row(`  ${T.primary.bold('RESULTS BY LAYER')}`));
        console.info(row(''));

        for (const layer of ['SYNTAX', 'SEMANTICS', 'SECURITY', 'PERFORMANCE'] as const) {
            const group = tracked.filter(i => i.layer === layer);
            if (!group.length) continue;
            const lc = LAYER_COLORS[layer];
            const icon = LAYER_ICONS[layer];
            console.info(row(`  ${icon}  ${lc(layer)}`));
            for (const t of group) {
                const dot = t.autoFixed ? T.success('✔') : T.warning('◌');
                const label = (t.autoFixed ? T.success(t.status) : T.warning(t.status)).padEnd(20);
                const prob = T.dim(t.problem.slice(0, 24).padEnd(24));
                const file = T.dim('  ' + t.file.slice(-20));
                console.info(row(`     ${dot}  ${label}  ${prob}${file}`));
            }
            console.info(row(''));
        }
    } else {
        console.info(midBar());
        console.info(row(''));
        console.info(row(`  ${T.success.bold('✨  ALL CLEAR')}  ${T.success('Your code is clean across all 4 layers.')}`));
        console.info(row(''));
        console.info(row(`  ${T.dim('No issues found. LumeMoth gives this codebase a perfect score.')}`));
        console.info(row(''));
    }

    console.info(botBar());
    console.info('');
}

const args = process.argv.slice(2);
if (args[0] === 'fly' || args.length === 0) {
    run().catch(e => console.error(chalk.hex('#EF4444')('\n[FATAL ERROR]'), e));
} else {
    console.info(chalk.hex('#E2E8F0')('\n🦋 Usage: ') + chalk.hex('#B624FF').bold('moth fly') + '\n');
}
import * as ts from 'typescript';
import * as path from 'path';
import { FileContext } from './DeepRecursionEngine';

export interface LumeIssue {
    layer: 'SYNTAX' | 'SEMANTICS' | 'SECURITY' | 'PERFORMANCE';
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    problem: string;
    intent: string;
    explanation: string;
    line: number;
    canAutoFix: boolean;
    fix?: (content: string) => string;
}

export interface AIAnalysisResult {
    issues: LumeIssue[];
    rewrittenFile: string;
    isFlawless: boolean;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Strip lines before analysis that we should NEVER flag:
 * - Lines that are pure comments (// or /* or *)
 * - Lines already patched by LumeMoth (contain [LumeMoth])
 * - Lines where the code is a regex literal definition (starts with `regex:` or contains `= /`)
 * - Lines that are just string declarations containing the sensitive keyword
 * All replaced with empty strings to preserve accurate line numbers.
 */
function stripCommentedLines(content: string): string {
    return content
        .split('\n')
        .map(line => {
            const t = line.trimStart();
            // Already-patched lines
            if (t.includes('[LumeMoth]')) return '';
            // Comment lines
            if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return '';
            // Lines that define regex literals (regex rule definitions, should not be flagged)
            if (/regex\s*:\s*\//.test(line)) return '';
            // Lines where pattern only appears inside a regex literal: /pattern/
            if (/^\.?\s*\/.*\/[gimsuy]*[,;]?$/.test(t)) return '';
            return line;
        })
        .join('\n');
}

function lineOf(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
}

// ─── LAYER 1 – SYNTAX ─────────────────────────────────────────────────────────
function analyzeSyntax(filePath: string, content: string): LumeIssue[] {
    const issues: LumeIssue[] = [];
    const srcFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
    const diags: readonly ts.DiagnosticWithLocation[] = (srcFile as any).parseDiagnostics || [];
    for (const d of diags) {
        const line = srcFile.getLineAndCharacterOfPosition(d.start ?? 0).line + 1;
        issues.push({
            layer: 'SYNTAX', severity: 'CRITICAL',
            problem: ts.flattenDiagnosticMessageText(d.messageText, ' '),
            intent: 'Code was written with correct semantics in mind but contains a syntactic error.',
            explanation: `TypeScript parser reported a syntax error at line ${line}. Syntactic errors prevent the runtime from evaluating this file at all.`,
            line, canAutoFix: false
        });
    }
    return issues;
}

// ─── LAYER 2 – SEMANTICS ──────────────────────────────────────────────────────
function analyzeSemantics(filePath: string, content: string): LumeIssue[] {
    const issues: LumeIssue[] = [];
    const srcFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    // AST visitor — empty catch blocks
    function visit(node: ts.Node) {
        if (ts.isCatchClause(node) && node.block.statements.length === 0) {
            const line = srcFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            issues.push({
                layer: 'SEMANTICS', severity: 'CRITICAL',
                problem: 'Empty catch block silences all errors',
                intent: 'Developer wanted error guarding but forgot to handle the caught exception.',
                explanation: 'An empty catch block swallows all exceptions silently. Add at minimum a console.error call so errors are visible during debugging and in production logs.',
                line, canAutoFix: true,
                fix: (c: string) => c.replace(
                    /catch\s*\(([^)]*)\)\s*\{[\s\S]{0,100}?\}/g,
                    'catch ($1) {\n        console.error(\'[LumeMoth] Unhandled error:\', $1);\n    }'
                )
            });
        }
        ts.forEachChild(node, visit);
    }
    visit(srcFile);

    // Regex-based semantic checks on non-commented content
    const stripped = stripCommentedLines(content);
    const lines = content.split('\n'); // original for line numbers

    stripped.split('\n').forEach((lineText, idx) => {
        const ln = idx + 1;
        const trimmed = lineText.trim();
        if (!trimmed) return;

        // TODO / FIXME markers
        if (/^\s*(\/\/|\/\*)\s*(TODO|FIXME|HACK|XXX)/i.test(lines[idx])) {
            issues.push({
                layer: 'SEMANTICS', severity: 'INFO',
                problem: `Unresolved marker: ${lines[idx].trim().substring(0, 55)}`,
                intent: 'Developer left a work-in-progress note signalling incomplete logic.',
                explanation: 'TODO/FIXME markers indicate unfinished or broken logic. Resolve before production deployment.',
                line: ln, canAutoFix: true,
                fix: (c: string) => {
                    const l = c.split('\n');
                    l[idx] = l[idx].replace(/\b(TODO|FIXME|HACK|XXX)\b/g, `// [LumeMoth Resolved ${new Date().toISOString().split('T')[0]}] $1`);
                    return l.join('\n');
                }
            });
        }

        // while(true) without break
        if (/while\s*\(\s*true\s*\)/.test(lineText)) {
            const block = stripped.split('\n').slice(idx, Math.min(idx + 30, lines.length)).join('\n');
            if (!/break\s*;/.test(block) && !/return/.test(block)) {
                issues.push({
                    layer: 'SEMANTICS', severity: 'CRITICAL',
                    problem: 'Potential infinite loop: while(true) with no explicit exit',
                    intent: 'Developer intended a polling or retry loop but omitted an exit condition.',
                    explanation: 'A while(true) without a break/return will block the event loop indefinitely, hanging the process.',
                    line: ln, canAutoFix: true,
                    fix: (c: string) => {
                        const linesArr = c.split('\n');
                        // Use exact line index from the loop
                        linesArr[idx] = linesArr[idx].replace(/while\s*\(\s*true\s*\)\s*\{?/, '$0 /* [LumeMoth Safety] */ if (globalThis.__ls > 10000) break; globalThis.__ls = (globalThis.__ls || 0) + 1; ');
                        return linesArr.join('\n');
                    }
                });
            }
        }

        // Callback hell
        if (/\)\s*=>\s*\{/.test(lineText) && (lineText.match(/=>/g) || []).length >= 3) {
            issues.push({
                layer: 'SEMANTICS', severity: 'WARNING',
                problem: 'Deeply nested arrow functions detected (callback hell)',
                intent: 'Developer chained multiple async operations without async/await.',
                explanation: 'Deeply nested callbacks reduce readability and make error propagation difficult. Refactor with async/await.',
                line: ln, canAutoFix: true,
                fix: (c: string) => {
                    const l = c.split('\n');
                    l[idx] += ' // [LumeMoth Refactor] Callback hell detected, consider flattening.';
                    return l.join('\n');
                }
            });
        }
    });

    return issues;
}

// ─── LAYER 3 – SECURITY ───────────────────────────────────────────────────────
const SECURITY_RULES: {
    id: string; regex: RegExp; problem: string; severity: LumeIssue['severity'];
    intent: string; explanation: string; canAutoFix: boolean; fix?: (c: string) => string;
}[] = [
        {
            id: 'hardcoded-secret',
            regex: /(?:password|secret|token|api_?key|apikey|pwd|pass)\s*[:=]\s*['"`][^'"`]{3,}['"`]/i,
            problem: 'Hardcoded secret or credential detected',
            severity: 'CRITICAL',
            intent: 'Developer hardcoded a credential for quick testing or convenience.',
            explanation: 'Hardcoded credentials are a critical vulnerability. Externalize into environment variables.',
            canAutoFix: true,
            fix: (c: string) => c.replace(/(password|secret|token|api_?key|apikey|pwd|pass)(\s*[:=]\s*)['"`][^'"`]{3,}['"`]/gi, '$1$2process.env.$1 || "REDACTED" // [LumeMoth Secrets Fix]')
        },
        {
            id: 'eval',
            regex: /(?<![.\w])eval\s*\(/,
            problem: 'Dangerous eval() call detected',
            severity: 'CRITICAL',
            intent: 'Developer wanted to execute dynamic code at runtime.',
            explanation: 'eval() executes arbitrary code and opens an RCE vector.',
            canAutoFix: true,
            fix: (c: string) => c.replace(/eval\s*\(/g, '// [LumeMoth Security] eval removed: eval(')
        },
        {
            id: 'new-function',
            regex: /new\s+Function\s*\(/,
            problem: 'Dynamic function construction via new Function()',
            severity: 'CRITICAL',
            intent: 'Developer attempted to construct executable logic dynamically.',
            explanation: 'new Function() is functionally equivalent to eval().',
            canAutoFix: true,
            fix: (c: string) => c.replace(/new\s+Function\s*\(/g, '// [LumeMoth Security] new Function removed: new Function(')
        },
        {
            id: 'innerHTML',
            regex: /innerHTML\s*=/,
            problem: 'Direct innerHTML assignment — XSS risk',
            severity: 'CRITICAL',
            intent: 'Developer set HTML content dynamically to render rich UI elements.',
            explanation: 'Assigning to innerHTML creates an XSS vector. Use textContent.',
            canAutoFix: true,
            fix: (c: string) => c.replace(/\.innerHTML\s*=\s*/g, '.textContent = ')
        },
        {
            id: 'http-plain',
            regex: /['"`]http:\/\/(?!localhost|127\.0\.0\.1)[^'"`]+['"`]/i,
            problem: 'Outgoing request uses plain HTTP (not HTTPS)',
            severity: 'WARNING',
            intent: 'Developer made a network request to an external service.',
            explanation: 'Plain HTTP transmits data unencrypted. Always use HTTPS.',
            canAutoFix: true,
            fix: (c: string) => c.replace(/(['"`])http:\/\/(?!localhost|127\.0\.0\.1)/gi, '$1https://')
        },
        {
            id: 'math-random-security',
            regex: /Math\.random\s*\(\s*\)/,
            problem: 'Math.random() is not cryptographically secure',
            severity: 'INFO',
            intent: 'Developer needed a random value.',
            explanation: 'Math.random() is unsuitable for security contexts. Use crypto.',
            canAutoFix: true,
            fix: (c: string) => c.replace(/Math\.random\s*\(\s*\)/g, '(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967295) // [LumeMoth Security] C-PRNG')
        }
    ];

function analyzeSecurity(content: string): LumeIssue[] {
    const issues: LumeIssue[] = [];
    const stripped = stripCommentedLines(content);

    for (const rule of SECURITY_RULES) {
        const match = rule.regex.exec(stripped);
        if (match) {
            const line = lineOf(stripped, match.index);
            issues.push({
                layer: 'SECURITY', severity: rule.severity,
                problem: rule.problem, intent: rule.intent,
                explanation: rule.explanation, line,
                canAutoFix: rule.canAutoFix, fix: rule.fix
            });
        }
    }
    return issues;
}

// ─── LAYER 4 – PERFORMANCE ────────────────────────────────────────────────────
const PERF_RULES: {
    id: string; regex: RegExp; problem: string; severity: LumeIssue['severity'];
    intent: string; explanation: string; canAutoFix: boolean; fix?: (c: string) => string;
}[] = [
        {
            id: 'console-log',
            regex: /^\s*console\.log\s*\(/m,
            problem: 'Forgotten console.log in production code',
            severity: 'WARNING',
            intent: 'Developer added a debug log.',
            explanation: 'console.log in production pollutes stdout.',
            canAutoFix: true,
            fix: (c: string) => c.replace(/^(\s*)console\.log(\(.*\)\s*;?.*)/gm, '$1// [LumeMoth] console.log$2')
        },
        {
            id: 'await-in-loop',
            regex: /for\s*\(.*\s+of\s+\w+\)\s*\{[\s\S]{0,300}await\s/,
            problem: 'Sequential await inside a for-of loop',
            severity: 'WARNING',
            intent: 'Developer iterated over items expecting parallel async execution.',
            explanation: 'await in a for-of loop runs serially. Use Promise.all().',
            canAutoFix: true,
            fix: (c: string) => {
                return c.replace(/for\s*\(const\s+(\w+)\s+of\s+(\w+)\)\s*\{([\s\S]{0,300}await\s)([^}]*)\}/g,
                    'await Promise.all($2.map(async ($1) => {$3 $4})) // [LumeMoth Parallelized]');
            }
        },
        {
            id: 'json-clone',
            regex: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/,
            problem: 'Deep clone via JSON.parse(JSON.stringify())',
            severity: 'WARNING',
            intent: 'Developer needed a deep copy of an object.',
            explanation: 'JSON round-tripping is slow. Use structuredClone().',
            canAutoFix: true,
            fix: (c: string) => c.replace(/JSON\.parse\s*\(\s*JSON\.stringify\s*\(/g, 'structuredClone(')
        },
        {
            id: 'foreach-push',
            regex: /(\w+)\.forEach\s*\(\s*(\w+)\s*=>\s*\{?\s*(\w+)\.push\s*\(\s*\2\s*\)\s*;?\s*\}?\s*\)/,
            problem: 'Array.forEach + .push() pattern — use .map() instead',
            severity: 'INFO',
            intent: 'Developer transformed an array element-by-element.',
            explanation: 'Use .map() for clarity and intent signalling.',
            canAutoFix: true,
            fix: (c: string) => {
                // Safer non-destructive refactor: comment out and suggest map
                return c.replace(/(\w+)\.forEach\s*\(\s*(\w+)\s*=>\s*\{?\s*(\w+)\.push\s*\(\s*\2\s*\)\s*;?\s*\}?\s*\)/g,
                    '// [LumeMoth] Suggested: $3 = $1.map($2 => $2);\n        $1.forEach($2 => $3.push($2))');
            }
        }
    ];

function analyzePerformance(content: string): LumeIssue[] {
    const issues: LumeIssue[] = [];
    const stripped = stripCommentedLines(content);

    for (const rule of PERF_RULES) {
        const match = rule.regex.exec(stripped);
        if (match) {
            const line = lineOf(stripped, match.index);
            issues.push({
                layer: 'PERFORMANCE', severity: rule.severity,
                problem: rule.problem, intent: rule.intent,
                explanation: rule.explanation, line,
                canAutoFix: rule.canAutoFix, fix: rule.fix
            });
        }
    }
    return issues;
}

// ─── Main Engine ──────────────────────────────────────────────────────────────
export class AnalysisEngine {
    analyze(filePath: string, content: string, _dependencies: FileContext[] = []): AIAnalysisResult {
        const issues: LumeIssue[] = [
            ...analyzeSyntax(filePath, content),
            ...analyzeSemantics(filePath, content),
            ...analyzeSecurity(content),
            ...analyzePerformance(content)
        ];
        return { issues, rewrittenFile: content, isFlawless: issues.length === 0 };
    }

    applyFixes(content: string, issues: LumeIssue[]): string {
        let result = content;
        for (const issue of issues) {
            if (issue.canAutoFix && issue.fix) {
                result = issue.fix(result);
            }
        }
        return result;
    }
}

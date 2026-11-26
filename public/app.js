import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// ==========================================
// OKF-go CLI Homepage Interactive Logic
// Install Switcher, CLI Preview, Integrations, BFS Graph & Playground
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Firebase Analytics when hosted on Firebase Hosting; degrade gracefully in local previews.
    try {
        const res = await fetch('/__/firebase/init.json');
        if (res.ok) {
            const firebaseConfig = await res.json();
            const app = initializeApp(firebaseConfig);
            getAnalytics(app);
        }
    } catch (_) {
        // Running outside Firebase Hosting (e.g., local static server)
    }

    // Helper: accessible keyboard arrow navigation for tablists
    function enableTablistKeyboardNav(tabs) {
        tabs.forEach((tab, idx) => {
            tab.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const dir = e.key === 'ArrowRight' ? 1 : -1;
                const nextIdx = (idx + dir + tabs.length) % tabs.length;
                tabs[nextIdx].focus();
                tabs[nextIdx].click();
            });
        });
    }

    // 0. THEME SWITCHER
    const themeToggleBtn = document.getElementById('theme-toggle');
    let redrawCanvas = null;

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            if (typeof redrawCanvas === 'function') {
                redrawCanvas();
            }
        });
    }

    // 1. COPY TO CLIPBOARD HANDLER
    const copyButtons = document.querySelectorAll('.btn-copy');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-copy-target');
            let targetEl = targetId ? document.getElementById(targetId) : button.previousElementSibling;

            if (targetEl && targetEl.tagName === 'PRE') {
                const codeEl = targetEl.querySelector('code');
                if (codeEl) targetEl = codeEl;
            }
            if (!targetEl) return;

            navigator.clipboard.writeText(targetEl.innerText.trim())
                .then(() => {
                    const copyText = button.querySelector('.copy-text');
                    const copyIcon = button.querySelector('.copy-icon');
                    const originalColor = button.style.color;
                    button.style.color = '#38bdf8';

                    if (copyText) {
                        const originalText = copyText.innerText;
                        copyText.innerText = 'Copied!';
                        setTimeout(() => {
                            copyText.innerText = originalText;
                            button.style.color = originalColor;
                        }, 1800);
                    } else if (copyIcon) {
                        const originalSvg = copyIcon.innerHTML;
                        copyIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
                        setTimeout(() => {
                            copyIcon.innerHTML = originalSvg;
                            button.style.color = originalColor;
                        }, 1800);
                    }
                })
                .catch(err => {
                    console.error('Failed to copy text:', err);
                });
        });
    });

    // 2. HERO INSTALL METHOD SWITCHER
    const installOptions = {
        shell: {
            cmd: 'curl -sSfL https://okfgo.dev/install.sh | sh',
            multiline: false,
            hint: 'Installs a single zero-dependency binary. Windows & Linux archives are also on <a href="https://github.com/abcubed3/okf/releases" target="_blank" rel="noopener noreferrer">GitHub Releases</a>.'
        },
        go: {
            cmd: 'go install github.com/abcubed3/okf/cmd/okf@latest',
            multiline: false,
            hint: 'Builds and installs <code>okf</code> directly into your <code>$GOBIN</code> (requires Go 1.24+).'
        },
        agent: {
            cmd: `Install OKF in this workspace:
1. Install the CLI via 'curl -sSfL https://okfgo.dev/install.sh | sh' (or 'go install github.com/abcubed3/okf/cmd/okf@latest').
2. Install the workspace Agent Skill with 'okf skill install'.
3. Verify with 'okf --help' and report the installed version and skill path.`,
            multiline: true,
            hint: 'Paste this prompt into Claude Code, Cursor, or Antigravity to set up both the CLI and Agent Skill automatically.'
        }
    };

    const installTabs = Array.from(document.querySelectorAll('.install-tab'));
    const installCommandEl = document.getElementById('install-command');
    const installHintEl = document.getElementById('install-hint');
    const installPanelEl = document.getElementById('install-panel');

    if (installTabs.length && installCommandEl && installHintEl) {
        enableTablistKeyboardNav(installTabs);
        installTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const key = tab.getAttribute('data-install');
                const opt = installOptions[key];
                if (!opt) return;

                installTabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                if (installPanelEl) {
                    installPanelEl.setAttribute('aria-labelledby', tab.id);
                }

                installCommandEl.textContent = opt.cmd;
                installCommandEl.classList.toggle('is-multiline', opt.multiline);
                installHintEl.innerHTML = opt.hint;
            });
        });
    }

    // 3. INTERACTIVE CLI SIMULATOR
    const terminalTabs = Array.from(document.querySelectorAll('.terminal-tabs .tab-btn'));
    const terminalCommandText = document.getElementById('terminal-command-text');
    const terminalOutputText = document.getElementById('terminal-output-text');
    const terminalPanel = document.getElementById('terminal-content');

    const terminalScripts = {
        'tab-harvest': {
            command: 'okf harvest db --driver postgres --conn "$DATABASE_URL" --output ./knowledge/tables',
            output: `Connecting to PostgreSQL public schema...
Inspecting tables and foreign keys...
  <span class="ansi-green">[NEW]</span> knowledge/tables/users.md (4 columns)
  <span class="ansi-green">[NEW]</span> knowledge/tables/orders.md (5 columns, links to users.md)

<span class="ansi-bold ansi-green">Harvested 2 database table concepts into ./knowledge/tables</span>`
        },
        'tab-lint': {
            command: 'okf lint ./knowledge',
            output: `Linting OKF bundle at <span class="ansi-bold">./knowledge</span> (OKF Spec v0.3)...
<span class="ansi-green">[PASS]</span>  tables/users.md: schema &amp; relative links valid
<span class="ansi-green">[PASS]</span>  tables/orders.md: human-reviewed verification current
<span class="ansi-green">[PASS]</span>  metrics/mrr.md: provenance &amp; freshness confirmed

Validation complete: <span class="ansi-green">0 errors</span>, <span class="ansi-green">0 warnings</span>.`
        },
        'tab-skill': {
            command: 'okf skill export --bundle ./knowledge --output .agents/skills/warehouse/SKILL.md',
            output: `Reading OKF bundle from <span class="ansi-bold">./knowledge</span> (14 concepts)...
  <span class="ansi-green">[OK]</span> Schema fidelity rules &amp; concept index compiled
  <span class="ansi-green">[OK]</span> 2 certified SQL queries embedded (MRR, Churn)
  <span class="ansi-green">[OK]</span> Trust tiers &amp; freshness dates attached

<span class="ansi-bold ansi-green">Exported Agent Skill to .agents/skills/warehouse/SKILL.md</span>`
        },
        'tab-mcp': {
            command: 'okf mcp --bundle ./knowledge --transport stdio',
            output: `<span class="ansi-bold">Starting OKF MCP Server (stdio)...</span>
<span class="ansi-green">Registered Tools:</span>
  &bull; list_concepts / search_concepts / get_concept
  &bull; assemble_context   (bounded BFS graph context)
  &bull; export_agent_skill (compile SKILL.md on demand)
  &bull; ask_knowledge_base (grounded Q&amp;A with citations)

<span class="ansi-cyan">Ready for MCP client requests on stdin...</span>`
        },
        'tab-ask': {
            command: 'okf ask "How do we calculate monthly recurring revenue?" --bundle ./knowledge',
            output: `Seed concept: <span class="ansi-cyan">metrics/mrr</span> &rarr; traversed <span class="ansi-bold">attestations/mrr_query, tables/subscriptions</span>
------------------------------------------------------------------------
Use the human-reviewed attestation query (<span class="ansi-cyan">finance@company.com</span>):

<span class="ansi-blue">SELECT</span> DATE_TRUNC(created_at, MONTH) <span class="ansi-blue">AS</span> month, SUM(amount) <span class="ansi-blue">AS</span> mrr
<span class="ansi-blue">FROM</span> analytics.subscriptions <span class="ansi-blue">WHERE</span> status = 'active' <span class="ansi-blue">GROUP BY</span> 1;

<span class="ansi-muted">Sources: [metrics/mrr], [attestations/mrr_query] (fresh until 2027-01-01)</span>`
        }
    };

    let typingTimeoutId = null;

    function runTerminalSimulation(tabId) {
        const script = terminalScripts[tabId];
        if (!script || !terminalCommandText || !terminalOutputText) return;

        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
            typingTimeoutId = null;
        }

        terminalCommandText.textContent = '';
        terminalOutputText.innerHTML = '';

        let index = 0;
        const cmdStr = script.command;

        function typeChar() {
            if (index < cmdStr.length) {
                terminalCommandText.textContent += cmdStr.charAt(index);
                index++;
                typingTimeoutId = setTimeout(typeChar, 16);
            } else {
                typingTimeoutId = setTimeout(() => {
                    terminalOutputText.innerHTML = script.output;
                    typingTimeoutId = null;
                }, 100);
            }
        }

        typeChar();
    }

    if (terminalTabs.length) {
        enableTablistKeyboardNav(terminalTabs);
        runTerminalSimulation('tab-harvest');

        terminalTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                terminalTabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                if (terminalPanel) {
                    terminalPanel.setAttribute('aria-labelledby', tab.id);
                }
                runTerminalSimulation(tab.id);
            });
        });
    }

    // 4. INTEGRATIONS TAB SWITCHER
    const integrationSnippets = {
        mcp: {
            desc: 'Add OKF to Claude Desktop, Cursor, or Antigravity to expose <code>list_concepts</code>, <code>search_concepts</code>, <code>get_concept</code>, <code>assemble_context</code>, <code>export_agent_skill</code>, and <code>ask_knowledge_base</code>.',
            code: `{
  "mcpServers": {
    "okf-knowledge": {
      "command": "okf",
      "args": ["mcp", "--bundle", "./knowledge"]
    }
  }
}`
        },
        skill: {
            desc: 'Install the official OKF authoring skill into your workspace, or compile your own bundle into a domain <code>SKILL.md</code>.',
            code: `# 1. Teach your coding agent how to author & lint OKF v0.3 files
okf skill install
# (Or without the CLI: npx skills add https://github.com/abcubed3/okf/skills)

# 2. Compile your team's OKF bundle into a domain-specific skill
okf skill export --bundle ./knowledge --output .agents/skills/domain/SKILL.md --name "domain"`
        },
        ci: {
            desc: 'Enforce schema validity, unbroken Markdown links, and metadata freshness on every pull request with GitHub Actions.',
            code: `name: OKF Lint
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: abcubed3/okf@v1
        with:
          path: "./knowledge"`
        },
        docker: {
            desc: 'Host a shared HTTP MCP server for your team using the official container image.',
            code: `services:
  okf-mcp:
    image: ghcr.io/abcubed3/okf:latest
    command: ["mcp", "--bundle", "/bundle", "--transport", "http", "--port", "8080"]
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - ./knowledge:/bundle:ro`
        }
    };

    const integrationTabs = Array.from(document.querySelectorAll('.integration-tab'));
    const integrationDescEl = document.getElementById('integration-desc');
    const integrationCodeEl = document.getElementById('integration-code');
    const integrationPanelEl = document.getElementById('integration-panel');

    if (integrationTabs.length && integrationDescEl && integrationCodeEl) {
        enableTablistKeyboardNav(integrationTabs);
        integrationTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const key = tab.getAttribute('data-integration');
                const item = integrationSnippets[key];
                if (!item) return;

                integrationTabs.forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                if (integrationPanelEl) {
                    integrationPanelEl.setAttribute('aria-labelledby', tab.id);
                }

                integrationDescEl.innerHTML = item.desc;
                integrationCodeEl.textContent = item.code;
            });
        });
    }

    // 5. INTERACTIVE BFS GRAPH ANIMATION (CANVAS)
    const canvas = document.getElementById('graph-canvas');
    const bfsButton = document.getElementById('btn-run-bfs');
    const bfsStatus = document.getElementById('bfs-status-text');

    if (canvas && bfsButton) {
        const ctx = canvas.getContext('2d');

        const nodes = [
            { id: 'tables/orders', label: 'orders', type: 'Seed', rx: 0.5, ry: 0.5, r: 22, color: '#00f2fe', state: 'idle' },
            { id: 'tables/users', label: 'users', type: 'Table', rx: 0.23, ry: 0.28, r: 18, color: '#3b82f6', state: 'idle' },
            { id: 'apis/create_user', label: 'create_user', type: 'API', rx: 0.16, ry: 0.74, r: 18, color: '#a78bfa', state: 'idle' },
            { id: 'playbooks/db_cleanup', label: 'db_cleanup', type: 'Playbook', rx: 0.77, ry: 0.28, r: 18, color: '#f472b6', state: 'idle' },
            { id: 'tables/transactions', label: 'transactions', type: 'Table', rx: 0.82, ry: 0.74, r: 18, color: '#3b82f6', state: 'idle' }
        ];

        const edges = [
            { from: 'tables/orders', to: 'tables/users', state: 'idle' },
            { from: 'tables/users', to: 'apis/create_user', state: 'idle' },
            { from: 'tables/orders', to: 'playbooks/db_cleanup', state: 'idle' },
            { from: 'playbooks/db_cleanup', to: 'tables/transactions', state: 'idle' }
        ];

        let hoveredNode = null;

        function drawGraph() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';

            nodes.forEach(n => {
                n.x = n.rx * canvas.width;
                n.y = n.ry * canvas.height;
            });

            edges.forEach(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);

                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(toNode.x, toNode.y);

                if (edge.state === 'traversed') {
                    ctx.strokeStyle = isLight ? '#0284c7' : '#00f2fe';
                    ctx.lineWidth = 2.5;
                } else if (edge.state === 'traversing') {
                    ctx.strokeStyle = isLight ? '#7c3aed' : '#a78bfa';
                    ctx.lineWidth = 2.5;
                } else {
                    ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.45)' : 'rgba(255, 255, 255, 0.14)';
                    ctx.lineWidth = 1.5;
                }
                ctx.stroke();
            });

            nodes.forEach(node => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.r, 0, 2 * Math.PI);

                const isHovered = hoveredNode && hoveredNode.id === node.id;

                if (node.state === 'active' || isHovered) {
                    ctx.fillStyle = node.color;
                    ctx.shadowColor = node.color;
                    ctx.shadowBlur = isLight ? 8 : 14;
                } else if (node.state === 'completed') {
                    ctx.fillStyle = isLight ? '#ffffff' : '#1e293b';
                    ctx.strokeStyle = node.color;
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillStyle = isLight ? '#f1f5f9' : '#0f172a';
                    ctx.strokeStyle = isLight ? 'rgba(100, 116, 139, 0.5)' : 'rgba(255, 255, 255, 0.22)';
                    ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 0;
                }

                ctx.fill();
                if (node.state !== 'active' && !isHovered) {
                    ctx.stroke();
                }
                ctx.shadowBlur = 0;

                ctx.fillStyle = (node.state === 'active' || isHovered)
                    ? '#060913'
                    : (isLight ? '#0f172a' : '#f8fafc');
                ctx.font = '600 11px JetBrains Mono';
                ctx.textAlign = 'center';
                ctx.fillText(node.label, node.x, node.y + 4);

                ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
                ctx.font = '600 9px Outfit';
                ctx.fillText(node.type.toUpperCase(), node.x, node.y - node.r - 6);
            });
        }

        redrawCanvas = drawGraph;

        function resizeCanvas() {
            const container = canvas.parentElement;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight || 270;
            drawGraph();
        }

        window.addEventListener('resize', resizeCanvas);

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            let found = null;
            for (const node of nodes) {
                const dx = mouseX - node.x;
                const dy = mouseY - node.y;
                if (Math.sqrt(dx * dx + dy * dy) <= node.r) {
                    found = node;
                    break;
                }
            }

            if (hoveredNode !== found) {
                hoveredNode = found;
                canvas.style.cursor = found ? 'pointer' : 'default';
                drawGraph();
            }
        });

        resizeCanvas();

        let animationRunning = false;

        function setStepState(stepIdx, className) {
            const stepEl = document.getElementById(`step-${stepIdx}`);
            if (stepEl) {
                stepEl.classList.remove('active', 'completed');
                if (className) stepEl.classList.add(className);
            }
        }

        bfsButton.addEventListener('click', () => {
            if (animationRunning) return;
            animationRunning = true;
            bfsButton.disabled = true;
            bfsButton.textContent = 'Traversing...';

            nodes.forEach(n => { n.state = 'idle'; });
            edges.forEach(e => { e.state = 'idle'; });
            [0, 1, 2].forEach(i => setStepState(i, ''));

            const steps = [
                () => {
                    nodes[0].state = 'active';
                    if (bfsStatus) bfsStatus.textContent = 'Seed selected: tables/orders';
                    setStepState(0, 'active');
                },
                () => {
                    nodes[0].state = 'completed';
                    edges[0].state = 'traversing';
                    edges[2].state = 'traversing';
                    nodes[1].state = 'active';
                    nodes[3].state = 'active';
                    if (bfsStatus) bfsStatus.textContent = 'Following depth-1 Markdown links...';
                    setStepState(0, 'completed');
                    setStepState(1, 'active');
                },
                () => {
                    nodes[1].state = 'completed';
                    nodes[3].state = 'completed';
                    edges[0].state = 'traversed';
                    edges[2].state = 'traversed';
                    edges[1].state = 'traversing';
                    edges[3].state = 'traversing';
                    nodes[2].state = 'active';
                    nodes[4].state = 'active';
                    if (bfsStatus) bfsStatus.textContent = 'Following depth-2 Markdown links...';
                    setStepState(1, 'completed');
                    setStepState(2, 'active');
                },
                () => {
                    nodes[2].state = 'completed';
                    nodes[4].state = 'completed';
                    edges[1].state = 'traversed';
                    edges[3].state = 'traversed';
                    if (bfsStatus) bfsStatus.textContent = 'Assembled 5 linked concepts (12,430 chars) in 38µs.';
                    setStepState(2, 'completed');

                    setTimeout(() => {
                        bfsButton.disabled = false;
                        bfsButton.textContent = 'Animate Traversal';
                        animationRunning = false;
                    }, 900);
                }
            ];

            let currentStep = 0;
            function runNext() {
                if (currentStep < steps.length) {
                    steps[currentStep]();
                    drawGraph();
                    currentStep++;
                    setTimeout(runNext, 950);
                }
            }
            runNext();
        });
    }

    // 6. LIVE CONCEPT PARSER PLAYGROUND
    const playgroundTextarea = document.getElementById('playground-textarea');
    const parserStatus = document.getElementById('parser-status');
    const outId = document.getElementById('out-id');
    const outVersion = document.getElementById('out-version');
    const outType = document.getElementById('out-type');
    const outTitle = document.getElementById('out-title');
    const outDesc = document.getElementById('out-desc');
    const outStatus = document.getElementById('out-status');
    const outStale = document.getElementById('out-stale');
    const outVerified = document.getElementById('out-verified');
    const outResource = document.getElementById('out-resource');
    const outTags = document.getElementById('out-tags');
    const outSources = document.getElementById('out-sources');
    const outLinks = document.getElementById('out-links');
    const outBody = document.getElementById('out-body');

    function setParserStatus(type, message) {
        if (!parserStatus) return;
        parserStatus.className = 'status-pill';
        parserStatus.classList.add(`status-${type}`);
        parserStatus.textContent = message;
    }

    function clearParsedUI() {
        [outId, outVersion, outType, outTitle, outDesc, outStatus, outStale, outVerified, outResource].forEach(el => {
            if (el) el.textContent = '—';
        });
        [outTags, outSources, outLinks].forEach(el => {
            if (el) el.innerHTML = '';
        });
    }

    function parseEditorInput() {
        const content = playgroundTextarea.value;
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            setParserStatus('error', 'Missing --- frontmatter ---');
            clearParsedUI();
            if (outBody) outBody.textContent = content;
            return;
        }

        const frontmatterText = match[1];
        const bodyText = match[2] || '';

        const frontmatter = {};
        const tagsList = [];
        const sourcesList = [];
        const verifiedEntries = [];
        let currentVerifiedEntry = null;
        let generatedAt = null;
        let inVerifiedBlock = false;
        let inSourcesBlock = false;
        let inGeneratedBlock = false;
        let inTagsBlock = false;

        frontmatterText.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            if (trimmed.startsWith('tags:')) {
                inTagsBlock = true;
                inSourcesBlock = inVerifiedBlock = inGeneratedBlock = false;
                currentVerifiedEntry = null;
            } else if (trimmed.startsWith('sources:')) {
                inSourcesBlock = true;
                inTagsBlock = inVerifiedBlock = inGeneratedBlock = false;
                currentVerifiedEntry = null;
            } else if (trimmed.startsWith('generated:')) {
                inGeneratedBlock = true;
                inTagsBlock = inSourcesBlock = inVerifiedBlock = false;
                currentVerifiedEntry = null;
                const inlineAt = trimmed.match(/at:\s*["']?([^"',}\s]+)["']?/);
                if (inlineAt) generatedAt = inlineAt[1];
            } else if (trimmed.startsWith('verified:')) {
                inVerifiedBlock = true;
                inTagsBlock = inSourcesBlock = inGeneratedBlock = false;
                currentVerifiedEntry = null;
                const inlineBy = trimmed.match(/by:\s*["']?([^"',}\s]+)["']?/);
                const inlineAt = trimmed.match(/at:\s*["']?([^"',}\s]+)["']?/);
                if (inlineBy) {
                    verifiedEntries.push({ by: inlineBy[1], at: inlineAt ? inlineAt[1] : null });
                }
            } else if (line.match(/^[a-zA-Z0-9_-]+:/)) {
                inTagsBlock = inSourcesBlock = inVerifiedBlock = inGeneratedBlock = false;
                currentVerifiedEntry = null;
            }

            if (inTagsBlock && trimmed.startsWith('-')) {
                const tagItem = trimmed.replace(/^-\s*/, '').trim().replace(/^["']|["']$/g, '');
                if (tagItem) tagsList.push(tagItem);
            }

            if (inSourcesBlock) {
                const srcMatch = trimmed.match(/^(?:-\s*(?:\{\s*)?)?(?:resource|uri):\s*([^,}]+)$/);
                if (srcMatch) {
                    const uri = srcMatch[1].trim().replace(/^["']|["']$/g, '');
                    if (uri) sourcesList.push(uri);
                }
            }

            if (inGeneratedBlock && !trimmed.startsWith('generated:')) {
                const genAtMatch = trimmed.match(/at:\s*["']?([^"',}\s]+)["']?/);
                if (genAtMatch) generatedAt = genAtMatch[1];
            }

            if (inVerifiedBlock && !trimmed.startsWith('verified:')) {
                if (trimmed.startsWith('-')) {
                    currentVerifiedEntry = { by: '', at: null };
                    verifiedEntries.push(currentVerifiedEntry);
                } else if (!currentVerifiedEntry) {
                    currentVerifiedEntry = { by: '', at: null };
                    verifiedEntries.push(currentVerifiedEntry);
                }
                const byMatch = trimmed.match(/by:\s*["']?([^"',}\s]+)["']?/);
                if (byMatch && currentVerifiedEntry) currentVerifiedEntry.by = byMatch[1];
                const atMatch = trimmed.match(/at:\s*["']?([^"',}\s]+)["']?/);
                if (atMatch && currentVerifiedEntry) currentVerifiedEntry.at = atMatch[1];
            }

            const isIndented = /^\s/.test(line);
            const separatorIdx = line.indexOf(':');
            if (!isIndented && separatorIdx > 0 && !trimmed.startsWith('-')) {
                const key = line.substring(0, separatorIdx).trim();
                let val = line.substring(separatorIdx + 1).trim();

                if (val.startsWith('[') && val.endsWith(']')) {
                    val = val.substring(1, val.length - 1)
                        .split(',')
                        .map(item => item.trim().replace(/^["']|["']$/g, ''))
                        .filter(Boolean);
                } else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.substring(1, val.length - 1);
                }

                if (!frontmatter[key] && val !== '') {
                    frontmatter[key] = val;
                }
            }
        });

        if (tagsList.length > 0 && !Array.isArray(frontmatter.tags)) {
            frontmatter.tags = tagsList;
        }

        if (!frontmatter.type) {
            setParserStatus('error', 'Missing "type" (skipped in v0.3)');
            clearParsedUI();
            if (outBody) outBody.textContent = bodyText;
            return;
        }

        if (!frontmatter.title || !frontmatter.description) {
            setParserStatus('warning', 'Missing recommended title/description');
        } else {
            setParserStatus('success', 'Valid OKF v0.3');
        }

        const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
        const links = [];
        let linkMatch;
        while ((linkMatch = linkRegex.exec(bodyText)) !== null) {
            links.push(linkMatch[2]);
        }

        let inferredId = 'concepts/untitled';
        if (frontmatter.title) {
            const lowerType = frontmatter.type.toLowerCase();
            const folder = lowerType.includes('table') ? 'tables'
                : lowerType.includes('metric') ? 'metrics'
                : lowerType.includes('api') ? 'apis'
                : 'concepts';
            const slug = frontmatter.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            inferredId = `${folder}/${slug}`;
        }

        if (outId) outId.textContent = inferredId;
        if (outVersion) {
            const rawVer = String(frontmatter.okf_version || '0.3').replace(/^v/i, '');
            outVersion.textContent = `v${rawVer}`;
        }
        if (outType) outType.textContent = frontmatter.type;
        if (outTitle) outTitle.textContent = frontmatter.title || '(Untitled)';
        if (outDesc) outDesc.textContent = frontmatter.description || '(No description)';
        if (outStatus) {
            const statusVal = frontmatter.status || 'stable';
            outStatus.textContent = (statusVal === 'deprecated' && frontmatter.superseded_by)
                ? `deprecated → ${frontmatter.superseded_by}`
                : statusVal;
        }
        if (outStale) outStale.textContent = frontmatter.stale_after || 'None';

        if (outVerified) {
            const validEntries = verifiedEntries.filter(e => e.by && e.by.trim() !== '');
            const genMs = generatedAt ? Date.parse(generatedAt) : NaN;
            const currentEntries = validEntries.filter(entry => {
                if (Number.isNaN(genMs)) return true;
                if (!entry.at) return false;
                const verMs = Date.parse(entry.at);
                return !Number.isNaN(verMs) && verMs >= genMs;
            });

            let derivedTier = 'unverified';
            if (currentEntries.length > 0) {
                const hasHuman = currentEntries.some(e => e.by.toLowerCase().startsWith('human:'));
                derivedTier = hasHuman ? 'human-reviewed' : 'machine-confirmed';
            }

            let verText = derivedTier;
            if (currentEntries.length > 0) {
                verText += ` (${currentEntries.map(e => e.by).join(', ')})`;
            } else if (validEntries.length > 0) {
                verText += ' (outdated: verified.at < generated.at)';
            }
            outVerified.textContent = verText;
        }

        if (outResource) outResource.textContent = frontmatter.resource || 'None';

        if (outTags) {
            outTags.innerHTML = '';
            const tags = Array.isArray(frontmatter.tags)
                ? frontmatter.tags
                : (frontmatter.tags ? [frontmatter.tags] : []);
            if (tags.length > 0) {
                tags.forEach(tag => {
                    const pill = document.createElement('span');
                    pill.className = 'tag-pill';
                    pill.textContent = tag;
                    outTags.appendChild(pill);
                });
            } else {
                outTags.innerHTML = '<span class="text-muted">None</span>';
            }
        }

        if (outSources) {
            outSources.innerHTML = '';
            if (sourcesList.length > 0) {
                sourcesList.forEach(src => {
                    const pill = document.createElement('span');
                    pill.className = 'link-pill';
                    pill.textContent = src.replace(/^https?:\/\//, '');
                    outSources.appendChild(pill);
                });
            } else {
                outSources.innerHTML = '<span class="text-muted">None</span>';
            }
        }

        if (outLinks) {
            outLinks.innerHTML = '';
            if (links.length > 0) {
                links.forEach(link => {
                    const pill = document.createElement('span');
                    pill.className = 'link-pill';
                    pill.textContent = link;
                    outLinks.appendChild(pill);
                });
            } else {
                outLinks.innerHTML = '<span class="text-muted">None</span>';
            }
        }

        if (outBody) outBody.textContent = bodyText.trimStart();
    }

    if (playgroundTextarea) {
        playgroundTextarea.addEventListener('input', parseEditorInput);
        parseEditorInput();
    }
});

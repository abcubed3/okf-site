// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";

// ==========================================
// OKF-go CLI Marketing Site JavaScript Logic
// Handles Terminal, Graph BFS, Parser, and Copy
// ==========================================

// NOTE: Firebase init is inside the async DOMContentLoaded callback to avoid a
// race condition: a top-level `await` makes the module async, so DOMContentLoaded
// fires before the module resolves and the listener is registered too late.
document.addEventListener('DOMContentLoaded', async () => {
    // Firebase config is served by Firebase Hosting at this reserved endpoint.
    // The API key is never hardcoded in source — it is injected server-side by Firebase.
    // See: https://firebase.google.com/docs/hosting/reserved-urls
    const firebaseConfig = await fetch('/__/firebase/init.json').then(r => r.json());
    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
    // 1. COPY TO CLIPBOARD GENERIC HANDLER
    const copyButtons = document.querySelectorAll('.btn-copy');
    copyButtons.forEach(button => {
        button.addEventListener('click', () => {
            let targetId = button.getAttribute('data-copy-target');
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
                    button.style.color = '#00f2fe';

                    if (copyText) {
                        const originalText = copyText.innerText;
                        copyText.innerText = 'Copied!';
                        setTimeout(() => {
                            copyText.innerText = originalText;
                            button.style.color = originalColor;
                        }, 2000);
                    } else if (copyIcon) {
                        const originalSvg = copyIcon.innerHTML;
                        // Replace SVG contents with a checkmark path
                        copyIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
                        setTimeout(() => {
                            copyIcon.innerHTML = originalSvg;
                            button.style.color = originalColor;
                        }, 2000);
                    }
                })
                .catch(err => {
                    console.error('Failed to copy text: ', err);
                });
        });
    });

    // 2. INTERACTIVE TERMINAL SIMULATOR
    const terminalTabs = document.querySelectorAll('.terminal-tabs .tab-btn');
    const terminalCommandText = document.getElementById('terminal-command-text');
    const terminalOutputText = document.getElementById('terminal-output-text');
    
    // Scripted commands and outputs
    const terminalScripts = {
        'tab-lint': {
            command: 'okf lint ./knowledge-base',
            output: `Linting OKF bundle at: <span class="ansi-bold">/Users/developer/knowledge-base</span>...
<span class="ansi-yellow">[WARN]</span>  playbooks/database_cleanup.md: description field is missing (recommended)
<span class="ansi-green">[WARN]</span>  tables/users.md: link checks passed
<span class="ansi-green">[WARN]</span>  tables/orders.md: link checks passed

Validation complete: <span class="ansi-green">0 errors</span>, <span class="ansi-yellow">1 warnings</span> found.
Validation complete: OKF bundle is perfectly valid! 🎉`
        },
        'tab-harvest': {
            command: 'okf harvest db --driver postgres --conn "postgresql://localhost:5432/my_db" --output ./bundle/tables',
            output: `Connecting to PostgreSQL database public schema...
Querying information schema tables...
Found table: <span class="ansi-cyan">users</span> (4 columns)
Found table: <span class="ansi-cyan">orders</span> (3 columns, foreign key: users.id)
Generating OKF concepts...
  <span class="ansi-green">[NEW]</span> bundle/tables/users.md
  <span class="ansi-green">[NEW]</span> bundle/tables/orders.md

<span class="ansi-bold ansi-green">Successfully harvested 2 database table concepts into "./bundle/tables"!</span>`
        },
        'tab-assemble': {
            command: 'okf assemble tables/orders --depth 2 --format xml',
            output: `<span class="ansi-bold ansi-blue">&lt;context&gt;</span>
  <span class="ansi-bold ansi-cyan">&lt;concept id="tables/orders" path="tables/orders.md" type="BigQuery Table"&gt;</span>
    # Orders Table
    Stores transaction details. References <span class="ansi-yellow">[Users Table](users.md)</span>.
    
    ## Schema
    * transaction_id (STRING): ID
    * user_id (STRING): References users.id
  <span class="ansi-bold ansi-cyan">&lt;/concept&gt;</span>
  <span class="ansi-bold ansi-cyan">&lt;concept id="tables/users" path="tables/users.md" type="BigQuery Table"&gt;</span>
    # Users Table
    Stores customer profiles.
  <span class="ansi-bold ansi-cyan">&lt;/concept&gt;</span>
<span class="ansi-bold ansi-blue">&lt;/context&gt;</span>`
        },
        'tab-mcp': {
            command: 'okf mcp --bundle ./knowledge-base --transport stdio',
            output: `<span class="ansi-bold">Starting OKF-go MCP Server over Stdio...</span>
<span class="ansi-green">Exposed MCP Capabilities:</span>
  - <span class="ansi-bold">Resources:</span>
    * okf://index (List of all concepts)
    * okf://concept/{id} (Get concept document)
  - <span class="ansi-bold">Prompts:</span>
    * okf_concept_context
  - <span class="ansi-bold">Tools:</span>
    * list_concepts
    * search_concepts   
    * get_concept
    * assemble_context

<span class="ansi-bold ansi-cyan">Server is running. Waiting for JSON-RPC messages on stdin...</span>`
        },
        'tab-doc': {
            command: 'okf doc --bundle ./knowledge-base --output ./docs',
            output: `Generating OKF documentation from <span class="ansi-bold">/Users/developer/knowledge-base</span> to <span class="ansi-bold">/Users/developer/knowledge-base/docs</span>...
Parsing 5 concepts...
Rendering bundle graph index...
Writing asset files...
  - index.html
  - vis-network.min.js
  - marked.min.js

<span class="ansi-bold ansi-green">Documentation generated successfully! 🎉</span>`
        },
        'tab-lsp': {
            command: 'okf lsp',
            output: `Starting Language Server Protocol (LSP) Daemon...
Listening for JSON-RPC messages on standard I/O...
  [LSP] Client Capabilities Registered: textDocumentSyncKindFull
  [LSP] Project Root Configured: /Users/developer/knowledge-base
  [LSP] Diagnostic Engine initialized.
  
<span class="ansi-cyan">LSP Server ready. Press Ctrl+C to terminate.</span>`
        },
        'tab-sync': {
            command: 'okf sync --config okf.yaml --daemon --interval 300',
            output: `Starting OKF Sync Engine for bundle at /Users/developer/knowledge-base (Config: okf.yaml)
Registering connectors...
  - Notion Connector: <span class="ansi-green">ACTIVE</span>
  - Google Drive Connector: <span class="ansi-green">ACTIVE</span>
  - Confluence Connector: <span class="ansi-yellow">UNCONFIGURED (Skipped)</span>
  - Jira Connector: <span class="ansi-yellow">UNCONFIGURED (Skipped)</span>
  
[Sync] Starting OKF Sync daemon (Interval: 300s)
[Sync] Starting sync cycle...
[Sync] Pushing concept <span class="ansi-bold">tables/users</span> to Notion (Parent: workspace)... <span class="ansi-green">SUCCESS</span>
[Sync] Pushing concept <span class="ansi-bold">tables/orders</span> to Google Drive... <span class="ansi-green">SUCCESS</span>
[Sync] Pulling updates from Notion... <span class="ansi-green">NO CHANGES</span>
[Sync] Sync cycle complete. Last Sync state saved.
[Sync] Waiting for next interval...`
        }
    };

    let typingTimeoutId = null;

    function runTerminalSimulation(tabId) {
        const script = terminalScripts[tabId];
        if (!script) return;
        
        // Clear any running typing timeout to prevent overlapping animations
        if (typingTimeoutId) {
            clearTimeout(typingTimeoutId);
            typingTimeoutId = null;
        }
        
        terminalCommandText.innerHTML = '';
        terminalOutputText.innerHTML = '';
        
        // Typing effect for the command
        let index = 0;
        const cmdStr = script.command;
        
        function typeChar() {
            if (index < cmdStr.length) {
                terminalCommandText.innerHTML += cmdStr.charAt(index);
                index++;
                typingTimeoutId = setTimeout(typeChar, 25);
            } else {
                // Command fully typed, show output after a small delay
                typingTimeoutId = setTimeout(() => {
                    terminalOutputText.innerHTML = script.output;
                    typingTimeoutId = null;
                }, 150);
            }
        }
        
        typeChar();
    }

    // Trigger initial simulation
    runTerminalSimulation('tab-lint');

    // Add tab click listeners
    terminalTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            terminalTabs.forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            e.currentTarget.classList.add('active');
            e.currentTarget.setAttribute('aria-selected', 'true');
            
            runTerminalSimulation(e.currentTarget.id);
        });
    });

    // 3. INTERACTIVE BFS GRAPH ANIMATION (CANVAS)
    const canvas = document.getElementById('graph-canvas');
    const bfsButton = document.getElementById('btn-run-bfs');
    const bfsStatus = document.getElementById('bfs-status-text');
    const stepsContainer = document.getElementById('bfs-steps-container');
    
    if (canvas && bfsButton) {
        const ctx = canvas.getContext('2d');
        
        // Define Node structures
        const nodes = [
            { id: 'tables/orders', label: 'orders', type: 'Root', x: 250, y: 200, r: 24, color: '#00f2fe', state: 'idle' },
            { id: 'tables/users', label: 'users', type: 'Table', x: 120, y: 120, r: 20, color: '#3b82f6', state: 'idle' },
            { id: 'apis/create_user', label: 'create_user', type: 'API', x: 80, y: 280, r: 20, color: '#a78bfa', state: 'idle' },
            { id: 'playbooks/database_cleanup', label: 'db_cleanup', type: 'Playbook', x: 380, y: 120, r: 20, color: '#f472b6', state: 'idle' },
            { id: 'tables/transactions', label: 'transactions', type: 'Table', x: 380, y: 280, r: 20, color: '#3b82f6', state: 'idle' }
        ];

        const edges = [
            { from: 'tables/orders', to: 'tables/users', state: 'idle' },
            { from: 'tables/users', to: 'apis/create_user', state: 'idle' },
            { from: 'tables/orders', to: 'playbooks/database_cleanup', state: 'idle' },
            { from: 'playbooks/database_cleanup', to: 'tables/transactions', state: 'idle' }
        ];

        // Draw helper functions
        function drawGraph() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw Edges
            edges.forEach(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                
                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(toNode.x, toNode.y);
                
                if (edge.state === 'traversed') {
                    ctx.strokeStyle = '#00f2fe';
                    ctx.lineWidth = 3;
                } else if (edge.state === 'traversing') {
                    ctx.strokeStyle = '#a78bfa';
                    ctx.lineWidth = 2.5;
                } else {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    ctx.lineWidth = 1.5;
                }
                ctx.stroke();
            });

            // Draw Nodes
            nodes.forEach(node => {
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.r, 0, 2 * Math.PI);
                
                if (node.state === 'active') {
                    ctx.fillStyle = node.color;
                    ctx.shadowColor = node.color;
                    ctx.shadowBlur = 15;
                } else if (node.state === 'completed') {
                    ctx.fillStyle = '#1e293b';
                    ctx.strokeStyle = node.color;
                    ctx.lineWidth = 2;
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillStyle = '#0f172a';
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 0;
                }
                
                ctx.fill();
                if (node.state !== 'active') {
                    ctx.stroke();
                }
                ctx.shadowBlur = 0; // Reset shadow

                // Draw Text
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 11px JetBrains Mono';
                ctx.textAlign = 'center';
                ctx.fillText(node.label, node.x, node.y + 4);
                
                // Draw type label above circle
                ctx.fillStyle = '#64748b';
                ctx.font = '9px Outfit';
                ctx.fillText(node.type.toUpperCase(), node.x, node.y - node.r - 6);
            });
        }

        // Draw initial state
        drawGraph();

        // BFS Animation steps
        let animationRunning = false;

        bfsButton.addEventListener('click', () => {
            if (animationRunning) return;
            animationRunning = true;
            bfsButton.disabled = true;
            bfsButton.innerText = 'Traversing...';
            
            // Reset all states
            nodes.forEach(n => n.state = 'idle');
            edges.forEach(e => e.state = 'idle');
            
            const steps = [
                // Step 0: Initialize Root
                () => {
                    nodes[0].state = 'active';
                    bfsStatus.innerText = 'Root selected...';
                    setStepVisible(0, 'active');
                },
                // Step 1: Traverse from Root to Depth 1 (users, db_cleanup)
                () => {
                    nodes[0].state = 'completed';
                    edges[0].state = 'traversing';
                    edges[2].state = 'traversing';
                    nodes[1].state = 'active';
                    nodes[3].state = 'active';
                    bfsStatus.innerText = 'Depth 1 traversed...';
                    setStepVisible(0, 'completed');
                    setStepVisible(1, 'active');
                },
                // Step 2: Traverse from Depth 1 to Depth 2 (create_user, transactions)
                () => {
                    nodes[1].state = 'completed';
                    nodes[3].state = 'completed';
                    edges[0].state = 'traversed';
                    edges[2].state = 'traversed';
                    edges[1].state = 'traversing';
                    edges[3].state = 'traversing';
                    nodes[2].state = 'active';
                    nodes[4].state = 'active';
                    bfsStatus.innerText = 'Depth 2 traversed...';
                    setStepVisible(1, 'completed');
                    setStepVisible(2, 'active');
                },
                // Step 3: End traversal, all resolved
                () => {
                    nodes[2].state = 'completed';
                    nodes[4].state = 'completed';
                    edges[1].state = 'traversed';
                    edges[3].state = 'traversed';
                    bfsStatus.innerText = 'Context Compiled! (12,430 chars)';
                    setStepVisible(2, 'completed');
                    
                    // Reset button
                    setTimeout(() => {
                        bfsButton.disabled = false;
                        bfsButton.innerText = 'Animate Context Traversal';
                        animationRunning = false;
                    }, 1500);
                }
            ];

            // Reset step displays
            document.querySelectorAll('.bfs-step').forEach(el => {
                el.classList.remove('active', 'completed');
            });

            let currentStep = 0;
            function runNext() {
                if (currentStep < steps.length) {
                    steps[currentStep]();
                    drawGraph();
                    currentStep++;
                    setTimeout(runNext, 1200);
                }
            }

            runNext();
        });

        function setStepVisible(stepIdx, className) {
            const stepEl = document.getElementById(`step-${stepIdx}`);
            if (stepEl) {
                stepEl.classList.remove('active', 'completed');
                stepEl.classList.add(className);
                stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // 4. LIVE CONCEPT PARSER PLAYGROUND
    const playgroundTextarea = document.getElementById('playground-textarea');
    const parserStatus = document.getElementById('parser-status');
    const outId = document.getElementById('out-id');
    const outType = document.getElementById('out-type');
    const outTitle = document.getElementById('out-title');
    const outDesc = document.getElementById('out-desc');
    const outResource = document.getElementById('out-resource');
    const outTags = document.getElementById('out-tags');
    const outLinks = document.getElementById('out-links');
    const outBody = document.getElementById('out-body');

    if (playgroundTextarea) {
        playgroundTextarea.addEventListener('input', parseEditorInput);
        
        // Initial parse
        parseEditorInput();
    }

    function parseEditorInput() {
        const content = playgroundTextarea.value;
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
        const match = content.match(frontmatterRegex);

        if (!match) {
            setParserStatus('error', 'Invalid Frontmatter layout (missing ---\n...---)');
            clearParsedUI();
            outBody.innerText = content;
            return;
        }

        const frontmatterText = match[1];
        const bodyText = match[2];

        // Parse key-value frontmatter lines manually (lightweight YAML parser)
        const frontmatter = {};
        const lines = frontmatterText.split(/\r?\n/);
        
        lines.forEach(line => {
            const separatorIdx = line.indexOf(':');
            if (separatorIdx > 0) {
                const key = line.substring(0, separatorIdx).trim();
                let val = line.substring(separatorIdx + 1).trim();
                
                // Parse simple array brackets: tags: [x, y]
                if (val.startsWith('[') && val.endsWith(']')) {
                    val = val.substring(1, val.length - 1).split(',').map(item => item.trim());
                } else if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                } else if (val.startsWith("'") && val.endsWith("'")) {
                    val = val.substring(1, val.length - 1);
                }
                
                frontmatter[key] = val;
            }
        });

        // Validation rule checks
        if (!frontmatter.type) {
            setParserStatus('error', 'Missing "type" metadata attribute (required)');
            clearParsedUI();
            return;
        }

        if (!frontmatter.title || !frontmatter.description) {
            setParserStatus('warning', 'Missing recommended "title" or "description"');
        } else {
            setParserStatus('success', 'Perfect Match');
        }

        // Search for relative links in body e.g. [Link Text](path/file.md)
        const linkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
        const links = [];
        let linkMatch;
        while ((linkMatch = linkRegex.exec(bodyText)) !== null) {
            links.push(linkMatch[2]);
        }

        // Infer concept ID from title/type
        let inferredId = 'concept_document';
        if (frontmatter.title) {
            const folder = frontmatter.type.toLowerCase().includes('table') ? 'tables' : 
                           frontmatter.type.toLowerCase().includes('api') ? 'apis' : 'concepts';
            inferredId = `${folder}/${frontmatter.title.toLowerCase().replace(/\s+/g, '_').replace(/_table$/, '')}`;
        }
        
        // Update UI
        outId.innerText = inferredId;
        outType.innerText = frontmatter.type;
        outTitle.innerText = frontmatter.title || '(Untitled)';
        outDesc.innerText = frontmatter.description || '(No description)';
        outResource.innerText = frontmatter.resource || 'None';
        
        // Display tags
        outTags.innerHTML = '';
        if (Array.isArray(frontmatter.tags)) {
            frontmatter.tags.forEach(tag => {
                const pill = document.createElement('span');
                pill.className = 'tag-pill';
                pill.innerText = tag;
                outTags.appendChild(pill);
            });
        } else if (frontmatter.tags) {
            const pill = document.createElement('span');
            pill.className = 'tag-pill';
            pill.innerText = frontmatter.tags;
            outTags.appendChild(pill);
        } else {
            outTags.innerHTML = '<span class="text-muted">None</span>';
        }

        // Display links
        outLinks.innerHTML = '';
        if (links.length > 0) {
            links.forEach(link => {
                const pill = document.createElement('span');
                pill.className = 'link-pill';
                pill.innerText = link;
                outLinks.appendChild(pill);
            });
        } else {
            outLinks.innerHTML = '<span class="text-muted">No links detected</span>';
        }

        outBody.innerText = bodyText;
    }

    function setParserStatus(type, message) {
        parserStatus.className = 'status-pill';
        if (type === 'success') {
            parserStatus.classList.add('status-success');
            parserStatus.innerText = message;
        } else if (type === 'warning') {
            parserStatus.classList.add('status-warning');
            parserStatus.innerText = message;
        } else if (type === 'error') {
            parserStatus.classList.add('status-error');
            parserStatus.innerText = message;
        }
    }

    function clearParsedUI() {
        outId.innerText = '—';
        outType.innerText = '—';
        outTitle.innerText = '—';
        outDesc.innerText = '—';
        outResource.innerText = '—';
        outTags.innerHTML = '';
        outLinks.innerHTML = '';
    }
});

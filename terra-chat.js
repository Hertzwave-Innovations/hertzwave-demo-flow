/**
 * ═══════════════════════════════════════════════════════════
 *  ASK TERRACAP — Self-contained Chatbot Widget
 *  Version: 1.0.0 | TerraCAP v1.2.0
 *  
 *  USAGE: Add one line before </body> on any page:
 *    <script src="terra-chat.js"></script>
 *
 *  For server deployments, use the full path:
 *    <script src="/assets/js/terra-chat.js"></script>
 *
 *  OPTIONAL: Pass page context for contextual answers:
 *    <script>
 *      TerraChat.init({
 *        page: 'dashboard',
 *        pageName: 'Sustainability Dashboard',
 *        period: 'FY 2025-26',
 *        context: { totalEmissions: 12847, scope1: 3421 }
 *      });
 *    </script>
 *
 *  The widget auto-injects its CSS + DOM into <body>.
 *  z-index: FAB=900, Panel=950 (below Help Panel's 1000).
 *  Keyboard: Ctrl+K toggles, Escape closes.
 * ═══════════════════════════════════════════════════════════
 */
(function () {
    'use strict';

    // Prevent double-load
    if (window.TerraChat) return;

    // ── DEFAULT STATE ──
    const state = {
        open: false,
        messages: [],
        page: 'unknown',
        pageName: 'TerraCAP',
        period: '',
        context: {},
        apiEndpoint: '/api/v1/chat',
        sessionId: 'tc_' + Math.random().toString(36).slice(2, 10)
    };

    // ── QUICK PROMPTS PER PAGE ──
    const PAGE_PROMPTS = {
        dashboard: [
            { icon: 'fa-chart-line', text: 'Why did Scope 1 emissions increase this year?' },
            { icon: 'fa-exclamation-triangle', text: 'What are the top compliance gaps for BRSR?' },
            { icon: 'fa-bullseye', text: 'Am I on track for the NetZero 2070 target?' },
            { icon: 'fa-lightbulb', text: 'Suggest actions to reduce Scope 2 further.' }
        ],
        'brsr-mapper': [
            { icon: 'fa-clipboard-check', text: 'What is my current BRSR readiness score?' },
            { icon: 'fa-exclamation-circle', text: 'Which Principles have the most gaps?' },
            { icon: 'fa-file-export', text: 'Can I generate a BRSR report now?' },
            { icon: 'fa-database', text: 'What data is still missing for BRSR?' }
        ],
        'netzero': [
            { icon: 'fa-route', text: 'Am I on track for the 2070 target?' },
            { icon: 'fa-bolt', text: 'What is my current annual reduction rate?' },
            { icon: 'fa-solar-panel', text: 'Model the impact of switching to renewables.' },
            { icon: 'fa-rupee-sign', text: 'Show the financial impact of my pathway.' }
        ],
        'greenco': [
            { icon: 'fa-leaf', text: 'What is my GreenCo readiness level?' },
            { icon: 'fa-tasks', text: 'Which GreenCo criteria need attention?' },
            { icon: 'fa-chart-bar', text: 'Compare my score with industry benchmarks.' },
            { icon: 'fa-file-alt', text: 'Generate a GreenCo assessment summary.' }
        ],
        'data-management': [
            { icon: 'fa-database', text: 'What data quality issues exist?' },
            { icon: 'fa-calendar-alt', text: 'Which months have missing data?' },
            { icon: 'fa-upload', text: 'How do I bulk import emissions data?' },
            { icon: 'fa-check-circle', text: 'Validate my latest data entries.' }
        ],
        'default': [
            { icon: 'fa-chart-pie', text: 'Give me a quick emissions summary.' },
            { icon: 'fa-exclamation-triangle', text: 'Are there any compliance gaps?' },
            { icon: 'fa-lightbulb', text: 'What actions can reduce my footprint?' },
            { icon: 'fa-question-circle', text: 'What can you help me with?' }
        ]
    };

    // ── INJECT DEPENDENCIES (Font Awesome + Outfit font) ──
    function injectDependencies() {
        // Font Awesome — only add if not already loaded
        if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
            var fa = document.createElement('link');
            fa.rel = 'stylesheet';
            fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
            document.head.appendChild(fa);
        }
        // Outfit font — only add if not already loaded
        if (!document.querySelector('link[href*="Outfit"]')) {
            var outfit = document.createElement('link');
            outfit.rel = 'stylesheet';
            outfit.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
            document.head.appendChild(outfit);
        }
    }

    // ── INJECT CSS ──
    function injectStyles() {
        const style = document.createElement('style');
        style.id = 'terra-chat-styles';
        style.textContent = `
/* ═══ ASK TERRACAP CHATBOT ═══ */
.tc-fab{position:fixed;bottom:28px;right:28px;z-index:900;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#4A7C59 0%,#355b3f 100%);border:none;cursor:pointer;box-shadow:0 6px 24px rgba(74,124,89,0.45),0 2px 8px rgba(0,0,0,0.12);display:flex;align-items:center;justify-content:center;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);color:#fff;font-size:1.4rem;}
.tc-fab:hover{transform:scale(1.08);box-shadow:0 8px 32px rgba(74,124,89,0.55),0 4px 12px rgba(0,0,0,0.15);}
.tc-fab.open{transform:rotate(90deg) scale(0.9);opacity:0;pointer-events:none;}
.tc-fab::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid #4A7C59;opacity:0;animation:tcPulse 3s ease-in-out infinite;}
@keyframes tcPulse{0%,100%{opacity:0;transform:scale(1);}50%{opacity:0.3;transform:scale(1.2);}}
.tc-fab-badge{position:absolute;top:4px;right:4px;width:14px;height:14px;background:#A8E6A3;border:2px solid #fff;border-radius:50%;}

.tc-panel{position:fixed;bottom:28px;right:28px;z-index:950;width:420px;height:600px;max-height:calc(100vh - 100px);background:#fff;border-radius:20px;box-shadow:0 12px 48px rgba(0,0,0,0.18),0 0 0 1px rgba(0,0,0,0.05);display:flex;flex-direction:column;overflow:hidden;transform:scale(0.85) translateY(30px);opacity:0;pointer-events:none;transform-origin:bottom right;transition:all 0.38s cubic-bezier(0.34,1.56,0.64,1);}
.tc-panel.open{transform:scale(1) translateY(0);opacity:1;pointer-events:all;}

.tc-header{background:linear-gradient(135deg,#4A7C59 0%,#355b3f 100%);padding:1rem 1.25rem;display:flex;align-items:center;gap:12px;position:relative;overflow:hidden;flex-shrink:0;}
.tc-header::before{content:'';position:absolute;top:-40px;right:-20px;width:140px;height:140px;background:rgba(255,255,255,0.06);border-radius:50%;}
.tc-header::after{content:'';position:absolute;bottom:-30px;left:40px;width:80px;height:80px;background:rgba(168,230,163,0.08);border-radius:50%;}

.tc-avatar{width:40px;height:40px;background:rgba(255,255,255,0.18);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;position:relative;z-index:1;flex-shrink:0;}
.tc-avatar-dot{position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;background:#A8E6A3;border:2px solid #4A7C59;border-radius:50%;}
.tc-header-text{flex:1;position:relative;z-index:1;}
.tc-header-title{font-size:1rem;font-weight:700;color:#fff;line-height:1.2;font-family:'Outfit',system-ui,sans-serif;}
.tc-header-sub{font-size:0.72rem;color:rgba(255,255,255,0.65);margin-top:2px;font-family:'Outfit',system-ui,sans-serif;}
.tc-ctx-badge{display:inline-block;background:rgba(255,255,255,0.15);padding:1px 8px;border-radius:8px;font-weight:500;font-size:0.68rem;margin-left:4px;}
.tc-header-actions{display:flex;gap:6px;position:relative;z-index:1;}
.tc-hdr-btn{width:32px;height:32px;background:rgba(255,255,255,0.12);border:none;border-radius:8px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;transition:background 0.2s;}
.tc-hdr-btn:hover{background:rgba(255,255,255,0.25);}

.tc-context-bar{display:flex;align-items:center;gap:8px;padding:8px 16px;background:#E9F1EC;border-bottom:1px solid #d3e0d7;font-size:0.78rem;color:#4A7C59;flex-shrink:0;font-family:'Outfit',system-ui,sans-serif;}
.tc-context-bar i{font-size:0.7rem;}
.tc-ctx-page{font-weight:600;}
.tc-ctx-sep{color:#9ab5a3;}

.tc-messages{flex:1;overflow-y:auto;padding:1rem 1rem 0.5rem;display:flex;flex-direction:column;gap:1rem;scroll-behavior:smooth;}
.tc-messages::-webkit-scrollbar{width:4px;}
.tc-messages::-webkit-scrollbar-thumb{background:#E5E9E6;border-radius:4px;}

.tc-msg{display:flex;gap:10px;max-width:92%;animation:tcMsgIn 0.35s ease;}
@keyframes tcMsgIn{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
.tc-msg.bot{align-self:flex-start;}
.tc-msg.user{align-self:flex-end;flex-direction:row-reverse;}
.tc-msg-avatar{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0;margin-top:2px;}
.tc-msg.bot .tc-msg-avatar{background:#E9F1EC;color:#4A7C59;}
.tc-msg.user .tc-msg-avatar{background:#4A7C59;color:#fff;}
.tc-msg-body{display:flex;flex-direction:column;gap:4px;}
.tc-msg-bubble{padding:0.75rem 1rem;border-radius:16px;font-size:0.88rem;line-height:1.55;font-family:'Outfit',system-ui,sans-serif;}
.tc-msg.bot .tc-msg-bubble{background:#f0f4f1;border-bottom-left-radius:4px;color:#22302A;}
.tc-msg.user .tc-msg-bubble{background:#4A7C59;color:#fff;border-bottom-right-radius:4px;}
.tc-msg-time{font-size:0.68rem;color:#5B6E64;padding:0 4px;}
.tc-msg.user .tc-msg-time{text-align:right;}

.tc-insight-card{margin-top:8px;background:#fff;border:1px solid #E5E9E6;border-radius:12px;padding:12px;font-size:0.82rem;font-family:'Outfit',system-ui,sans-serif;}
.tc-insight-header{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-weight:600;font-size:0.8rem;color:#4A7C59;}
.tc-insight-header i{font-size:0.75rem;}
.tc-insight-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f2f0;font-size:0.82rem;}
.tc-insight-row:last-child{border-bottom:none;}
.tc-insight-label{color:#5B6E64;}
.tc-insight-val{font-weight:600;color:#22302A;}
.tc-insight-val.up{color:#E53E3E;}
.tc-insight-val.down{color:#48BB78;}

.tc-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
.tc-action-chip{padding:5px 12px;background:#fff;border:1px solid #E5E9E6;border-radius:16px;font-family:'Outfit',system-ui,sans-serif;font-size:0.78rem;color:#4A7C59;font-weight:500;cursor:pointer;transition:all 0.2s;}
.tc-action-chip:hover{background:#4A7C59;color:#fff;border-color:#4A7C59;}

.tc-typing{display:flex;gap:10px;align-self:flex-start;max-width:92%;}
.tc-typing-dots{display:flex;gap:5px;align-items:center;padding:12px 18px;background:#f0f4f1;border-radius:16px;border-bottom-left-radius:4px;}
.tc-typing-dot{width:7px;height:7px;background:#4A7C59;border-radius:50%;opacity:0.4;animation:tcDotBounce 1.4s ease-in-out infinite;}
.tc-typing-dot:nth-child(2){animation-delay:0.2s;}
.tc-typing-dot:nth-child(3){animation-delay:0.4s;}
@keyframes tcDotBounce{0%,60%,100%{transform:translateY(0);opacity:0.4;}30%{transform:translateY(-6px);opacity:1;}}

.tc-welcome{display:flex;flex-direction:column;align-items:center;padding:1.5rem 1rem;text-align:center;font-family:'Outfit',system-ui,sans-serif;}
.tc-welcome-icon{width:56px;height:56px;background:#E9F1EC;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#4A7C59;margin-bottom:12px;}
.tc-welcome-title{font-size:1.05rem;font-weight:700;color:#22302A;margin-bottom:4px;}
.tc-welcome-sub{font-size:0.82rem;color:#5B6E64;max-width:280px;line-height:1.5;}

.tc-quick-prompts{display:flex;flex-direction:column;gap:6px;width:100%;margin-top:1rem;padding:0 0.5rem;}
.tc-quick-prompt{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #E5E9E6;border-radius:10px;cursor:pointer;transition:all 0.2s;text-align:left;font-family:'Outfit',system-ui,sans-serif;font-size:0.82rem;color:#22302A;}
.tc-quick-prompt:hover{border-color:#4A7C59;background:#E9F1EC;transform:translateX(3px);}
.tc-qp-icon{width:30px;height:30px;background:#E9F1EC;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#4A7C59;font-size:0.75rem;flex-shrink:0;}
.tc-quick-prompt:hover .tc-qp-icon{background:#4A7C59;color:#fff;}

.tc-input-area{padding:12px 14px;border-top:1px solid #E5E9E6;background:#fff;flex-shrink:0;}
.tc-input-row{display:flex;align-items:flex-end;gap:8px;background:#f5f7f5;border:2px solid #E5E9E6;border-radius:14px;padding:6px 6px 6px 14px;transition:border-color 0.2s;}
.tc-input-row:focus-within{border-color:#4A7C59;background:#fff;}
.tc-input{flex:1;border:none;outline:none;background:transparent;font-family:'Outfit',system-ui,sans-serif;font-size:0.9rem;color:#22302A;resize:none;max-height:80px;line-height:1.5;padding:6px 0;}
.tc-input::placeholder{color:#a0afa6;}
.tc-send-btn{width:36px;height:36px;background:#4A7C59;border:none;border-radius:10px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.85rem;transition:all 0.2s;flex-shrink:0;}
.tc-send-btn:hover{background:#355b3f;}
.tc-send-btn:disabled{background:#E5E9E6;color:#5B6E64;cursor:not-allowed;}
.tc-input-hint{display:flex;align-items:center;justify-content:space-between;padding:6px 4px 0;font-size:0.68rem;color:#5B6E64;font-family:'Outfit',system-ui,sans-serif;}
.tc-input-hint kbd{background:#edf0ed;padding:1px 5px;border-radius:3px;font-family:inherit;font-size:0.65rem;}
.tc-input-hint strong{color:#4A7C59;font-weight:600;}

.tc-footer{text-align:center;padding:6px;font-size:0.65rem;color:#5B6E64;background:#fafbfa;border-top:1px solid #f0f2f0;flex-shrink:0;font-family:'Outfit',system-ui,sans-serif;}
.tc-footer strong{color:#4A7C59;font-weight:600;}

@media(max-width:768px){
.tc-panel{width:calc(100vw - 16px);height:calc(100vh - 80px);max-height:none;bottom:8px;right:8px;border-radius:16px;}
.tc-fab{bottom:20px;right:20px;}
}`;
        document.head.appendChild(style);
    }

    // ── INJECT DOM ──
    function injectDOM() {
        const prompts = PAGE_PROMPTS[state.page] || PAGE_PROMPTS['default'];

        // FAB
        const fab = document.createElement('button');
        fab.className = 'tc-fab';
        fab.id = 'tcFab';
        fab.title = 'Ask TerraCAP';
        fab.innerHTML = '<i class="fas fa-comment-dots"></i><div class="tc-fab-badge"></div>';
        fab.addEventListener('click', toggle);
        document.body.appendChild(fab);

        // Panel
        const panel = document.createElement('div');
        panel.className = 'tc-panel';
        panel.id = 'tcPanel';
        panel.innerHTML = `
            <div class="tc-header">
                <div class="tc-avatar"><i class="fas fa-leaf"></i><div class="tc-avatar-dot"></div></div>
                <div class="tc-header-text">
                    <div class="tc-header-title">Ask TerraCAP</div>
                    <div class="tc-header-sub">AI-powered ESG assistant <span class="tc-ctx-badge" id="tcCtxBadge">${state.pageName}</span></div>
                </div>
                <div class="tc-header-actions">
                    <button class="tc-hdr-btn" id="tcClearBtn" title="New conversation"><i class="fas fa-redo-alt"></i></button>
                    <button class="tc-hdr-btn" id="tcCloseBtn" title="Close"><i class="fas fa-times"></i></button>
                </div>
            </div>
            <div class="tc-context-bar">
                <i class="fas fa-crosshairs"></i>
                <span>Context:</span>
                <span class="tc-ctx-page" id="tcCtxPage">${state.pageName}</span>
                ${state.period ? '<span class="tc-ctx-sep">·</span><span>' + state.period + '</span>' : ''}
            </div>
            <div class="tc-messages" id="tcMessages">
                <div class="tc-welcome" id="tcWelcome">
                    <div class="tc-welcome-icon"><i class="fas fa-leaf"></i></div>
                    <div class="tc-welcome-title">Hi! I'm your ESG assistant.</div>
                    <div class="tc-welcome-sub">I can see the data on this page. Ask me about emissions, trends, compliance gaps, or anything ESG.</div>
                    <div class="tc-quick-prompts" id="tcQuickPrompts">
                        ${prompts.map(p => `
                            <button class="tc-quick-prompt" data-prompt="${p.text.replace(/"/g, '&quot;')}">
                                <div class="tc-qp-icon"><i class="fas ${p.icon}"></i></div>
                                <span>${p.text}</span>
                            </button>`).join('')}
                    </div>
                </div>
            </div>
            <div class="tc-input-area">
                <div class="tc-input-row">
                    <textarea class="tc-input" id="tcInput" rows="1" placeholder="Ask about your emissions, compliance, targets…"></textarea>
                    <button class="tc-send-btn" id="tcSendBtn" disabled><i class="fas fa-arrow-up"></i></button>
                </div>
                <div class="tc-input-hint">
                    <span>Contextual to: <strong>${state.pageName}</strong></span>
                    <span><kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> new line</span>
                </div>
            </div>
            <div class="tc-footer">Powered by <strong>Hertzwave AI</strong> · TerraCAP v1.2.0</div>`;
        document.body.appendChild(panel);

        // Wire up event listeners
        document.getElementById('tcCloseBtn').addEventListener('click', toggle);
        document.getElementById('tcClearBtn').addEventListener('click', clearChat);
        document.getElementById('tcSendBtn').addEventListener('click', send);

        const input = document.getElementById('tcInput');
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
        input.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
            document.getElementById('tcSendBtn').disabled = !this.value.trim();
        });

        // Quick prompt clicks (event delegation)
        document.getElementById('tcQuickPrompts').addEventListener('click', function (e) {
            const btn = e.target.closest('.tc-quick-prompt');
            if (btn) {
                const text = btn.getAttribute('data-prompt');
                document.getElementById('tcInput').value = text;
                document.getElementById('tcSendBtn').disabled = false;
                send();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggle(); }
            if (e.key === 'Escape' && state.open) { toggle(); }
        });
    }

    // ── TOGGLE ──
    function toggle() {
        state.open = !state.open;
        document.getElementById('tcPanel').classList.toggle('open', state.open);
        document.getElementById('tcFab').classList.toggle('open', state.open);
        if (state.open) setTimeout(function () { document.getElementById('tcInput').focus(); }, 400);
    }

    // ── SEND ──
    function send() {
        var input = document.getElementById('tcInput');
        var text = input.value.trim();
        if (!text) return;

        var welcome = document.getElementById('tcWelcome');
        if (welcome) welcome.style.display = 'none';

        addMessage('user', text);
        input.value = '';
        input.style.height = 'auto';
        document.getElementById('tcSendBtn').disabled = true;

        showTyping();

        // ──────────────────────────────────────────────
        // PRODUCTION: Replace this block with your API call
        // ──────────────────────────────────────────────
        // fetch(state.apiEndpoint, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         message: text,
        //         page: state.page,
        //         pageContext: state.context,
        //         history: state.messages,
        //         sessionId: state.sessionId
        //     })
        // })
        // .then(r => r.json())
        // .then(data => {
        //     hideTyping();
        //     addMessage('bot', data.reply, data.extras);
        // })
        // .catch(err => {
        //     hideTyping();
        //     addMessage('bot', 'Sorry, I couldn\'t process that. Please try again.');
        // });
        //
        // FOR NOW: simulated responses
        setTimeout(function () {
            hideTyping();
            generateSimulatedResponse(text);
        }, 1200 + Math.random() * 800);
        // ──────────────────────────────────────────────
    }

    // ── ADD MESSAGE ──
    function addMessage(type, content, extras) {
        var msgs = document.getElementById('tcMessages');
        var time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        var el = document.createElement('div');
        el.className = 'tc-msg ' + type;

        var avatarIcon = type === 'bot' ? 'fa-leaf' : 'fa-user';
        var html = '<div class="tc-msg-avatar"><i class="fas ' + avatarIcon + '"></i></div><div class="tc-msg-body"><div class="tc-msg-bubble">' + content + '</div>';

        if (extras && extras.insight) {
            html += '<div class="tc-insight-card"><div class="tc-insight-header"><i class="fas fa-chart-bar"></i> ' + extras.insight.title + '</div>';
            extras.insight.rows.forEach(function (r) {
                var cls = r.trend === 'up' ? 'up' : r.trend === 'down' ? 'down' : '';
                html += '<div class="tc-insight-row"><span class="tc-insight-label">' + r.label + '</span><span class="tc-insight-val ' + cls + '">' + r.value + '</span></div>';
            });
            html += '</div>';
        }

        if (extras && extras.actions) {
            html += '<div class="tc-actions">';
            extras.actions.forEach(function (a) {
                html += '<button class="tc-action-chip" data-action="' + a.replace(/"/g, '&quot;') + '">' + a + '</button>';
            });
            html += '</div>';
        }

        html += '<div class="tc-msg-time">' + time + '</div></div>';
        el.innerHTML = html;

        // Wire action chips
        el.querySelectorAll('.tc-action-chip').forEach(function (chip) {
            chip.addEventListener('click', function () {
                document.getElementById('tcInput').value = this.getAttribute('data-action');
                document.getElementById('tcSendBtn').disabled = false;
                send();
            });
        });

        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
        state.messages.push({ type: type, content: content, time: time });
    }

    // ── TYPING INDICATOR ──
    function showTyping() {
        var msgs = document.getElementById('tcMessages');
        var el = document.createElement('div');
        el.className = 'tc-typing';
        el.id = 'tcTyping';
        el.innerHTML = '<div class="tc-msg-avatar" style="background:#E9F1EC;color:#4A7C59;border-radius:10px;"><i class="fas fa-leaf"></i></div><div class="tc-typing-dots"><div class="tc-typing-dot"></div><div class="tc-typing-dot"></div><div class="tc-typing-dot"></div></div>';
        msgs.appendChild(el);
        msgs.scrollTop = msgs.scrollHeight;
    }

    function hideTyping() {
        var el = document.getElementById('tcTyping');
        if (el) el.remove();
    }

    // ── CLEAR CHAT ──
    function clearChat() {
        var msgs = document.getElementById('tcMessages');
        var prompts = PAGE_PROMPTS[state.page] || PAGE_PROMPTS['default'];
        msgs.innerHTML = '';
        state.messages = [];

        var welcome = document.createElement('div');
        welcome.className = 'tc-welcome';
        welcome.id = 'tcWelcome';
        welcome.innerHTML = '<div class="tc-welcome-icon"><i class="fas fa-leaf"></i></div>'
            + '<div class="tc-welcome-title">Hi! I\'m your ESG assistant.</div>'
            + '<div class="tc-welcome-sub">I can see the data on this page. Ask me about emissions, trends, compliance gaps, or anything ESG.</div>'
            + '<div class="tc-quick-prompts" id="tcQuickPrompts">'
            + prompts.map(function (p) {
                return '<button class="tc-quick-prompt" data-prompt="' + p.text.replace(/"/g, '&quot;') + '"><div class="tc-qp-icon"><i class="fas ' + p.icon + '"></i></div><span>' + p.text + '</span></button>';
            }).join('')
            + '</div>';
        msgs.appendChild(welcome);

        document.getElementById('tcQuickPrompts').addEventListener('click', function (e) {
            var btn = e.target.closest('.tc-quick-prompt');
            if (btn) {
                document.getElementById('tcInput').value = btn.getAttribute('data-prompt');
                document.getElementById('tcSendBtn').disabled = false;
                send();
            }
        });
    }

    // ── SIMULATED RESPONSES (replace with real API) ──
    function generateSimulatedResponse(query) {
        var q = query.toLowerCase();

        if (q.includes('scope 1') && (q.includes('increase') || q.includes('why'))) {
            addMessage('bot',
                'Scope 1 emissions rose <strong>2.1%</strong> YoY, driven primarily by two factors:<br><br>'
                + '<strong>1.</strong> Diesel generator usage at the Vizag facility spiked during Q2 grid outages (+340 tCO₂e).<br>'
                + '<strong>2.</strong> The new R&D lab commissioning added refrigerant emissions (R-410A) not present in the baseline year.<br><br>'
                + 'Without the generator spike, Scope 1 would have been <strong>flat at –0.3%</strong>.',
                {
                    insight: {
                        title: 'Scope 1 breakdown',
                        rows: [
                            { label: 'Stationary combustion', value: '1,840 tCO₂e', trend: 'up' },
                            { label: 'Mobile combustion', value: '620 tCO₂e', trend: 'down' },
                            { label: 'Fugitive (refrigerants)', value: '561 tCO₂e', trend: 'up' },
                            { label: 'Process emissions', value: '400 tCO₂e', trend: '' }
                        ]
                    },
                    actions: ['Show monthly trend', 'Compare with industry', 'Suggest reductions']
                }
            );
        } else if (q.includes('compliance') || q.includes('brsr') || q.includes('gap')) {
            addMessage('bot',
                'Based on your current data, I see <strong>3 compliance gaps</strong> for BRSR FY2025-26:<br><br>'
                + '<strong>⚠ Principle 6 (Environment):</strong> Water recycling data missing for Q3.<br>'
                + '<strong>⚠ Principle 3 (Employee Well-being):</strong> Safety incident records incomplete — only 2 of 4 facilities.<br>'
                + '<strong>⚠ Principle 2 (Governance):</strong> Board ESG committee minutes not uploaded for H2.<br><br>'
                + 'Overall BRSR readiness is at <strong>74%</strong>. Addressing these three would push it to ~92%.',
                { actions: ['Open BRSR Mapper', 'Generate gap report', 'Notify data owners'] }
            );
        } else if (q.includes('netzero') || q.includes('net zero') || q.includes('2070') || q.includes('track')) {
            addMessage('bot',
                'Based on your current trajectory, you\'re <strong>slightly behind</strong> the linear pathway to NetZero 2070.<br><br>'
                + 'Your annualised reduction rate is <strong>–5.8%</strong>, but the required rate is <strong>–7.2%</strong>. '
                + 'The good news: Scope 2 reduction of 12.4% this year is excellent — continuing renewable energy procurement will close the gap.<br><br>'
                + '<strong>Key lever:</strong> Switching 40% of your fleet to EV would add –1.8% annual reduction, putting you on track.',
                {
                    insight: {
                        title: 'NetZero trajectory',
                        rows: [
                            { label: 'Current annual reduction', value: '–5.8%/yr', trend: 'down' },
                            { label: 'Required for 2070 target', value: '–7.2%/yr', trend: '' },
                            { label: 'Gap', value: '1.4% shortfall', trend: 'up' },
                            { label: 'Est. year to close gap', value: 'FY 2027-28', trend: '' }
                        ]
                    },
                    actions: ['Open NetZero Pathfinder', 'Model EV transition', 'View financial impact']
                }
            );
        } else if (q.includes('scope 2') || q.includes('reduce') || q.includes('suggest')) {
            addMessage('bot',
                'Great progress on Scope 2 (–12.4% YoY). Top 3 actions to accelerate:<br><br>'
                + '<strong>1. Solar PPA expansion</strong> — Adding ground-mount at Vizag could offset 1,200 tCO₂e/yr (₹3.2 Cr capex, 4.1-yr payback).<br><br>'
                + '<strong>2. Green tariff migration</strong> — 3 of 5 facilities still on standard DISCOM. KERC Group Open Access would cut Scope 2 by ~15%.<br><br>'
                + '<strong>3. Energy efficiency</strong> — EPI is 22% above BEE benchmark. LED + HVAC retrofit = ~800 tCO₂e reduction.',
                { actions: ['Model Solar PPA', 'Check OA eligibility', 'View BEE benchmarks'] }
            );
        } else if (q.includes('data quality') || q.includes('missing') || q.includes('validate')) {
            addMessage('bot',
                'Your current data quality score is <strong>78/100</strong>. Key issues:<br><br>'
                + '<strong>⚠ Missing data:</strong> October and November Scope 3 (Category 4 & 6) not yet uploaded.<br>'
                + '<strong>⚠ Estimation %:</strong> 34% of Scope 3 is estimated — target is under 20%.<br>'
                + '<strong>✓ Strong areas:</strong> Scope 1 & 2 are 96% activity-based with invoices attached.<br><br>'
                + 'Uploading the missing months and switching 2 suppliers to primary data would raise your score to <strong>89</strong>.',
                { actions: ['View missing data report', 'Contact suppliers', 'Open Data Management'] }
            );
        } else if (q.includes('greenco') || q.includes('green co')) {
            addMessage('bot',
                'Your GreenCo assessment status:<br><br>'
                + '<strong>Current level:</strong> Silver (score: 62/100)<br>'
                + '<strong>Gap to Gold:</strong> 13 points across 3 criteria — Energy Efficiency (5 pts), Water Stewardship (4 pts), Material Circularity (4 pts).<br><br>'
                + 'Implementing the planned LED retrofit alone would add 5 points, putting you at <strong>67 (Gold threshold: 75)</strong>.',
                { actions: ['Open GreenCo module', 'View criteria breakdown', 'Compare with peers'] }
            );
        } else {
            addMessage('bot',
                'I can see the <strong>' + state.pageName + '</strong> data' + (state.period ? ' for ' + state.period : '') + '.<br><br>'
                + 'I can help you with:<br>'
                + '• Drilling into any scope or emission source<br>'
                + '• Identifying compliance gaps across BRSR, GRI, CDP<br>'
                + '• Checking your NetZero trajectory<br>'
                + '• Data quality issues and missing entries<br>'
                + '• Generating insights or reports<br><br>'
                + 'What would you like to explore?',
                { actions: ['Scope breakdown', 'Compliance status', 'Data quality issues', 'Export summary'] }
            );
        }
    }

    // ── UPDATE CONTEXT (call from SPA router) ──
    function updateContext(opts) {
        if (opts.page) state.page = opts.page;
        if (opts.pageName) state.pageName = opts.pageName;
        if (opts.period) state.period = opts.period;
        if (opts.context) state.context = opts.context;

        var badge = document.getElementById('tcCtxBadge');
        var ctxPage = document.getElementById('tcCtxPage');
        if (badge) badge.textContent = state.pageName;
        if (ctxPage) ctxPage.textContent = state.pageName;
    }

    // ── PUBLIC API ──
    window.TerraChat = {
        init: function (opts) {
            opts = opts || {};
            state.page = opts.page || 'dashboard';
            state.pageName = opts.pageName || 'TerraCAP';
            state.period = opts.period || '';
            state.context = opts.context || {};
            if (opts.apiEndpoint) state.apiEndpoint = opts.apiEndpoint;

            injectDependencies();
            injectStyles();
            injectDOM();
        },
        open: function () { if (!state.open) toggle(); },
        close: function () { if (state.open) toggle(); },
        updateContext: updateContext,
        send: function (text) {
            document.getElementById('tcInput').value = text;
            document.getElementById('tcSendBtn').disabled = false;
            send();
        }
    };

    // ── AUTO-INIT if no manual init within 100ms ──
    setTimeout(function () {
        if (!document.getElementById('tcFab')) {
            // Auto-detect page from sidebar active item or <title>
            var activeNav = document.querySelector('.nav-item.active .nav-text, .nav-item.active');
            var pageName = activeNav ? activeNav.textContent.trim() : document.title.replace(' - TerraCAP', '').replace('TerraCAP - ', '');
            window.TerraChat.init({
                page: pageName.toLowerCase().replace(/\s+/g, '-'),
                pageName: pageName || 'TerraCAP'
            });
        }
    }, 100);

})();

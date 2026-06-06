import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { salesDocumentService } from '../services/sales/salesDocumentService';
import { customersApi } from '../services/customers/customersApi';
import { dashboardAggregator } from '../services/dashboard/dashboardAggregator';

const GEMINI_MODEL = 'gemini-2.5-flash';
const AI_UNAVAILABLE_MESSAGE = 'AI temporarily unavailable. Please contact support.';

const WELCOME_TEXT = `Namaste! 👋 Main PVE AI hoon.
Aapke business ke baare mein kuch bhi poochho!

Main help kar sakta hoon:
📊 Sales & Revenue analysis
⚠️ Overdue & pending alerts
📦 Stock & inventory queries
🧾 GST related questions
🧭 App navigation help`;

const QUICK_CHIPS = [
  '📊 Aaj ka summary',
  '⚠️ Overdue invoices',
  '📦 Low stock',
  '🧾 GST help',
  '🧭 Navigation',
];

const PAGE_NAMES = {
  '/dashboard': 'Dashboard',
  '/sales/tax-invoices': 'Tax Invoices page',
  '/sales/invoices': 'Tax Invoice detail',
  '/sales/quotations': 'Quotations page',
  '/sales/collections': 'Collections page',
  '/items': 'Inventory Items page',
  '/masters/inventory-items': 'Inventory Items page',
  '/customers': 'Customers page',
  '/purchase': 'Purchase page',
  '/gst': 'GST Reports page',
  '/reports': 'Reports page',
  '/settings': 'Settings page',
};

function getApiKey() {
  return String(import.meta.env.VITE_GEMINI_KEY || '').trim();
}

function geminiUrl(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function resolvePageName(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  for (const [prefix, label] of Object.entries(PAGE_NAMES)) {
    if (path.startsWith(prefix)) return label;
  }
  if (path.startsWith('/sales')) return 'Sales module';
  if (path.startsWith('/vouchers')) return 'Vouchers module';
  return path || 'Home';
}

async function fetchBusinessData() {
  try {
    const [invoices, customers, lowStockItems] = await Promise.all([
      salesDocumentService.listByKind('tax-invoices'),
      customersApi.list('ALL'),
      dashboardAggregator.lowStock(),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const monthPrefix = today.slice(0, 7);
    const overdue = invoices.filter((inv) => inv.status === 'OVERDUE');

    return {
      todaySales: invoices
        .filter((inv) => inv.date === today)
        .reduce((sum, inv) => sum + Number(inv.amount || 0), 0),
      totalOverdue: overdue,
      overdueAmount: overdue.reduce((sum, inv) => sum + Number(inv.balanceDue || 0), 0),
      lowStockItems,
      totalCustomers: customers.length,
      thisMonthSales: invoices
        .filter((inv) => String(inv.date || '').startsWith(monthPrefix))
        .reduce((sum, inv) => sum + Number(inv.amount || 0), 0),
    };
  } catch {
    return {};
  }
}

async function askGemini(userMessage, businessData, currentPage) {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('VITE_GEMINI_KEY missing in .env');
    return AI_UNAVAILABLE_MESSAGE;
  }

  const systemPrompt = `
You are PVE AI, a smart business assistant for PVE InvoicePro 360 — an Indian GST billing and inventory desktop app used by Indian businesses.

CURRENT BUSINESS DATA:
- Today's Sales: ₹${businessData.todaySales || 0}
- This Month Sales: ₹${businessData.thisMonthSales || 0}
- Overdue Invoices: ${businessData.totalOverdue?.length || 0} (₹${businessData.overdueAmount || 0})
- Low Stock Items: ${businessData.lowStockItems?.length || 0}
- Total Customers: ${businessData.totalCustomers || 0}

CURRENT PAGE USER IS ON: ${currentPage}
CURRENT DATE: ${new Date().toLocaleDateString('en-IN')}
FINANCIAL YEAR: 2026-27 (April 2026 - March 2027)

YOU HELP WITH:
1. Business questions - sales, profit, customers, stock
2. GST questions - GSTR-1, GSTR-3B, ITC, HSN codes, e-way bill, e-invoice
3. App navigation - how to create invoice, add customer, record payment, generate report etc.
4. Alerts - overdue invoices, low stock warnings
5. Financial insights and suggestions

STRICT RULES:
- Reply in Hinglish (Hindi + English mix) or simple English
- Maximum 4-5 lines per reply, be concise
- Use ₹ symbol for all amounts
- Use Indian number format (1,00,000 not 100,000)
- Be friendly and helpful like a smart CA assistant
- If data not available say so honestly
- For navigation help give simple step-by-step instructions
- Never make up financial data
`;

  const response = await fetch(geminiUrl(apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${systemPrompt}\n\nUser ka sawal: ${userMessage}` }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error('Gemini API error:', data.error.message || data.error);
    return AI_UNAVAILABLE_MESSAGE;
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, kuch response nahi mila. Dobara try karo.';
}

const styles = `
@keyframes pve-ai-pulse {
  0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.7); }
  70% { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
  100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
}
@keyframes pve-ai-slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pve-ai-bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-4px); }
}
.pve-ai-fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  animation: pve-ai-pulse 2s infinite;
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pve-ai-fab:hover { transform: scale(1.1); }
.pve-ai-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}
.pve-ai-window {
  position: fixed;
  bottom: 92px;
  right: 24px;
  z-index: 9999;
  width: 360px;
  height: 480px;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: pve-ai-slide-up 0.3s ease;
}
.pve-ai-header {
  height: 56px;
  background: #1e293b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
}
.pve-ai-header-btn {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 6px;
}
.pve-ai-header-btn:hover { background: rgba(255,255,255,0.12); }
.pve-ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #fff;
}
.pve-ai-msg {
  max-width: 85%;
  margin-bottom: 10px;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
}
.pve-ai-msg-user {
  margin-left: auto;
  background: #3b82f6;
  color: #fff;
  border-radius: 16px 16px 4px 16px;
}
.pve-ai-msg-ai {
  margin-right: auto;
  background: #f1f5f9;
  color: #0f172a;
  border-radius: 16px 16px 16px 4px;
}
.pve-ai-msg-time {
  font-size: 10px;
  opacity: 0.65;
  margin-top: 4px;
}
.pve-ai-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 16px 8px;
  flex-shrink: 0;
}
.pve-ai-chip {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
.pve-ai-chip:hover { background: #eff6ff; border-color: #3b82f6; }
.pve-ai-input-bar {
  height: 60px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  flex-shrink: 0;
}
.pve-ai-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 12px 8px;
  font-size: 14px;
}
.pve-ai-send {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: #3b82f6;
  color: #fff;
  cursor: pointer;
  font-size: 16px;
}
.pve-ai-send:disabled { opacity: 0.5; cursor: not-allowed; }
.pve-ai-typing {
  display: inline-flex;
  gap: 4px;
  padding: 10px 12px;
  background: #f1f5f9;
  border-radius: 16px 16px 16px 4px;
}
.pve-ai-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  animation: pve-ai-bounce 1.2s infinite ease-in-out;
}
.pve-ai-dot:nth-child(2) { animation-delay: 0.15s; }
.pve-ai-dot:nth-child(3) { animation-delay: 0.3s; }
.pve-ai-tooltip {
  position: absolute;
  bottom: 64px;
  right: 0;
  background: #0f172a;
  color: #fff;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.pve-ai-fab-wrap:hover .pve-ai-tooltip { opacity: 1; }
`;

export default function AIAssistant() {
  const location = useLocation();
  const currentPage = useMemo(() => resolvePageName(location.pathname), [location.pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [businessData, setBusinessData] = useState({});
  const [alertCount, setAlertCount] = useState(0);
  const [badgeVisible, setBadgeVisible] = useState(true);
  const [welcomeShown, setWelcomeShown] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const refreshBusinessData = useCallback(async () => {
    const data = await fetchBusinessData();
    setBusinessData(data);
    const count = (data.totalOverdue?.length || 0) + (data.lowStockItems?.length || 0);
    setAlertCount(count);
    return data;
  }, []);

  useEffect(() => {
    void refreshBusinessData();
  }, [refreshBusinessData]);

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isLoading, isOpen, scrollToBottom]);

  useEffect(() => {
    if (isOpen && !welcomeShown) {
      setMessages([{ role: 'ai', text: WELCOME_TEXT, time: formatTime() }]);
      setWelcomeShown(true);
    }
  }, [isOpen, welcomeShown]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = String(text || '').trim();
      if (!trimmed || isLoading) return;

      setMessages((prev) => [...prev, { role: 'user', text: trimmed, time: formatTime() }]);
      setInput('');
      setIsLoading(true);

      try {
        const freshData = await refreshBusinessData();
        const reply = await askGemini(trimmed, freshData, currentPage);
        setMessages((prev) => [...prev, { role: 'ai', text: reply, time: formatTime() }]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: 'ai', text: (err && err.message) || 'Network error. Please try again.', time: formatTime() },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, refreshBusinessData, currentPage]
  );

  const openChat = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setBadgeVisible(false);
  };

  const showChips = messages.length <= 1 && !isLoading;

  return (
    <>
      <style>{styles}</style>

      <div className="pve-ai-fab-wrap" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
        <div className="pve-ai-tooltip">PVE AI Assistant</div>
        <button
          type="button"
          className="pve-ai-fab"
          aria-label="PVE AI Assistant"
          onClick={() => (isOpen ? setIsOpen(false) : openChat())}
        >
          ✨
          {badgeVisible && alertCount > 0 ? (
            <span className="pve-ai-badge">{alertCount > 99 ? '99+' : alertCount}</span>
          ) : null}
        </button>
      </div>

      {isOpen ? (
        <div className="pve-ai-window" style={{ height: isMinimized ? 56 : 480 }}>
          <div className="pve-ai-header">
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🤖 PVE AI</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Powered by Gemini</div>
            </div>
            <div>
              <button type="button" className="pve-ai-header-btn" onClick={() => setIsMinimized((v) => !v)} aria-label="Minimize">
                −
              </button>
              <button type="button" className="pve-ai-header-btn" onClick={() => setIsOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          {!isMinimized ? (
            <>
              <div className="pve-ai-messages" ref={messagesRef}>
                {messages.map((msg, idx) => (
                  <div key={`${msg.role}-${idx}`} className={`pve-ai-msg ${msg.role === 'user' ? 'pve-ai-msg-user' : 'pve-ai-msg-ai'}`}>
                    {msg.text}
                    <div className="pve-ai-msg-time">{msg.time}</div>
                  </div>
                ))}
                {isLoading ? (
                  <div className="pve-ai-typing" aria-label="AI is typing">
                    <span className="pve-ai-dot" />
                    <span className="pve-ai-dot" />
                    <span className="pve-ai-dot" />
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>

              {showChips ? (
                <div className="pve-ai-chips">
                  {QUICK_CHIPS.map((chip) => (
                    <button key={chip} type="button" className="pve-ai-chip" onClick={() => void sendMessage(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="pve-ai-input-bar">
                <input
                  className="pve-ai-input"
                  placeholder="Kuch bhi poochho..."
                  value={input}
                  disabled={isLoading}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void sendMessage(input);
                  }}
                />
                <button type="button" className="pve-ai-send" disabled={isLoading || !input.trim()} onClick={() => void sendMessage(input)} aria-label="Send">
                  →
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

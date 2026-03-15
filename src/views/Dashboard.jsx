import { useState } from "react";
import { S, PALETTE, ASSET_CATEGORIES, DEBT_CATEGORIES, BILL_FREQUENCIES, TAX_CATEGORIES, DEFAULT_TAX_CATEGORIES, getMYLabel, getMYKey, thisMonthKey, thisYear, MONTHS } from "../lib/config.js";
import { SectionTitle, EmptyState, Row, ProgressBar, MiniBar, StatCard, IconPicker, ColorPicker, Alert } from "../components/UI.jsx";

// ── Dashboard ─────────────────────────────────────────────
export default function Dashboard({ store, selectedMonth, setSelectedMonth, setView }) {
  const { categories, expenses, budgets, income, netWorthLog, bills } = store;

  const today = new Date();
  const curKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
  const allMonths = [...new Set(expenses.map(e => getMYKey(e.date)))].sort().reverse();
  if (!allMonths.includes(curKey)) allMonths.unshift(curKey);

  const monthExpenses = expenses.filter(e => getMYKey(e.date) === selectedMonth);
  const totalSpent = monthExpenses.reduce((s,e) => s+e.amount, 0);
  const effectiveBudgets = Object.fromEntries(categories.map(c => [c.name, budgets[c.name] ?? c.budget]));
  const totalBudget = Object.values(effectiveBudgets).reduce((a,b) => a+b, 0);
  const byCategory = Object.fromEntries(categories.map(c => [c.name, monthExpenses.filter(e=>e.category===c.name).reduce((s,e)=>s+e.amount,0)]));

  // Week spend — Mon to today
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay()===0 ? -6 : 1));
  startOfWeek.setHours(0,0,0,0);
  const weekExpenses = expenses.filter(e => { const d=new Date(e.date+"T12:00:00"); return d>=startOfWeek && d<=today; });
  const weekSpent = weekExpenses.reduce((s,e) => s+e.amount, 0);
  const weekBudget = totalBudget > 0 ? (totalBudget / 4.33) : 0;

  // Budget health — sort by % used descending, split into over/warning/ok
  const catHealth = categories.map(c => {
    const spent = byCategory[c.name]||0;
    const bud = effectiveBudgets[c.name]||0;
    const pct = bud>0 ? (spent/bud)*100 : 0;
    return { ...c, spent, bud, pct };
  }).filter(c => c.bud > 0).sort((a,b) => b.pct - a.pct);

  const overBudget  = catHealth.filter(c => c.pct >= 100);
  const nearBudget  = catHealth.filter(c => c.pct >= 75 && c.pct < 100);
  const healthyCats = catHealth.filter(c => c.pct < 75);

  // Upcoming bills — next 14 days, prioritise credit cards
  const upcomingBills = bills.filter(b => {
    if (!b.nextDue) return false;
    const diff = (new Date(b.nextDue+"T12:00:00") - today) / (1000*60*60*24);
    return diff >= -1 && diff <= 14;
  }).sort((a,b) => a.nextDue.localeCompare(b.nextDue));

  const totalIncome = (income.youSalary||0)+(income.wifeSalary||0)+(income.otherIncome||0);
  const latestNW = netWorthLog.length>0 ? [...netWorthLog].sort((a,b)=>a.month.localeCompare(b.month)).at(-1) : null;
  const nwVal = latestNW ? Object.values(latestNW.assets||{}).reduce((s,v)=>s+(v||0),0) - Object.values(latestNW.liabilities||{}).reduce((s,v)=>s+(v||0),0) : null;

  const remainingBudget = totalBudget - totalSpent;
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const dayOfMonth = today.getDate();
  const dailyBudgetLeft = remainingBudget > 0 ? remainingBudget / (daysInMonth - dayOfMonth + 1) : 0;

  return (
    <div style={{ maxWidth:640, margin:"0 auto" }}>

      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, letterSpacing:"-0.5px" }}>Overview</div>
          <div style={{ fontSize:12, color:"#4b5563", marginTop:2 }}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div>
        </div>
        <select value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} style={{ ...S.input, width:"auto", padding:"7px 12px", fontSize:13, cursor:"pointer" }}>
          {allMonths.map(m => <option key={m} value={m}>{getMYLabel(m)}</option>)}
        </select>
      </div>

      {/* ── SECTION 1: Weekly Spend ── */}
      <div style={{ ...S.card, marginBottom:14, padding:20, background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.2)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:"#a5b4fc", textTransform:"uppercase", letterSpacing:"0.6px", marginBottom:4 }}>Spent This Week</div>
            <div style={{ fontSize:36, fontWeight:800, fontFamily:"monospace", letterSpacing:"-1px", color: weekSpent > weekBudget ? "#ff6b6b" : "#e8e0d5" }}>${weekSpent.toFixed(0)}</div>
            {weekBudget > 0 && <div style={{ fontSize:12, color:"#4b5563", marginTop:2 }}>of ~${weekBudget.toFixed(0)} weekly budget</div>}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:11, color:"#4b5563", marginBottom:6 }}>This month</div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"monospace", color: totalSpent > totalBudget ? "#ff6b6b" : "#a8c5a0" }}>${totalSpent.toFixed(0)}</div>
            <div style={{ fontSize:11, color:"#4b5563" }}>of ${totalBudget.toLocaleString()}</div>
          </div>
        </div>
        {/* Monthly progress bar */}
        <div style={{ height:6, background:"rgba(255,255,255,0.07)", borderRadius:99, overflow:"hidden", marginBottom:6 }}>
          <div style={{ height:"100%", width:`${Math.min((totalSpent/totalBudget)*100,100)}%`, borderRadius:99, background: totalSpent>totalBudget ? "linear-gradient(90deg,#ff6b6b,#ff4444)" : "linear-gradient(90deg,#6366f1,#a5b4fc)", transition:"width 0.5s" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#4b5563" }}>
          <span>{((totalSpent/totalBudget)*100||0).toFixed(0)}% of monthly budget used</span>
          {dailyBudgetLeft > 0 && <span style={{ color: dailyBudgetLeft < 20 ? "#ff6b6b" : "#6b7280" }}>${dailyBudgetLeft.toFixed(0)}/day left</span>}
        </div>
      </div>

      {/* ── SECTION 2: Budget Categories ── */}
      <div style={{ ...S.card, marginBottom:14, padding:20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={S.sectionTitle}>Budget Categories</div>
          <button onClick={()=>setView("budgets")} style={{ fontSize:11, color:"#6366f1", background:"none", border:"none", cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }}>Manage →</button>
        </div>

        {/* Over budget — red, always shown */}
        {overBudget.map(c => (
          <div key={c.name} style={{ marginBottom:10, padding:"10px 12px", background:"rgba(255,107,107,0.07)", borderRadius:10, border:"1px solid rgba(255,107,107,0.2)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:600 }}>{c.icon} {c.name}</span>
              <div style={{ textAlign:"right" }}>
                <span style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:"#ff6b6b" }}>${c.spent.toFixed(0)}</span>
                <span style={{ fontSize:11, color:"#4b5563" }}>/${c.bud}</span>
                <div style={{ fontSize:10, color:"#ff6b6b", fontWeight:600 }}>+${(c.spent-c.bud).toFixed(0)} over</div>
              </div>
            </div>
            <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:"100%", borderRadius:99, background:"linear-gradient(90deg,#ff6b6b,#ff4444)" }} />
            </div>
          </div>
        ))}

        {/* Near budget — amber warning */}
        {nearBudget.map(c => (
          <div key={c.name} style={{ marginBottom:10, padding:"10px 12px", background:"rgba(255,167,38,0.05)", borderRadius:10, border:"1px solid rgba(255,167,38,0.15)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>{c.icon} {c.name}</span>
              <div style={{ textAlign:"right" }}>
                <span style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:"#FFA726" }}>${c.spent.toFixed(0)}</span>
                <span style={{ fontSize:11, color:"#4b5563" }}>/${c.bud}</span>
                <div style={{ fontSize:10, color:"#FFA726" }}>{c.pct.toFixed(0)}% used · ${(c.bud-c.spent).toFixed(0)} left</div>
              </div>
            </div>
            <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${c.pct}%`, borderRadius:99, background:"linear-gradient(90deg,#FFA72688,#FFA726)" }} />
            </div>
          </div>
        ))}

        {/* Healthy — compact list */}
        {healthyCats.length > 0 && (
          <div style={{ marginTop: (overBudget.length+nearBudget.length) > 0 ? 10 : 0 }}>
            {(overBudget.length+nearBudget.length) > 0 && (
              <div style={{ fontSize:11, color:"#4b5563", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>On Track</div>
            )}
            {healthyCats.map(c => (
              <div key={c.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <span style={{ fontSize:14, width:22 }}>{c.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:12, color:"#9ca3af" }}>{c.name}</span>
                    <span style={{ fontSize:11, fontFamily:"monospace", color:"#4b5563" }}>${c.spent.toFixed(0)}<span style={{ color:"#374151" }}>/${c.bud}</span></span>
                  </div>
                  <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${c.pct}%`, borderRadius:99, background:`linear-gradient(90deg,${c.color}66,${c.color})` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {catHealth.length===0 && (
          <div style={{ textAlign:"center", color:"#4b5563", fontSize:13, padding:12 }}>No spending yet — <span style={{ color:"#6366f1", cursor:"pointer" }} onClick={()=>setView("add")}>add an expense</span></div>
        )}
      </div>

      {/* ── SECTION 3: Upcoming Bills ── */}
      <div style={{ ...S.card, marginBottom:14, padding:20, cursor:"pointer" }} onClick={()=>setView("bills")}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: upcomingBills.length > 0 ? 12 : 0 }}>
          <div style={S.sectionTitle}>Upcoming Bills & Payments</div>
          <span style={{ fontSize:11, color:"#6366f1" }}>All →</span>
        </div>
        {upcomingBills.length === 0 && (
          <div style={{ fontSize:13, color:"#4b5563" }}>No bills due in the next 14 days</div>
        )}
        {upcomingBills.map((b,i) => {
          const diff = Math.ceil((new Date(b.nextDue+"T12:00:00") - today) / (1000*60*60*24));
          const isCC = b.name?.toLowerCase().includes("card") || b.category === "Credit Card";
          const urgentColor = diff <= 0 ? "#ff4444" : diff <= 3 ? "#ff6b6b" : diff <= 7 ? "#FFA726" : "#6b7280";
          const dueLbl = diff < 0 ? `${Math.abs(diff)}d overdue` : diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff} days`;
          return (
            <div key={b.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i < upcomingBills.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`${b.color||"#6366f1"}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, flexShrink:0 }}>{b.icon||"📅"}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ fontSize:13, fontWeight:600 }}>{b.name}</span>
                  {isCC && <span style={{ fontSize:9, color:"#FFA726", background:"rgba(255,167,38,0.15)", padding:"2px 6px", borderRadius:20, fontWeight:600 }}>CC</span>}
                  {b.autopay && <span style={{ fontSize:9, color:"#34d399", background:"rgba(52,211,153,0.1)", padding:"2px 6px", borderRadius:20, fontWeight:600 }}>AUTO</span>}
                </div>
                <div style={{ fontSize:11, color:"#4b5563", marginTop:1 }}>{b.frequency}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontSize:14, fontWeight:700, fontFamily:"monospace" }}>${parseFloat(b.amount).toFixed(0)}</div>
                <div style={{ fontSize:11, fontWeight:600, color:urgentColor }}>{dueLbl}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── SECTION 4: Quick stats row ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
        {[
          { label:"Days Left", value: String(daysInMonth - dayOfMonth), sub:"in month", color:"#a5b4fc" },
          { label:"Daily Budget", value: dailyBudgetLeft > 0 ? `$${dailyBudgetLeft.toFixed(0)}` : "—", sub:"per day remaining", color: dailyBudgetLeft < 20 && dailyBudgetLeft > 0 ? "#ff6b6b" : "#e8e0d5" },
          nwVal !== null
            ? { label:"Net Worth", value:`$${(nwVal/1000).toFixed(0)}k`, sub:"last logged", color:nwVal>=0?"#34d399":"#ff6b6b", onClick:()=>setView("networth") }
            : { label:"Net Worth", value:"—", sub:"not logged yet", color:"#4b5563", onClick:()=>setView("networth") }
        ].map(s => (
          <div key={s.label} style={{ ...S.card, textAlign:"center", padding:14, cursor:s.onClick?"pointer":undefined }} onClick={s.onClick}>
            <div style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, fontFamily:"monospace", color:s.color }}>{s.value}</div>
            <div style={{ fontSize:10, color:"#4b5563", marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
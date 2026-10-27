import type {BasketData,Budget} from './types';
export function budgetSpent(budget:Budget,data:Pick<BasketData,'receipts'|'lines'>){
 const receipts=data.receipts.filter(r=>r.currency===budget.currency&&r.date.startsWith(budget.month+'-'));
 if(budget.category==='Overall')return receipts.reduce((sum,r)=>sum+r.totalCents,0);
 const ids=new Set(receipts.map(r=>r.id));return data.lines.filter(l=>ids.has(l.receiptId)&&l.category===budget.category).reduce((sum,l)=>sum+l.amountCents,0);
}
export function monthOptions(data:Pick<BasketData,'receipts'|'budgets'>,today=new Date()){
 const options=new Set([...data.receipts.map(r=>r.date.slice(0,7)),...data.budgets.map(b=>b.month)]);
 for(let offset=-12;offset<=3;offset++){const d=new Date(today.getFullYear(),today.getMonth()+offset,15);options.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)}
 return [...options].sort().reverse();
}

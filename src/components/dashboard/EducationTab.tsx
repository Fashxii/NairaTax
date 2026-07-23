import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HelpCircle, Send } from 'lucide-react';
import { useContent } from '../../context/ContentContext';

// Standard predefined answers for simulation
const taxPredefinedReplies: { [key: string]: string } = {
  nin: "Under the new tax policy enacted by the Federal Inland Revenue Service (FIRS) and Joint Tax Board (JTB), your 11-digit National Identification Number (NIN) automatically serves as your Tax Identification Number (TIN). This unified registry eliminates double taxation and aligns Nigeria with international financial standards.",
  deadline: "The primary tax deadlines in Nigeria are:\n• Personal Income Tax (PIT): March 31st annually for individual returns.\n• Company Income Tax (CIT): June 30th or within 6 months of financial year-end.\n• Value Added Tax (VAT): Must be remitted on or before the 21st day of every succeeding month.",
  cra: "Consolidated Relief Allowance (CRA) is calculated as: ₦200,000 or 1% of your Gross Annual Income (whichever is higher) plus an additional 20% of your Gross Annual Income. This entire sum is tax-exempt and deducted from your gross income before applying tax bands.",
  penalty: "Late filing of tax returns attracts severe penalties. For individuals, late PIT filing can lead to a flat penalty plus 10% interest on the outstanding tax liability. For corporate CIT filings, late submission attracts N25,000 in the first month and N5,000 for each subsequent month of default.",
  vat: "The standard Value Added Tax (VAT) rate in Nigeria is 7.5%. It is charged on all taxable goods and services, except for basic food items, baby products, educational books, medical services, and exported items.",
  wht: "Withholding Tax (WHT) is an advance payment of income tax. In Nigeria, it is deducted at source from payments made to a contractor or supplier at rates ranging from 2.5% to 10% depending on the transaction type. This is later utilized as tax credit to offset the taxpayer's final annual liabilities.",
  cit: "Company Income Tax (CIT) is levied on corporate profits. Small companies (under N25m turnover) are 100% exempt from CIT. Medium companies (N25m - N100m) pay 20%, while large companies (above N100m turnover) pay 30% CIT. Personal Income Tax (PIT) applies to individuals and is computed on a progressive scale up to 24%.",
  lifeAssur: "Under Section 33 of the Personal Income Tax Act (PITA), premiums paid on life assurance policies for yourself or your spouse are fully tax-deductible. This acts as an allowable relief that reduces your total taxable income, lowering your overall annual liability.",
  tcc: "A Tax Clearance Certificate (TCC) is the official proof issued by the tax authority (FIRS or SBIR) certifying that you have fully paid your taxes for the preceding 3 years. It is required for government contracts, land transactions, visa applications, and banking credit approvals. DIYtax9ja allows automated e-filing to fast-track your TCC download.",
  pension: "Contributions to the National Pension Scheme (up to 8% employee contribution) or approved voluntary pension schemes are 100% tax-exempt. Utilizing voluntary pension contributions is one of the most effective and legally approved methods to lower your PIT taxable base.",
  childrenRelief: "Under Section 33(3) of the Personal Income Tax Act (PITA), you are entitled to a Child Allowance relief of ₦2,500 per unmarried child, up to a maximum of four children (under 16 years, or in full-time education). In DIYtax9ja, we automatically track this statutory deduction to lower your chargeable income.",
  dependantRelief: "Dependant Relative Relief allows an annual tax-exempt deduction of ₦2,000 for each incapacitated or elderly dependant relative, up to a maximum of two relatives (maximum ₦4,000). While historically small, it remains a statutory right that taxpayers can declare.",
  disabledRelief: "Disabled Person's Special Relief provides an additional tax-exempt allowance of ₦3,000 or 20% of Gross Income (whichever is higher) for individuals with certified physical or mental disabilities. This relief is deducted from your gross income prior to applying the progressive tax bands.",
  mortgageInterestRelief: "Under PITA Section 33, any interest paid on mortgage loans taken out for owner-occupying, purchasing, or constructing a residential house is 100% tax-exempt. This provides immense relief for homeowners by significantly reducing their taxable income base.",
  bondInterestExempt: "Interest income earned by individual taxpayers on Federal Government Bonds, State/Local Government Bonds, Corporate Bonds, and Treasury Bills is 100% tax-exempt under the Personal Income Tax (Amendment) Act. You are not required to pay PIT on investment yields from these instruments."
};

const QUICK_QUESTIONS = [
  { key: 'nin', title: 'Is NIN my official TIN now?', subtitle: 'Learn about the Joint Tax Board unification system aligning national IDs to tax profiles.', question: 'Is my National Identification Number (NIN) really my Tax Identification Number (TIN) now?' },
  { key: 'deadline', title: 'Key Nigerian tax deadlines', subtitle: 'Audit critical periods for Personal Income Taxes, VAT, and corporate remittances.', question: 'What are the key tax deadlines in Nigeria?' },
  { key: 'cra', title: 'How is CRA relief computed?', subtitle: 'Step-by-step breakdown of the tax-exempt allowance applicable to gross annual incomes.', question: 'How is the Consolidated Relief Allowance (CRA) calculated?' },
  { key: 'penalty', title: 'What are the late filing penalties?', subtitle: 'Detailed review of statutory fines and daily interest applied for default periods.', question: 'What is the penalty for filing late taxes?' },
  { key: 'wht', title: 'What is Withholding Tax (WHT)?', subtitle: 'Understand WHT rates (2.5%-10%) and utilizing them as credits against final PIT.', question: 'What is Withholding Tax (WHT) and when does it apply?' },
  { key: 'cit', title: 'PIT vs. Company Income Tax (CIT)', subtitle: 'Contrast PIT progressive rates with CIT corporate brackets and small business exemptions.', question: 'How does Company Income Tax (CIT) differ from Personal Income Tax (PIT)?' },
  { key: 'lifeAssur', title: 'Life Assurance Tax Relief', subtitle: 'Learn how premium payments are deducted 100% to lower Personal Income Tax.', question: 'What are the tax benefits of Life Assurance policies under Nigerian PITA?' },
  { key: 'tcc', title: 'Get your Tax Clearance (TCC)', subtitle: 'Step-by-step guidance on automated clearance issuance after standard PIT filings.', question: 'How do I download my Tax Clearance Certificate (TCC)?' },
  { key: 'pension', title: 'Pension Contribution Reliefs', subtitle: 'Explore voluntary and compulsory pension schemes for tax-free earnings threshold expansion.', question: 'Are pension contributions fully tax-exempt under FIRS guidelines?' },
  { key: 'childrenRelief', title: 'Child Allowance Relief Guide', subtitle: 'Understand Section 33(3) of PITA regarding allowances for up to 4 children.', question: 'What is the Child Allowance relief and how does it work?' },
  { key: 'dependantRelief', title: 'Dependant Relative Relief Guide', subtitle: 'Explore statutory deductions for supporting incapacitated or elderly relatives.', question: 'What is Dependant Relative Relief and who qualifies?' },
  { key: 'disabledRelief', title: 'Disabled Person Special Relief Guide', subtitle: 'Learn about the special tax allowance of up to 20% of gross income for disabled persons.', question: 'What are the tax allowances for a disabled taxpayer under Nigerian PITA?' },
  { key: 'mortgageInterestRelief', title: 'Mortgage Interest Relief Guide', subtitle: 'See how interest on loans for purchasing or constructing owner-occupied homes is 100% tax-free.', question: 'What are the mortgage interest tax exemptions under PITA?' },
  { key: 'bondInterestExempt', title: 'Government Bonds & T-Bills Exemption', subtitle: 'Analyze the 100% PIT exemption for investment yields from public treasury instruments.', question: 'How does interest income on Government Bonds work with tax exemptions?' },
];

export default function EducationTab() {
  const { content } = useContent();
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'assistant'; text: string }[]>([
    { sender: 'assistant', text: content.dashboard.advisorIntroText }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = "I understand. Tax codes can be intricate. Could you elaborate or specify if you're asking about NIN compliance, tax deadlines, PIT calculations, late penalties, VAT rates, Withholding Tax (WHT), Company Income Tax (CIT), Life Assurance reliefs, Tax Clearance Certificates (TCC), Pension, Child Allowances, Dependant Relative Relief, Disabled Person allowances, Mortgage interest, or Bond investments?";
      
      const lower = userText.toLowerCase();
      if (lower.includes('nin') || lower.includes('tin') || lower.includes('national identification')) {
        reply = taxPredefinedReplies.nin;
      } else if (lower.includes('deadline') || lower.includes('due') || lower.includes('march') || lower.includes('remit')) {
        reply = taxPredefinedReplies.deadline;
      } else if (lower.includes('cra') || lower.includes('relief') || lower.includes('consolidated')) {
        reply = taxPredefinedReplies.cra;
      } else if (lower.includes('penalty') || lower.includes('fine') || lower.includes('late')) {
        reply = taxPredefinedReplies.penalty;
      } else if (lower.includes('vat') || lower.includes('value added') || lower.includes('rate')) {
        reply = taxPredefinedReplies.vat;
      } else if (lower.includes('wht') || lower.includes('withholding')) {
        reply = taxPredefinedReplies.wht;
      } else if (lower.includes('cit') || lower.includes('corporate') || lower.includes('company income tax') || lower.includes('company tax')) {
        reply = taxPredefinedReplies.cit;
      } else if (lower.includes('life assurance') || lower.includes('life insurance') || lower.includes('assurance policy')) {
        reply = taxPredefinedReplies.lifeAssur;
      } else if (lower.includes('tcc') || lower.includes('clearance') || lower.includes('tax clearance')) {
        reply = taxPredefinedReplies.tcc;
      } else if (lower.includes('pension') || lower.includes('voluntary pension') || lower.includes('retirement')) {
        reply = taxPredefinedReplies.pension;
      } else if (lower.includes('child') || lower.includes('children') || lower.includes('allowance')) {
        reply = taxPredefinedReplies.childrenRelief;
      } else if (lower.includes('dependant') || lower.includes('relative') || lower.includes('elderly')) {
        reply = taxPredefinedReplies.dependantRelief;
      } else if (lower.includes('disabled') || lower.includes('disability') || lower.includes('special relief')) {
        reply = taxPredefinedReplies.disabledRelief;
      } else if (lower.includes('mortgage') || lower.includes('housing loan') || lower.includes('interest relief')) {
        reply = taxPredefinedReplies.mortgageInterestRelief;
      } else if (lower.includes('bond') || lower.includes('treasury bill') || lower.includes('exempt income')) {
        reply = taxPredefinedReplies.bondInterestExempt;
      } else if (lower.includes('salary') || lower.includes('tax calculator') || lower.includes('calculate')) {
        reply = "To accurately calculate your Personal Income Tax, please click on the 'Quick Calculator' tab in the left sidebar menu. Enter your Gross Monthly/Annual earnings to view your precise, step-by-step statutory tax breakdown!";
      }

      setChatMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleInstantQuestion = (questionKey: string, questionText: string) => {
    setChatMessages((prev) => [...prev, { sender: 'user', text: questionText }]);
    setIsTyping(true);

    setTimeout(() => {
      const reply = taxPredefinedReplies[questionKey] || "I am processing your inquiry, please feel free to ask custom questions.";
      setChatMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">
          Tax Guidelines &amp; Virtual Advisor
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Consult standard FIRS guidelines or ask our interactive virtual tax assistant about statutory obligations.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Tax FAQ */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Predefined statutory guides</h3>
          
          <div className="space-y-3 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin">
            {QUICK_QUESTIONS.map((q) => (
              <button 
                key={q.key}
                onClick={() => handleInstantQuestion(q.key, q.question)}
                className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
              >
                <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-primary-container">{q.title}</p>
                  <p className="mt-1 leading-relaxed text-[11px]">{q.subtitle}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Interactive Chat Bot */}
        <div className="lg:col-span-7 bg-white border border-outline-variant rounded-xl shadow-xs overflow-hidden h-[500px] flex flex-col justify-between">
          {/* Chat header */}
          <div className="bg-primary-container text-white px-5 py-4 flex items-center space-x-2 text-left">
            <div className="w-8 h-8 rounded-full bg-[#4ADE80]/20 flex items-center justify-center text-accent-green font-bold text-sm">
              AI
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">DIYtax9ja Virtual Assistant</h4>
              <p className="text-[10px] text-neutral-300">Compliance &amp; statutory advisor active</p>
            </div>
          </div>

          {/* Messages panel */}
          <div className="p-4 flex-grow overflow-y-auto space-y-4 text-xs">
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] rounded-xl px-4 py-3 leading-relaxed whitespace-pre-line shadow-xs text-left ${
                  msg.sender === 'user' 
                    ? 'bg-primary-container text-white' 
                    : 'bg-surface-container-low text-on-surface border border-outline-variant/30'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-surface-container-low text-on-surface rounded-xl px-4 py-3 flex space-x-1 items-center border border-outline-variant/30">
                  <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Chat input form */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-outline-variant/40 bg-background flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about VAT, late fine penalties, CRA computations..."
              className="flex-grow h-10 px-4 bg-white border border-outline rounded-lg text-xs focus:outline-none focus:border-primary-container"
            />
            <button
              type="submit"
              className="w-10 h-10 bg-primary-container text-white rounded-lg flex items-center justify-center active:scale-95 transition-all hover:bg-primary-container/95 flex-shrink-0 cursor-pointer"
            >
              <Send className="w-4.5 h-4.5 text-accent-green" />
            </button>
          </form>
        </div>

      </div>
    </motion.section>
  );
}

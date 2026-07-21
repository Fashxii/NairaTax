import React, { createContext, useContext, useState, useEffect } from 'react';

// Define the shape of our CMS content
export interface AppContent {
  gateway: {
    heroTitleLine1: string;
    heroTitleLine2: string;
    heroDescription: string;
    heroImage: string;
    logoUrl: string;
    navCtaText: string;
    heroCta1Text: string;
    heroCta2Text: string;
    portalTitle: string;
    portalSubtitle: string;
    portalCtaText: string;
    demoBypassText: string;
    feature1Title: string;
    feature1Desc: string;
    feature2Title: string;
    feature2Desc: string;
  };
  dashboard: {
    welcomeGreeting: string;
    advisorIntroText: string;
  };
}

const defaultContent: AppContent = {
  gateway: {
    heroTitleLine1: "Nigerian Taxes.",
    heroTitleLine2: "Automated, Simplified, 100% Compliant.",
    heroDescription: "File PIT & CIT, automatically scan receipts into Naira, unlock statutory deductions (pension, NHF, NHIS, life assurance), and authorize direct secure payments to the Nigerian Revenue Service in seconds.",
    heroImage: "",
    logoUrl: "",
    navCtaText: "File Tax Return",
    heroCta1Text: "Try Free Tax Planner",
    heroCta2Text: "Calculate Your Reliefs",
    portalTitle: "Secure Filing Portal",
    portalSubtitle: "Enter your details to generate your official tax returns.",
    portalCtaText: "Secure One-Time Code",
    demoBypassText: "Quick Bypass: Explore Live Demo Dashboard",
    feature1Title: "Smart Vault Receipt Scanner",
    feature1Desc: "Stop manually typing expenses. Drag-and-drop paper receipts, bank statements, or utility vouchers. Our scanner extracts quantities, VAT, and figures into Naira instantly.",
    feature2Title: "Dynamic Tax Planner",
    feature2Desc: "Toggle what-if scenarios in real-time. Calculate exactly how voluntary pensions, life assurances, housing scheme deductions (NHF), and NHIS premiums impact your upcoming tax bands."
  },
  dashboard: {
    welcomeGreeting: "Hello,",
    advisorIntroText: "Hello! I am your virtual DIYtax9ja Advisor. Ask me anything about the new Nigerian Tax Implementation, deadlines, the National Identification Number (NIN-TIN) integration, or Personal Income Tax rates."
  }
};

interface ContentContextType {
  content: AppContent;
  updateContent: (section: keyof AppContent, key: string, value: string) => void;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<AppContent>(() => {
    const saved = localStorage.getItem('diyTax9ja_cms_content');
    return saved ? JSON.parse(saved) : defaultContent;
  });

  useEffect(() => {
    localStorage.setItem('diyTax9ja_cms_content', JSON.stringify(content));
  }, [content]);

  const updateContent = (section: keyof AppContent, key: string, value: string) => {
    setContent(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  return (
    <ContentContext.Provider value={{ content, updateContent }}>
      {children}
    </ContentContext.Provider>
  );
};

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
};

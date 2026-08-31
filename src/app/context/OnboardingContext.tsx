import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLanguage } from "./LanguageContext";

export interface OnboardingData {
  completed: boolean;
  companyName: string;
  industry?: string;
  companySize?: string;
  locations?: string;
  language?: "en" | "ar";
  // Premium onboarding fields
  businessType?: string;
  painPoints?: string[];
  productionStages?: string[];
  enabled_modules?: string[];
}

interface OnboardingContextType {
  onboardingData: OnboardingData | null;
  completeOnboarding: (data: Omit<OnboardingData, "completed">) => void;
  clearOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { setLang } = useLanguage();
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("bumblebee_onboarding");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setOnboardingData(parsed);
      } catch (_) {}
    }
    setIsLoaded(true);
  }, []);

  const completeOnboarding = (data: Omit<OnboardingData, "completed">) => {
    const fullData: OnboardingData = { ...data, completed: true };
    localStorage.setItem("bumblebee_onboarding", JSON.stringify(fullData));
    setOnboardingData(fullData);
    if (fullData.language) setLang(fullData.language);
  };

  const clearOnboarding = () => {
    localStorage.removeItem("bumblebee_onboarding");
    setOnboardingData(null);
  };

  if (!isLoaded) return null;

  return (
    <OnboardingContext.Provider value={{ onboardingData, completeOnboarding, clearOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}

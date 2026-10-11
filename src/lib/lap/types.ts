export type Language = "English" | "Hindi";
export type Gender = "female" | "male";

export type Stage = "verify" | "callback" | "offer" | "qualify" | "loan_cap" | "ended";

export type EndReason =
  | "callback"
  | "not_interested"
  | "wrong_number"
  | "transfer"
  | "disqualified"
  | "declined_cap"
  | "handoff";

export type PropertyType = "residential" | "commercial" | "industrial" | "agricultural";
export type Ownership = "sole" | "joint";
export type Docs = "available" | "unavailable";
export type Occupation = "salaried" | "self_employed";
export type IncomeMode = "bank" | "cash";

export type Asked =
  | "verify"
  | "who"
  | "callback"
  | "offer"
  | "property_type"
  | "ownership"
  | "documents"
  | "loan_amount"
  | "occupation_income"
  | "occupation"
  | "income_mode"
  | "market_value"
  | "tenure"
  | "loan_cap"
  | "clarify_property"
  | "clarify_documents"
  | "diversion";

export interface QualState {
  stage: Stage;
  asked: Asked;
  resumeAsked: Asked | null;
  verified: boolean;
  propertyType: PropertyType | null;
  ownership: Ownership | null;
  documents: Docs | null;
  loanAmount: number | null;
  occupation: Occupation | null;
  incomeMode: IncomeMode | null;
  marketValue: number | null;
  tenureYears: number | null;
  disqualifyReason: string | null;
  endReason: EndReason | null;
  transferReason: "existing_loan" | "emi" | null;
  callbackTime: string | null;
  capOffered: boolean;
}

export interface CallProfile {
  companyName: string;
  customerName: string;
  agentName: string;
  agentGender: Gender;
  language: Language;
  rag: string;
  dateLabel: string;
  dayLabel: string;
  timeLabel: string;
}

export const MAX_LOAN = 7_500_000;

export const DEFAULT_RAG = `Product: Loan Against Property, fresh loan only.
Maximum loan amount on this offer: ₹75,00,000 (75 lakh).
Eligible property types: residential (house/flat), commercial (shop/office), industrial (factory).
Agricultural property is not eligible.
Ownership: sole or joint, both eligible.
Original property documents must be available for verification.
Occupation: salaried or self-employed, both eligible.
Income must be credited to a bank account. Cash income is not eligible.
Tenure: 3 to 15 years, inclusive.
Interest rate: not disclosed on this call. The senior loan expert shares the exact rate after preliminary qualification.
This call does not guarantee sanction. It only checks preliminary fit.
Nearest branch and processing fees are not available in this brief. Do not invent them.`;

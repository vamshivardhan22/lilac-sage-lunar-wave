import { findMoney, formatINR, pickLoan, pickMarket } from "./money.ts";
import { MAX_LOAN, type Asked, type CallProfile, type Docs, type EndReason, type IncomeMode, type Occupation, type Ownership, type PropertyType, type QualState } from "./types.ts";

export interface TurnResult {
  state: QualState;
  reply: string;
}

const YEAR_WORD: Record<string, number> = {
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
};

export function initialState(): QualState {
  return {
    stage: "verify",
    asked: "verify",
    resumeAsked: null,
    verified: false,
    propertyType: null,
    ownership: null,
    documents: null,
    loanAmount: null,
    occupation: null,
    incomeMode: null,
    marketValue: null,
    tenureYears: null,
    disqualifyReason: null,
    endReason: null,
    transferReason: null,
    callbackTime: null,
    capOffered: false,
  };
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

function g(profile: CallProfile, female: string, male: string): string {
  return profile.agentGender === "female" ? female : male;
}

function say(profile: CallProfile, en: string, hi: string): string {
  return profile.language === "Hindi" ? hi : en;
}

export function openingLine(profile: CallProfile): string {
  const name = profile.customerName;
  return say(
    profile,
    `Hello, may I speak with ${name}?`,
    `नमस्ते, क्या मैं ${name} से बात कर ${g(profile, "सकती", "सकता")} हूँ?`,
  );
}

function propertyQuestion(profile: CallProfile): string {
  return say(
    profile,
    "What kind of property is this — a residential house or flat, a commercial shop or office, or an industrial property?",
    "यह प्रॉपर्टी किस तरह की है — रिहायशी मकान या फ्लैट, कमर्शियल दुकान या ऑफ़िस, या इंडस्ट्रियल प्रॉपर्टी?",
  );
}

function ownershipQuestion(profile: CallProfile): string {
  return say(
    profile,
    "Is the property in your name alone, or is it jointly owned — for example with family?",
    "क्या प्रॉपर्टी अकेले आपके नाम पर है, या संयुक्त रूप से — जैसे परिवार के साथ?",
  );
}

function documentsQuestion(profile: CallProfile): string {
  return say(
    profile,
    "Do you have the original property documents available for verification?",
    "क्या प्रॉपर्टी के ओरिजिनल दस्तावेज़ वेरिफ़िकेशन के लिए उपलब्ध हैं?",
  );
}

function loanQuestion(profile: CallProfile): string {
  return say(
    profile,
    "How much are you looking to borrow?",
    "आप लगभग कितनी राशि का लोन लेना चाहते हैं?",
  );
}

function occupationQuestion(profile: CallProfile, state: QualState): string {
  if (state.occupation && !state.incomeMode) {
    return say(
      profile,
      "Does that income get credited to your bank account, or is it received in cash?",
      "क्या यह आय आपके बैंक खाते में आती है, या नकद में मिलती है?",
    );
  }
  if (!state.occupation && state.incomeMode) {
    return say(
      profile,
      "Are you salaried, or do you run your own business?",
      "क्या आप नौकरी करते हैं, या अपना व्यवसाय चलाते हैं?",
    );
  }
  return say(
    profile,
    "Are you salaried or self-employed, and does that income come into your bank account or in cash?",
    "क्या आप सैलरीड हैं या सेल्फ़-एम्प्लॉयड, और आय बैंक खाते में आती है या नकद?",
  );
}

function marketQuestion(profile: CallProfile): string {
  return say(
    profile,
    "Approximately what is the current market value of the property?",
    "प्रॉपर्टी की अभी लगभग कितनी बाज़ार कीमत है?",
  );
}

function tenureQuestion(profile: CallProfile): string {
  return say(
    profile,
    "Over how many years would you like to repay the loan?",
    "आप यह लोन कितने वर्षों में चुकाना चाहेंगे?",
  );
}

function offerLine(profile: CallProfile): string {
  const name = firstName(profile.customerName);
  return say(
    profile,
    `Thank you, ${name}. I'm ${profile.agentName}, calling from ${profile.companyName}. As a valued customer, you may be eligible for a special Loan Against Property offer of up to ₹75 lakh. I'd like to ask a few short questions to see if it fits. Shall we go ahead?`,
    `धन्यवाद ${name}। मैं ${profile.agentName}, ${profile.companyName} से बोल ${g(profile, "रही", "रहा")} हूँ। एक valued ग्राहक होने के नाते, आपके लिए ₹75 लाख तक का एक खास लोन अगेंस्ट प्रॉपर्टी ऑफ़र हो सकता है। मैं कुछ छोटे सवाल पूछकर देखना ${g(profile, "चाहती", "चाहता")} हूँ कि यह आपके लिए सही है या नहीं। क्या हम आगे बढ़ें?`,
  );
}

function whoLine(profile: CallProfile): string {
  return say(
    profile,
    `This is ${profile.agentName} from ${profile.companyName}. I'm calling for ${profile.customerName} about an existing-customer offer. May I speak with ${firstName(profile.customerName)}?`,
    `जी, मैं ${profile.agentName} बोल ${g(profile, "रही", "रहा")} हूँ, ${profile.companyName} से। यह ${profile.customerName} के लिए एक मौजूदा ग्राहक ऑफ़र के बारे में कॉल है। क्या मैं ${firstName(profile.customerName)} से बात कर ${g(profile, "सकती", "सकता")} हूँ?`,
  );
}

function callbackAsk(profile: CallProfile): string {
  return say(
    profile,
    "Certainly, I understand. What would be a convenient time for us to call you back?",
    `बिल्कुल, मैं समझ ${g(profile, "सकती", "सकता")} हूँ। आपको किस समय कॉल करना सुविधाजनक रहेगा?`,
  );
}

function callbackClose(profile: CallProfile, when: string): string {
  return say(
    profile,
    `Thank you. We'll call you back ${when}. Have a good day.`,
    `धन्यवाद। हम आपको ${when} पर दोबारा कॉल करेंगे। आपका दिन शुभ हो।`,
  );
}

function notInterestedClose(profile: CallProfile): string {
  return say(
    profile,
    "Of course. I won't take more of your time. If you want to revisit this later, we're here. Thank you, and have a good day.",
    profile.agentGender === "female"
      ? "बिल्कुल। मैं आपका और समय नहीं लूँगी। अगर बाद में देखना चाहें, तो हम उपलब्ध हैं। धन्यवाद, आपका दिन शुभ हो।"
      : "बिल्कुल। मैं आपका और समय नहीं लूँगा। अगर बाद में देखना चाहें, तो हम उपलब्ध हैं। धन्यवाद, आपका दिन शुभ हो।",
  );
}

function wrongNumberClose(profile: CallProfile): string {
  return say(
    profile,
    "I'm sorry to have disturbed you. I'll update our records. Thank you.",
    "क्षमा कीजिए, आपको परेशान करने के लिए। मैं रिकॉर्ड अपडेट कर दूँगी। धन्यवाद।".replace(
      "दूँगी",
      profile.agentGender === "female" ? "दूँगी" : "दूँगा",
    ),
  );
}

function transferClose(profile: CallProfile): string {
  return say(
    profile,
    "Thank you for clarifying. Because this involves an existing loan on the property, or a change to your current EMI, a loan-transfer specialist will contact you shortly. Thank you for your time.",
    "धन्यवाद, स्पष्ट करने के लिए। क्योंकि यह प्रॉपर्टी के मौजूदा लोन या आपकी वर्तमान ईएमआई से जुड़ा है, हमारे लोन-ट्रांसफर विशेषज्ञ आपसे जल्दी संपर्क करेंगे। आपका समय देने के लिए धन्यवाद।",
  );
}

function dqClose(profile: CallProfile, reason: string): string {
  const reasonHi: Record<string, string> = {
    agricultural:
      "कृषि प्रॉपर्टी इस ऑफ़र में शामिल नहीं है।",
    documents:
      "इस ऑफ़र के लिए ओरिजिनल प्रॉपर्टी दस्तावेज़ उपलब्ध होना ज़रूरी है।",
    cash: "इस ऑफ़र के लिए आय बैंक खाते में आनी चाहिए। नकद आय इस बार शामिल नहीं है।",
    tenure: "इस ऑफ़र में लोन चुकाने की अवधि 3 से 15 वर्ष के बीच होनी चाहिए।",
  };
  const reasonEn: Record<string, string> = {
    agricultural: "Agricultural property isn't covered by this offer.",
    documents: "Original property documents need to be available for this offer.",
    cash: "For this offer, income needs to be received in a bank account. Cash income isn't covered.",
    tenure: "For this offer, the repayment period needs to be between 3 and 15 years.",
  };
  return say(
    profile,
    `${reasonEn[reason] ?? "This doesn't fit the offer."} You do not meet the criteria for this specific offer at this time. Thank you for your time.`,
    `${reasonHi[reason] ?? "यह इस ऑफ़र की शर्तों में नहीं आता।"} अभी आप इस खास ऑफ़र की शर्तें पूरी नहीं करते। आपका समय देने के लिए धन्यवाद।`,
  );
}

function capQuestion(profile: CallProfile): string {
  return say(
    profile,
    "The current offer is available for up to ₹75 lakh. Would you like to proceed with the maximum amount of ₹75 lakh?",
    "यह ऑफ़र अभी अधिकतम ₹75 लाख तक उपलब्ध है। क्या आप ₹75 लाख की अधिकतम राशि के साथ आगे बढ़ना चाहेंगे?",
  );
}

function declinedCapClose(profile: CallProfile): string {
  return say(
    profile,
    "I understand. This particular offer can't go above ₹75 lakh, so I won't be able to take it further on this call. Thank you for your time.",
    "मैं समझ गई। यह खास ऑफ़र ₹75 लाख से ऊपर नहीं जा सकता, इसलिए इस कॉल पर मैं इसे आगे नहीं बढ़ा सकती। आपका समय देने के लिए धन्यवाद।"
      .replace("गई", profile.agentGender === "female" ? "गई" : "गया")
      .replace("सकती", profile.agentGender === "female" ? "सकती" : "सकता"),
  );
}

function handoffClose(profile: CallProfile): string {
  return say(
    profile,
    `Thank you. From what you've shared, you meet the preliminary criteria for this offer. A senior loan expert from ${profile.companyName} will call you shortly to discuss the next steps and the exact interest rate. Thank you for your time.`,
    `धन्यवाद। आपने जो बताया है, उसके आधार पर आप इस ऑफ़र की शुरुआती शर्तें पूरी करते हैं। ${profile.companyName} के सीनियर लोन एक्सपर्ट जल्दी कॉल करके अगले कदम और सटीक ब्याज दर बताएंगे। आपका समय देने के लिए धन्यवाद।`,
  );
}

function interestDeflection(profile: CallProfile): string {
  const rag = profile.rag;
  const explicit = rag.match(/interest[^.\n]{0,80}?(\d+(?:\.\d+)?\s*(?:%|percent))/i);
  if (explicit) {
    return say(
      profile,
      `From the product note I have, ${explicit[0].replace(/\s+/g, " ").trim()}.`,
      `मेरे पास जो उत्पाद नोट है, उसके अनुसार ${explicit[0].replace(/\s+/g, " ").trim()}.`,
    );
  }
  return say(
    profile,
    "The exact interest rate is shared by our senior loan expert after this preliminary check. I don't want to guess a number.",
    "सटीक ब्याज दर इस शुरुआती जाँच के बाद हमारे सीनियर लोन एक्सपर्ट बताते हैं। मैं कोई आँकड़ा अनुमान से नहीं बताना चाहती।".replace(
      "चाहती",
      profile.agentGender === "female" ? "चाहती" : "चाहता",
    ),
  );
}

function branchAnswer(profile: CallProfile): string {
  const line = profile.rag
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => /\b(branch|address)\b/i.test(l) && !/not available|do not invent/i.test(l));
  if (line) {
    return say(profile, line, line);
  }
  return say(
    profile,
    "I don't have branch locations on this call, and I won't guess. The senior loan expert can share that.",
    "इस कॉल पर मेरे पास शाखा का पता नहीं है, और मैं अनुमान नहीं लगाऊँगी। सीनियर लोन एक्सपर्ट यह बता सकते हैं।".replace(
      "लगाऊँगी",
      profile.agentGender === "female" ? "लगाऊँगी" : "लगाऊँगा",
    ),
  );
}

function docsListAnswer(profile: CallProfile): string {
  return say(
    profile,
    "For this check I only need to know that the original property documents are available. The senior loan expert will walk you through the full list.",
    "इस जाँच में मुझे बस यह जानना है कि ओरिजिनल प्रॉपर्टी दस्तावेज़ उपलब्ध हैं। पूरी सूची सीनियर लोन एक्सपर्ट बताएंगे।",
  );
}

function feeAnswer(profile: CallProfile): string {
  const line = profile.rag
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => /\b(fee|charge)\b/i.test(l) && !/not available|do not invent/i.test(l));
  if (line) return say(profile, line, line);
  return say(
    profile,
    "I don't have processing fees on this call. The senior loan expert will confirm charges with the exact rate.",
    "इस कॉल पर मेरे पास प्रोसेसिंग फ़ीस की जानकारी नहीं है। सीनियर लोन एक्सपर्ट शुल्क और सटीक दर एक साथ बताएंगे।",
  );
}

interface Facts {
  verified: boolean;
  wrongNumber: boolean;
  unavailable: boolean;
  busy: boolean;
  whoCalling: boolean;
  notInterested: boolean;
  existingLoan: boolean;
  emiReduction: boolean;
  propertyType: PropertyType | null;
  propertyAmbiguous: boolean;
  ownership: Ownership | null;
  documents: Docs | null;
  documentsAmbiguous: boolean;
  loanAmount: number | null;
  occupation: Occupation | null;
  incomeMode: IncomeMode | null;
  marketValue: number | null;
  tenureYears: number | null;
  interestAsk: boolean;
  branchAsk: boolean;
  docsAsk: boolean;
  feeAsk: boolean;
  openQuestion: boolean;
  yes: boolean;
  no: boolean;
  callbackTime: string | null;
}

function emptyFacts(): Facts {
  return {
    verified: false,
    wrongNumber: false,
    unavailable: false,
    busy: false,
    whoCalling: false,
    notInterested: false,
    existingLoan: false,
    emiReduction: false,
    propertyType: null,
    propertyAmbiguous: false,
    ownership: null,
    documents: null,
    documentsAmbiguous: false,
    loanAmount: null,
    occupation: null,
    incomeMode: null,
    marketValue: null,
    tenureYears: null,
    interestAsk: false,
    branchAsk: false,
    docsAsk: false,
    feeAsk: false,
    openQuestion: false,
    yes: false,
    no: false,
    callbackTime: null,
  };
}

function lastIndexOf(text: string, re: RegExp): number {
  let last = -1;
  for (const m of text.matchAll(re)) last = m.index ?? -1;
  return last;
}

function prepareScan(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\b(at|from)\s+home\b/g, " ")
    .replace(/\b(ghar\s+par|ghar\s+pe|ghar\s+mein)\b/g, " ")
    .replace(/\boffice\s+job\b/g, " salaried job ");
}

function extractProperty(scan: string): PropertyType | null {
  const rules: { type: PropertyType; re: RegExp }[] = [
    { type: "agricultural", re: /\b(agricultural|agriculture|farm\s*land|farmland|kheti|krishi)\b/gi },
    { type: "industrial", re: /\b(industrial|factory|warehouse|godown)\b/gi },
    { type: "commercial", re: /\b(commercial|showroom|a shop|the shop|my shop|office space|dukaan)\b/gi },
    { type: "residential", re: /\b(residential|apartment|villa|flat|house|ghar|makaan|home)\b/gi },
  ];
  let best: { type: PropertyType; index: number } | null = null;
  for (const rule of rules) {
    const idx = lastIndexOf(scan, rule.re);
    if (idx >= 0 && (best == null || idx > best.index)) best = { type: rule.type, index: idx };
  }
  return best?.type ?? null;
}

function extractOwnership(scan: string): Ownership | null {
  const joint = lastIndexOf(
    scan,
    /\b(joint|jointly|co-owned|co owned|with my (?:wife|husband|brother|sister|father|mother|parents|partner|son|daughter)|shared with)\b/gi,
  );
  const sole = lastIndexOf(
    scan,
    /\b(sole owner|solely|only owner|i am the owner|i'm the owner|fully owned|only in my name|in my name alone|my own|it's mine|it is mine|sirf mera|sole)\b/gi,
  );
  if (joint < 0 && sole < 0) return null;
  if (joint > sole) return "joint";
  return "sole";
}

function extractDocuments(raw: string): { documents: Docs | null; ambiguous: boolean } {
  const t = raw.toLowerCase();
  const unavailable =
    /\b(only (?:have )?photocopies|photocopies only|photo copies|no originals?|don't have (?:the )?originals?|do not have (?:the )?originals?|lost the (?:original )?(?:papers|documents)|originals? (?:are |were )?lost|without originals?)\b/i.test(
      t,
    );
  const available =
    /\b(originals? (?:are |is )?(?:available|ready|with me)|have the originals?|got the originals?|original (?:property )?documents?(?: are| is)? (?:available|ready|with me)|original papers|originals are at home|original documents are at home)\b/i.test(
      t,
    ) || /\boriginal\b/i.test(t) && /\b(available|ready|at home|with me|i have|i've got|have them)\b/i.test(t);
  if (unavailable && !available) return { documents: "unavailable", ambiguous: false };
  if (available && !unavailable) return { documents: "available", ambiguous: false };
  const mentions = /\b(papers|documents|docs|kagaz)\b/i.test(t);
  const hedge = /\b(think|probably|maybe|not sure|somewhere|guess|unsure)\b/i.test(t);
  if (mentions && hedge && !available) return { documents: null, ambiguous: true };
  return { documents: null, ambiguous: false };
}

function extractOccupation(scan: string): Occupation | null {
  const self = lastIndexOf(
    scan,
    /\b(self[-\s]?employed|own business|my business|i run|run a|business owner|freelancer|entrepreneur|vyapar)\b/gi,
  );
  const salaried = lastIndexOf(
    scan,
    /\b(salaried|salary|i have a job|i work (?:at|for|in)|naukri|salaried job)\b/gi,
  );
  if (self < 0 && salaried < 0) return null;
  return self > salaried ? "self_employed" : "salaried";
}

function extractIncome(raw: string): IncomeMode | null {
  const t = raw.toLowerCase();
  const cashAt = lastIndexOf(t, /\b(in cash|by cash|cash income|paid in cash|receive(?:d)? in cash|nakad|nakit)\b/gi);
  const bankAt = lastIndexOf(
    t,
    /\b(in (?:the |my )?bank|into (?:the |my )?bank|bank account|salary account|credited|into my account|into the bank|to my account|neft|not cash|isn't cash|is not cash)\b/gi,
  );
  if (cashAt < 0 && bankAt < 0) return null;
  return cashAt > bankAt ? "cash" : "bank";
}

function extractTenure(raw: string, asked: Asked): number | null {
  const re =
    /\b(\d+|thirty|twenty|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two)\s*[- ]?(years|year|yrs|yr|saal)\b/gi;
  const hits: { value: number; index: number }[] = [];
  for (const m of raw.matchAll(re)) {
    const after = raw.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 8);
    if (/^\s*old\b/i.test(after)) continue;
    const token = m[1].toLowerCase();
    const value = /^\d+$/.test(token) ? Number(token) : YEAR_WORD[token];
    if (value == null) continue;
    const window = raw.slice(Math.max(0, (m.index ?? 0) - 40), (m.index ?? 0) + m[0].length).toLowerCase();
    const cued =
      asked === "tenure" ||
      /\b(repay|repayment|tenure|pay back|pay it|prefer|preferred|over|for the loan|loan term|years to)\b/i.test(window);
    if (!cued) continue;
    hits.push({ value, index: m.index ?? 0 });
  }
  if (asked === "tenure" || /\b(make that|change (?:it|that) to)\b/i.test(raw)) {
    const bareRe =
      /\b(\d+|thirty|twenty|nineteen|eighteen|seventeen|sixteen|fifteen|fourteen|thirteen|twelve|eleven|ten|nine|eight|seven|six|five|four|three|two)\b/gi;
    for (const m of raw.matchAll(bareRe)) {
      const after = raw.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 10);
      if (/^\s*(?:years|year|yrs|yr|saal|lakh|lakhs|lac|crore|%|percent|old)\b/i.test(after)) continue;
      const token = m[1].toLowerCase();
      const value = /^\d+$/.test(token) ? Number(token) : YEAR_WORD[token];
      if (value == null || value < 1 || value > 30) continue;
      hits.push({ value, index: m.index ?? 0 });
    }
  }
  if (!hits.length) return null;
  return hits[hits.length - 1].value;
}

function looksLikeTime(raw: string): boolean {
  return /\b(tomorrow|today|tonight|morning|evening|afternoon|monday|tuesday|wednesday|thursday|friday|saturday|sunday|kal|shaam|subah|dopahar|after \d|at \d|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i.test(
    raw,
  );
}

function cleanTime(raw: string): string {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

function negatedExisting(raw: string): boolean {
  return /\b(no|not|don't|do not|nahi|nahin)\b[^.]{0,40}\b(existing loan|loan on (?:this |the )?property|already have)\b/i.test(
    raw,
  ) || /\b(don't have (?:a |any )?loan|do not have (?:a |any )?loan|no existing loan|fresh loan|naya loan)\b/i.test(raw);
}

function extract(raw: string, state: QualState, profile: CallProfile): Facts {
  const facts = emptyFacts();
  const text = raw.trim();
  if (!text) return facts;
  const scan = prepareScan(text);
  const name = firstName(profile.customerName).toLowerCase();

  facts.wrongNumber = /\b(wrong number|galat number|galat nambar)\b/i.test(text);
  facts.whoCalling = /\b(who is (?:this|calling)|who's (?:this|calling)|who are you|kaun (?:bol|ho)|which company|kahan se)\b/i.test(
    text,
  );
  facts.busy = /\b(busy|in a meeting|driving|can't talk|cannot talk|not a good time|call (?:me )?later|another time|abhi busy|meeting mein)\b/i.test(
    text,
  );
  facts.unavailable =
    /\b(not home|isn't home|is not home|not here|not available|out of station|he's out|she's out|they are out)\b/i.test(
      text,
    ) || new RegExp(`\\bnot\\s+${name}\\b`, "i").test(text);

  const nameHit = new RegExp(`\\b${name}\\b`, "i").test(text);
  facts.verified =
    (nameHit && /\b(speaking|this is|i am|i'm|yes|haan|ji)\b/i.test(text)) ||
    /\b(this is me|it's me|it is me|speaking|yes speaking|haan boliye|ji boliye)\b/i.test(text);

  facts.notInterested = /\b(not interested|no thanks|no thank you|don't want|do not want|not looking|nahi chahiye|nahin chahiye|don't call|do not call|stop calling)\b/i.test(
    text,
  );

  if (!negatedExisting(text)) {
    facts.existingLoan =
      /\b(already have (?:a |an )?(?:home |property |housing )?loan|existing loan|loan on (?:this |the )?property|outstanding loan|balance transfer|running loan|pehle se loan|loan chal raha)\b/i.test(
        text,
      );
    facts.emiReduction =
      /\b(reduc(?:e|ing)\s+(?:my\s+|the\s+)?(?:current\s+|existing\s+)?emi|lower\s+(?:my\s+|the\s+)?(?:current\s+|existing\s+)?emi|emi\s+(?:kam|reduction|reduce)|bring\s+(?:my\s+|the\s+)?emi\s+down)\b/i.test(
        text,
      );
  }

  facts.propertyType = extractProperty(scan);
  if (
    !facts.propertyType &&
    /\b(plot|land|zameen|zamin)\b/i.test(scan) &&
    !/\b(agricultural|residential|commercial|industrial)\b/i.test(scan)
  ) {
    facts.propertyAmbiguous = true;
  }
  facts.ownership = extractOwnership(scan);
  const docs = extractDocuments(text);
  facts.documents = docs.documents;
  facts.documentsAmbiguous = docs.ambiguous;
  facts.occupation = extractOccupation(scan);
  facts.incomeMode = extractIncome(text);
  facts.tenureYears = extractTenure(text, state.asked);
  const money = findMoney(text, state.asked);
  facts.loanAmount = pickLoan(money, text);
  facts.marketValue = pickMarket(money);

  facts.interestAsk = /\b(interest rate|rate of interest|roi\b|interest kya|kitna interest|what(?:'s| is) the (?:rate|interest))\b/i.test(
    text,
  );
  facts.branchAsk = /\b(nearest branch|which branch|branch address|where is your (?:office|branch)|branch kahan)\b/i.test(
    text,
  );
  facts.docsAsk = /\b(what documents|which documents|documents do you need|kaun se (?:documents|kagaz)|what papers)\b/i.test(
    text,
  );
  facts.feeAsk = /\b(processing fee|what(?:'s| is) the (?:fee|charge)|hidden charges)\b/i.test(text);
  facts.openQuestion =
    /\b(can i ask|could i ask|one question|quick question|before that|wait|hold on|sorry)\b/i.test(text) &&
    !facts.interestAsk &&
    !facts.branchAsk &&
    !facts.docsAsk &&
    !facts.feeAsk;

  const yesAt = lastIndexOf(text, /\b(yes|yeah|yep|yup|sure|correct|haan|hanji|okay|ok)\b/gi);
  const noAt = lastIndexOf(text, /\b(no|nope|nah|nahi|nahin)\b/gi);
  if (yesAt >= 0 || noAt >= 0) {
    if (yesAt > noAt) facts.yes = true;
    else facts.no = true;
  }

  if (facts.documents === "available") facts.no = false;
  if (facts.documents === "unavailable") facts.yes = false;

  if ((state.asked === "callback" || facts.busy || facts.unavailable) && looksLikeTime(text) && !facts.wrongNumber) {
    facts.callbackTime = cleanTime(text);
  }

  applyPolarity(state, facts);
  return facts;
}

function applyPolarity(state: QualState, facts: Facts) {
  if (facts.yes && !facts.no) {
    if (state.asked === "verify" || state.asked === "who") facts.verified = true;
    if ((state.asked === "documents" || state.asked === "clarify_documents") && !facts.documents) {
      facts.documents = "available";
    }
  }
  if (facts.no && !facts.yes) {
    if ((state.asked === "documents" || state.asked === "clarify_documents") && !facts.documents) {
      facts.documents = "unavailable";
    }
    if (state.asked === "verify" && !facts.whoCalling && !facts.busy) facts.unavailable = true;
    if (state.asked === "offer") facts.notInterested = true;
  }
}

function applyFacts(state: QualState, facts: Facts): QualState {
  const next: QualState = { ...state };
  if (facts.propertyType) next.propertyType = facts.propertyType;
  if (facts.ownership) next.ownership = facts.ownership;
  if (facts.documents) next.documents = facts.documents;
  if (facts.occupation) next.occupation = facts.occupation;
  if (facts.incomeMode) next.incomeMode = facts.incomeMode;
  if (facts.marketValue != null) next.marketValue = facts.marketValue;
  if (facts.tenureYears != null) next.tenureYears = facts.tenureYears;
  if (facts.loanAmount != null && facts.loanAmount <= MAX_LOAN) next.loanAmount = facts.loanAmount;
  if (facts.loanAmount != null && facts.loanAmount > MAX_LOAN && state.loanAmount != null && state.loanAmount <= MAX_LOAN) {
    // Keep a previously accepted in-limit amount unless they clearly replace it.
    next.loanAmount = state.loanAmount;
  }
  return next;
}

function hasDiversion(facts: Facts): boolean {
  return facts.interestAsk || facts.branchAsk || facts.docsAsk || facts.feeAsk || facts.openQuestion;
}

function diversionPrefix(profile: CallProfile, facts: Facts): string {
  if (facts.interestAsk) return interestDeflection(profile);
  if (facts.branchAsk) return branchAnswer(profile);
  if (facts.docsAsk) return docsListAnswer(profile);
  if (facts.feeAsk) return feeAnswer(profile);
  if (facts.openQuestion) {
    return say(
      profile,
      "Of course — tell me what you'd like to know, and then I'll come back to the check.",
      "बिल्कुल — आप जो पूछना चाहें पूछ लीजिए, फिर मैं जाँच पर लौट आऊँगी।".replace(
        "आऊँगी",
        profile.agentGender === "female" ? "आऊँगी" : "आऊँगा",
      ),
    );
  }
  return "";
}

function firstMissing(state: QualState): Asked | null {
  if (!state.propertyType) return "property_type";
  if (!state.ownership) return "ownership";
  if (!state.documents) return "documents";
  if (state.loanAmount == null) return "loan_amount";
  if (!state.occupation && !state.incomeMode) return "occupation_income";
  if (!state.occupation) return "occupation";
  if (!state.incomeMode) return "income_mode";
  if (state.marketValue == null) return "market_value";
  if (state.tenureYears == null) return "tenure";
  return null;
}

function questionFor(asked: Asked, profile: CallProfile, state: QualState): string {
  switch (asked) {
    case "property_type":
    case "clarify_property":
      return propertyQuestion(profile);
    case "ownership":
      return ownershipQuestion(profile);
    case "documents":
    case "clarify_documents":
      return documentsQuestion(profile);
    case "loan_amount":
      return loanQuestion(profile);
    case "occupation_income":
    case "occupation":
    case "income_mode":
      return occupationQuestion(profile, state);
    case "market_value":
      return marketQuestion(profile);
    case "tenure":
      return tenureQuestion(profile);
    default:
      return propertyQuestion(profile);
  }
}

function ack(profile: CallProfile): string {
  return say(profile, "Thank you.", "धन्यवाद।");
}

function joinReply(parts: string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function end(state: QualState, reason: EndReason, patch: Partial<QualState> = {}): QualState {
  return { ...state, ...patch, stage: "ended", endReason: reason };
}

function fatalReason(state: QualState): string | null {
  if (state.propertyType === "agricultural") return "agricultural";
  if (state.documents === "unavailable") return "documents";
  if (state.incomeMode === "cash") return "cash";
  if (state.tenureYears != null && (state.tenureYears < 3 || state.tenureYears > 15)) return "tenure";
  return null;
}

function continueQualify(state: QualState, profile: CallProfile, facts: Facts): TurnResult {
  const reason = fatalReason(state);
  if (reason) {
    return {
      state: end(state, "disqualified", { disqualifyReason: reason }),
      reply: dqClose(profile, reason),
    };
  }
  if (facts.existingLoan || facts.emiReduction || state.transferReason) {
    const transferReason = facts.emiReduction ? "emi" : "existing_loan";
    return {
      state: end(state, "transfer", { transferReason }),
      reply: transferClose(profile),
    };
  }
  if (facts.notInterested) {
    return { state: end(state, "not_interested"), reply: notInterestedClose(profile) };
  }
  if (facts.busy || facts.unavailable) {
    if (facts.callbackTime) {
      return {
        state: end(state, "callback", { callbackTime: facts.callbackTime }),
        reply: callbackClose(profile, facts.callbackTime),
      };
    }
    return {
      state: { ...state, stage: "callback", asked: "callback" },
      reply: callbackAsk(profile),
    };
  }

  const pendingOver = facts.loanAmount != null && facts.loanAmount > MAX_LOAN && state.loanAmount == null;
  if (pendingOver) {
    return {
      state: { ...state, stage: "loan_cap", asked: "loan_cap", capOffered: true },
      reply: joinReply([ack(profile), capQuestion(profile)]),
    };
  }

  if (facts.propertyAmbiguous && !state.propertyType) {
    return {
      state: { ...state, stage: "qualify", asked: "clarify_property" },
      reply: say(
        profile,
        "Just so I note it correctly — is that a residential plot, a commercial property, or agricultural land?",
        "सही नोट करने के लिए पूछ रही हूँ — क्या यह रिहायशी प्लॉट है, कमर्शियल प्रॉपर्टी है, या कृषि भूमि?".replace(
          "रही",
          profile.agentGender === "female" ? "रही" : "रहा",
        ),
      ),
    };
  }
  if (facts.documentsAmbiguous && !state.documents) {
    return {
      state: { ...state, stage: "qualify", asked: "clarify_documents" },
      reply: say(
        profile,
        "Just to confirm — do you have the original property documents available for verification, or only copies?",
        "बस पुष्टि के लिए — क्या ओरिजिनल प्रॉपर्टी दस्तावेज़ वेरिफ़िकेशन के लिए उपलब्ध हैं, या सिर्फ़ कॉपी?",
      ),
    };
  }

  if (facts.openQuestion && !facts.interestAsk && !facts.branchAsk && !facts.docsAsk && !facts.feeAsk) {
    const missing = firstMissing(state);
    return {
      state: { ...state, stage: "qualify", asked: "diversion", resumeAsked: missing },
      reply: diversionPrefix(profile, facts),
    };
  }

  const missing = firstMissing(state);
  if (!missing) {
    return { state: end(state, "handoff"), reply: handoffClose(profile) };
  }
  const prefix = hasDiversion(facts) && !facts.openQuestion ? diversionPrefix(profile, facts) : ack(profile);
  return {
    state: { ...state, stage: "qualify", asked: missing, resumeAsked: null },
    reply: joinReply([prefix, questionFor(missing, profile, state)]),
  };
}

export function handleUtterance(state: QualState, utterance: string, profile: CallProfile): TurnResult {
  if (state.stage === "ended") {
    return {
      state,
      reply: say(
        profile,
        "This call has already ended. Thank you.",
        "यह कॉल पहले ही समाप्त हो चुकी है। धन्यवाद।",
      ),
    };
  }

  const text = utterance.trim();
  if (!text) {
    return {
      state,
      reply: say(profile, "Sorry, I didn't catch that. Could you say it once more?", "क्षमा कीजिए, मैं सुन नहीं पाई। एक बार फिर बता देंगे?".replace(
        "पाई",
        profile.agentGender === "female" ? "पाई" : "पाया",
      )),
    };
  }

  const facts = extract(text, state, profile);

  if (!state.verified) {
    if (facts.wrongNumber) {
      return { state: end(state, "wrong_number"), reply: wrongNumberClose(profile) };
    }
    if ((state.stage === "callback" || state.asked === "callback") && !facts.verified && !facts.yes) {
      const when = facts.callbackTime ?? cleanTime(text);
      return {
        state: end(applyFacts(state, facts), "callback", { callbackTime: when }),
        reply: callbackClose(profile, when),
      };
    }
    if (facts.whoCalling && !facts.verified && !facts.yes) {
      return { state: { ...applyFacts(state, facts), asked: "who" }, reply: whoLine(profile) };
    }
    if (!facts.verified && !facts.yes) {
      const remembered = applyFacts(state, facts);
      if (facts.busy || facts.unavailable) {
        if (facts.callbackTime) {
          return {
            state: end(remembered, "callback", { callbackTime: facts.callbackTime }),
            reply: callbackClose(profile, facts.callbackTime),
          };
        }
        return { state: { ...remembered, stage: "callback", asked: "callback" }, reply: callbackAsk(profile) };
      }
      if (facts.propertyType || facts.loanAmount || facts.marketValue || facts.ownership || facts.documents) {
        return {
          state: remembered,
          reply: say(
            profile,
            `I'll note that. First — am I speaking with ${profile.customerName}?`,
            `मैं यह नोट कर ${g(profile, "लेती", "लेता")} हूँ। पहले यह पुष्टि कर लूँ — क्या मैं ${profile.customerName} से बात कर ${g(profile, "रही", "रहा")} हूँ?`,
          ),
        };
      }
      return {
        state,
        reply: say(
          profile,
          `Sorry, I need to confirm. Am I speaking with ${profile.customerName}?`,
          `क्षमा कीजिए, पुष्टि ज़रूरी है। क्या मैं ${profile.customerName} से बात कर ${g(profile, "रही", "रहा")} हूँ?`,
        ),
      };
    }

    const next = applyFacts({ ...state, verified: true }, facts);
    if (facts.busy || facts.unavailable) {
      if (facts.callbackTime) {
        return {
          state: end(next, "callback", { callbackTime: facts.callbackTime }),
          reply: callbackClose(profile, facts.callbackTime),
        };
      }
      return { state: { ...next, stage: "callback", asked: "callback" }, reply: callbackAsk(profile) };
    }
    if (fatalReason(next) || facts.existingLoan || facts.emiReduction || facts.notInterested) {
      return continueQualify({ ...next, stage: "qualify" }, profile, facts);
    }
    const volunteered =
      facts.propertyType ||
      facts.ownership ||
      facts.documents ||
      facts.loanAmount != null ||
      facts.occupation ||
      facts.incomeMode ||
      facts.marketValue != null ||
      facts.tenureYears != null;
    if (!volunteered) {
      return { state: { ...next, stage: "offer", asked: "offer" }, reply: offerLine(profile) };
    }
    const missing = firstMissing(next);
    return {
      state: { ...next, stage: missing ? "qualify" : "qualify", asked: missing ?? "offer" },
      reply: joinReply([offerLine(profile).replace(/\s*Shall we go ahead\?$/, "").replace(/\s*क्या हम आगे बढ़ें\?$/, ""), missing ? questionFor(missing, profile, next) : handoffClose(profile)]),
    };
  }

  let next = applyFacts(state, facts);

  if (state.stage === "loan_cap" || state.asked === "loan_cap") {
    const acceptedAmount = facts.loanAmount != null && facts.loanAmount <= MAX_LOAN ? facts.loanAmount : null;
    if (acceptedAmount != null) {
      next = { ...next, loanAmount: acceptedAmount, stage: "qualify" };
      return continueQualify(next, profile, { ...facts, loanAmount: acceptedAmount, notInterested: false, no: false });
    }
    if (facts.yes && !facts.no) {
      next = { ...next, loanAmount: MAX_LOAN, stage: "qualify" };
      return continueQualify(next, profile, { ...facts, loanAmount: null, notInterested: false, no: false });
    }
    if (facts.no || facts.notInterested) {
      return { state: end(next, "declined_cap"), reply: declinedCapClose(profile) };
    }
    return { state: { ...next, stage: "loan_cap", asked: "loan_cap" }, reply: capQuestion(profile) };
  }

  if (state.asked === "diversion") {
    const resume = state.resumeAsked ?? firstMissing(next);
    if (facts.openQuestion && !facts.interestAsk && !facts.branchAsk && !facts.docsAsk && !facts.feeAsk && !facts.propertyType) {
      return { state: next, reply: say(profile, "Yes, go ahead.", "जी, पूछिए।") };
    }
    const prefix = hasDiversion(facts) ? diversionPrefix(profile, facts) : "";
    if (fatalReason(next) || facts.existingLoan || facts.emiReduction || facts.notInterested) {
      return continueQualify(next, profile, facts);
    }
    if (!resume) return { state: end(next, "handoff"), reply: joinReply([prefix, handoffClose(profile)]) };
    return {
      state: { ...next, stage: "qualify", asked: resume, resumeAsked: null },
      reply: joinReply([prefix || ack(profile), questionFor(resume, profile, next)]),
    };
  }

  if (state.stage === "offer" || state.asked === "offer") {
    if (facts.busy) {
      if (facts.callbackTime) {
        return {
          state: end(next, "callback", { callbackTime: facts.callbackTime }),
          reply: callbackClose(profile, facts.callbackTime),
        };
      }
      return { state: { ...next, stage: "callback", asked: "callback" }, reply: callbackAsk(profile) };
    }
    if (facts.notInterested || (facts.no && !facts.yes && !facts.propertyType && !facts.existingLoan)) {
      return { state: end(next, "not_interested"), reply: notInterestedClose(profile) };
    }
    const volunteered =
      !!facts.propertyType ||
      !!facts.ownership ||
      !!facts.documents ||
      facts.loanAmount != null ||
      !!facts.occupation ||
      !!facts.incomeMode ||
      facts.marketValue != null ||
      facts.tenureYears != null ||
      facts.existingLoan ||
      facts.emiReduction;
    if ((facts.interestAsk || facts.branchAsk || facts.docsAsk || facts.feeAsk || facts.openQuestion) && !volunteered && !facts.yes) {
      return {
        state: { ...next, stage: "offer", asked: "offer" },
        reply: joinReply([
          diversionPrefix(profile, facts),
          say(profile, "Shall we go ahead with a few questions?", "क्या हम कुछ सवालों के साथ आगे बढ़ें?"),
        ]),
      };
    }
    if (!volunteered && (facts.yes || !facts.no)) {
      return {
        state: { ...next, stage: "qualify", asked: "property_type" },
        reply: joinReply([say(profile, "Great.", "बहुत अच्छा।"), propertyQuestion(profile)]),
      };
    }
    return continueQualify({ ...next, stage: "qualify" }, profile, facts);
  }

  if (state.stage === "callback") {
    const when = facts.callbackTime ?? (looksLikeTime(text) ? cleanTime(text) : null);
    if (fatalReason(next)) return continueQualify(next, profile, facts);
    if (when) {
      return {
        state: end(next, "callback", { callbackTime: when }),
        reply: callbackClose(profile, when),
      };
    }
    return {
      state: { ...next, stage: "callback", asked: "callback" },
      reply: say(profile, "What time should I note for the callback?", "कॉलबैक के लिए कौन सा समय नोट करूँ?"),
    };
  }

  return continueQualify({ ...next, stage: "qualify" }, profile, facts);
}

export function simulate(profile: CallProfile, turns: string[]): { state: QualState; lines: { role: "agent" | "customer"; text: string }[] } {
  let state = initialState();
  const lines: { role: "agent" | "customer"; text: string }[] = [{ role: "agent", text: openingLine(profile) }];
  for (const turn of turns) {
    lines.push({ role: "customer", text: turn });
    const result = handleUtterance(state, turn, profile);
    state = result.state;
    lines.push({ role: "agent", text: result.reply });
  }
  return { state, lines };
}

export function capturedCount(state: QualState): number {
  return [
    state.propertyType && state.propertyType !== "agricultural",
    state.ownership,
    state.documents === "available",
    state.loanAmount != null,
    state.occupation && state.incomeMode === "bank",
    state.marketValue != null,
    state.tenureYears != null && state.tenureYears >= 3 && state.tenureYears <= 15,
  ].filter(Boolean).length;
}

export { formatINR };

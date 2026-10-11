import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleUtterance, initialState, openingLine, simulate } from "./engine.ts";
import { DEFAULT_RAG, type CallProfile } from "./types.ts";

function profile(over: Partial<CallProfile> = {}): CallProfile {
  return {
    companyName: "Home Credit",
    customerName: "Rahul Sharma",
    agentName: "Ananya",
    agentGender: "female",
    language: "English",
    rag: DEFAULT_RAG,
    dateLabel: "11 Oct 2026",
    dayLabel: "Sunday",
    timeLabel: "12:40",
    ...over,
  };
}

const P = profile();

function lastAgent(turns: string[]) {
  const run = simulate(P, turns);
  const agents = run.lines.filter((l) => l.role === "agent");
  return { state: run.state, reply: agents[agents.length - 1].text, lines: run.lines };
}

describe("LAP qualification engine", () => {
  it("opens by verifying the named customer", () => {
    assert.match(openingLine(P), /Rahul Sharma/);
    assert.match(openingLine(P), /\?/);
  });

  it("presents the offer only after identity, then qualifies a clean file", () => {
    const id = lastAgent(["Yes, this is Rahul."]);
    assert.equal(id.state.endReason, null);
    assert.match(id.reply, /₹75 lakh/);
    assert.match(id.reply, /Home Credit/);
    assert.equal(id.state.stage, "offer");

    const done = lastAgent([
      "Yes, this is Rahul.",
      "Yes, please go ahead.",
      "It's a residential flat.",
      "I'm the sole owner.",
      "Yes, the original documents are at home.",
      "I need 50 lakh.",
      "I'm salaried and my salary comes into my bank account.",
      "The property is worth about 1 crore.",
      "I'd like 10 years.",
    ]);
    assert.equal(done.state.endReason, "handoff");
    assert.match(done.reply, /senior loan expert/);
    assert.doesNotMatch(done.reply, /\?/);
    assert.equal(done.state.propertyType, "residential");
    assert.equal(done.state.ownership, "sole");
    assert.equal(done.state.documents, "available");
    assert.equal(done.state.loanAmount, 5_000_000);
    assert.equal(done.state.occupation, "salaried");
    assert.equal(done.state.incomeMode, "bank");
    assert.equal(done.state.marketValue, 10_000_000);
    assert.equal(done.state.tenureYears, 10);
  });

  it("disqualifies agricultural property immediately", () => {
    const run = lastAgent(["Yes speaking.", "Sure.", "It's agricultural land."]);
    assert.equal(run.state.endReason, "disqualified");
    assert.equal(run.state.disqualifyReason, "agricultural");
    assert.match(run.reply, /do not meet the criteria/);
    assert.doesNotMatch(run.reply, /\?/);
  });

  it("disqualifies cash income", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Go ahead.",
      "Residential house.",
      "Sole owner.",
      "Originals are available.",
      "40 lakh.",
      "I'm self-employed and I take income in cash.",
    ]);
    assert.equal(run.state.endReason, "disqualified");
    assert.equal(run.state.disqualifyReason, "cash");
    assert.equal(run.state.occupation, "self_employed");
  });

  it("disqualifies photocopies", () => {
    const run = lastAgent([
      "Rahul speaking.",
      "Yes.",
      "It's a house.",
      "My own.",
      "I only have photocopies.",
    ]);
    assert.equal(run.state.disqualifyReason, "documents");
    assert.equal(run.state.endReason, "disqualified");
  });

  it("disqualifies tenure outside 3 to 15", () => {
    const base = [
      "Yes, this is Rahul.",
      "Yes.",
      "Industrial warehouse.",
      "Jointly owned with my brother.",
      "Original documents are available.",
      "I need ₹30 lakh.",
      "I have a job and salary is credited to my bank.",
      "Worth about 80 lakh.",
    ];
    const short = lastAgent([...base, "2 years."]);
    assert.equal(short.state.disqualifyReason, "tenure");
    const long = lastAgent([...base, "20 years."]);
    assert.equal(long.state.disqualifyReason, "tenure");
    const edge = lastAgent([...base, "15 years."]);
    assert.equal(edge.state.endReason, "handoff");
    assert.equal(edge.state.tenureYears, 15);
    assert.equal(edge.state.propertyType, "industrial");
    assert.equal(edge.state.ownership, "joint");
  });

  it("offers ₹75 lakh when the request is higher, and continues only if accepted", () => {
    const asked = lastAgent([
      "Yes, this is Rahul.",
      "Interested, yes.",
      "Commercial shop.",
      "Jointly owned with my wife.",
      "Original papers are available.",
      "I need 90 lakh.",
    ]);
    assert.equal(asked.state.stage, "loan_cap");
    assert.match(asked.reply, /75 lakh/);
    assert.match(asked.reply, /\?/);
    assert.equal(asked.state.loanAmount, null);

    const accepted = lastAgent([
      "Yes, this is Rahul.",
      "Yes I'm interested.",
      "It's a commercial showroom.",
      "Jointly owned with my brother.",
      "The original documents are available.",
      "I need 90 lakh.",
      "Yes, proceed with 75.",
      "Salaried, income in the bank.",
      "Worth 2 crore.",
      "12 years.",
    ]);
    assert.equal(accepted.state.loanAmount, 7_500_000);
    assert.equal(accepted.state.endReason, "handoff");

    const declined = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "Residential.",
      "Sole owner.",
      "Originals are available.",
      "I need 90 lakhs.",
      "No, I don't want to lower it.",
    ]);
    assert.equal(declined.state.endReason, "declined_cap");
    assert.doesNotMatch(declined.reply, /\?/);
  });

  it("accepts exactly 75 lakh without the cap negotiation", () => {
    const run = lastAgent(["Yes, this is Rahul.", "Go ahead.", "It's my own house.", "I need 75 lakh."]);
    assert.notEqual(run.state.stage, "loan_cap");
    assert.equal(run.state.loanAmount, 7_500_000);
    assert.equal(run.state.propertyType, "residential");
    assert.equal(run.state.ownership, "sole");
    assert.match(run.reply, /original/i);
  });

  it("collapses a same-breath cap acceptance", () => {
    const run = lastAgent(["Yes, this is Rahul.", "Yes.", "Residential flat.", "I need 90 lakh but 75 is fine."]);
    assert.equal(run.state.loanAmount, 7_500_000);
    assert.notEqual(run.state.endReason, "declined_cap");
    assert.doesNotMatch(run.reply, /would you like to proceed/i);
  });

  it("routes existing loans and EMI reduction to a transfer specialist", () => {
    const loan = lastAgent(["Yes, Rahul speaking.", "I already have a loan on this property."]);
    assert.equal(loan.state.endReason, "transfer");
    assert.match(loan.reply, /loan-transfer specialist/);
    assert.doesNotMatch(loan.reply, /\?/);

    const emi = lastAgent(["This is Rahul.", "Actually I want to reduce my existing EMI."]);
    assert.equal(emi.state.endReason, "transfer");
  });

  it("does not treat a fresh loan denial as a transfer", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "No, I don't have an existing loan. It's a fresh loan. The property is residential.",
    ]);
    assert.notEqual(run.state.endReason, "transfer");
    assert.equal(run.state.propertyType, "residential");
  });

  it("remembers out-of-order facts and asks the earliest gap", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "It's a residential house worth about 1.2 crore, jointly owned with my wife.",
    ]);
    assert.equal(run.state.propertyType, "residential");
    assert.equal(run.state.ownership, "joint");
    assert.equal(run.state.marketValue, 12_000_000);
    assert.equal(run.state.endReason, null);
    assert.match(run.reply, /original/i);
    assert.doesNotMatch(run.reply, /market value/i);
    assert.doesNotMatch(run.reply, /jointly owned/i);
  });

  it("captures a stacked answer and skips those questions", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Sure.",
      "It's my own residential property, original documents are available, I need 40 lakhs and I'd prefer 10 years.",
    ]);
    assert.equal(run.state.propertyType, "residential");
    assert.equal(run.state.ownership, "sole");
    assert.equal(run.state.documents, "available");
    assert.equal(run.state.loanAmount, 4_000_000);
    assert.equal(run.state.tenureYears, 10);
    assert.equal(run.state.marketValue, null);
    assert.match(run.reply, /salaried|self-employed|bank|cash/i);
  });

  it("does not confuse monthly income with the loan amount", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes I'm interested. I earn ₹80,000 a month and my property is worth around ₹1 crore.",
    ]);
    assert.equal(run.state.loanAmount, null);
    assert.equal(run.state.marketValue, 10_000_000);
    assert.equal(run.state.propertyType, null);
    assert.match(run.reply, /residential|commercial|industrial/i);
    assert.doesNotMatch(run.reply, /market value/i);
  });

  it("schedules a callback when the customer is busy", () => {
    const ask = lastAgent(["I'm in a meeting."]);
    assert.equal(ask.state.stage, "callback");
    assert.match(ask.reply, /convenient time/i);
    assert.equal(ask.state.endReason, null);
    const done = lastAgent(["I'm in a meeting.", "Tomorrow evening after 6."]);
    assert.equal(done.state.endReason, "callback");
    assert.match(done.reply, /call you back/i);
    assert.doesNotMatch(done.reply, /\?/);
  });

  it("uses the latest property type when the customer corrects themselves", () => {
    const run = lastAgent(["Yes speaking.", "Go ahead.", "It's residential, actually no, it's agricultural land."]);
    assert.equal(run.state.propertyType, "agricultural");
    assert.equal(run.state.endReason, "disqualified");
  });

  it("overwrites tenure with the corrected number", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "Residential.",
      "Sole.",
      "Original documents are available.",
      "50 lakh.",
      "Salaried, bank account.",
      "Worth 1 crore.",
      "It's 10 years, actually make that 12.",
    ]);
    assert.equal(run.state.tenureYears, 12);
    assert.equal(run.state.endReason, "handoff");
  });

  it("deflects interest rate and returns to the missing question", () => {
    const run = lastAgent(["Yes, this is Rahul.", "Yes.", "Before that, what interest rate do you offer?"]);
    assert.equal(run.state.endReason, null);
    assert.match(run.reply, /senior loan expert/i);
    assert.doesNotMatch(run.reply, /\d+\s*%/);
    assert.match(run.reply, /residential|commercial|industrial/i);
  });

  it("does not invent a branch", () => {
    const run = lastAgent(["Yes, this is Rahul.", "Where is your nearest branch?"]);
    assert.match(run.reply, /don't have branch/i);
    assert.equal(run.state.endReason, null);
  });

  it("explains identity without the offer amount", () => {
    const run = lastAgent(["Who is this?"]);
    assert.match(run.reply, /Ananya/);
    assert.match(run.reply, /Home Credit/);
    assert.doesNotMatch(run.reply, /75/);
    assert.equal(run.state.verified, false);
    const next = lastAgent(["Who is this?", "Yes, this is Rahul."]);
    assert.match(next.reply, /75 lakh/);
    assert.equal(next.state.verified, true);
  });

  it("ends politely when the customer is not interested", () => {
    const run = lastAgent(["Yes, this is Rahul.", "No thanks, I'm not interested."]);
    assert.equal(run.state.endReason, "not_interested");
    assert.doesNotMatch(run.reply, /\?/);
  });

  it("ends on a wrong number", () => {
    const run = lastAgent(["Sorry, wrong number."]);
    assert.equal(run.state.endReason, "wrong_number");
  });

  it("asks again when documents are only a guess", () => {
    const vague = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "Residential house.",
      "Sole owner.",
      "I think the papers are probably somewhere.",
    ]);
    assert.equal(vague.state.documents, null);
    assert.match(vague.reply, /original/i);
    assert.equal(vague.state.endReason, null);
    const clear = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "Residential house.",
      "Sole owner.",
      "I think the papers are probably somewhere.",
      "Yes, the originals are at home.",
    ]);
    assert.equal(clear.state.documents, "available");
    assert.match(clear.reply, /borrow|how much/i);
  });

  it("does not read 'at home' as a residential property", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "Commercial office space.",
      "Sole owner.",
      "The original documents are available at home.",
    ]);
    assert.equal(run.state.propertyType, "commercial");
    assert.equal(run.state.documents, "available");
  });

  it("does not treat an office job as a commercial property", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes. I have an office job and salary is credited to my bank.",
    ]);
    assert.equal(run.state.propertyType, null);
    assert.equal(run.state.occupation, "salaried");
    assert.equal(run.state.incomeMode, "bank");
    assert.match(run.reply, /residential|commercial|industrial/i);
  });

  it("qualifies a low market value because no minimum is specified", () => {
    const run = lastAgent([
      "Yes, this is Rahul.",
      "Yes.",
      "Residential.",
      "Jointly with my wife.",
      "Originals are available.",
      "15 lakh.",
      "Self-employed, into my bank account.",
      "The market value is about 20 lakh.",
      "3 years.",
    ]);
    assert.equal(run.state.marketValue, 2_000_000);
    assert.equal(run.state.tenureYears, 3);
    assert.equal(run.state.endReason, "handoff");
  });

  it("speaks Hindi with the configured gender", () => {
    const female = openingLine(profile({ language: "Hindi" }));
    assert.match(female, /सकती/);
    const male = openingLine(profile({ language: "Hindi", agentGender: "male", agentName: "Arjun" }));
    assert.match(male, /सकता/);
    assert.doesNotMatch(male, /सकती/);
    let state = initialState();
    const step = handleUtterance(state, "It's agricultural land. Haan, Rahul bol raha hoon.", profile({ language: "Hindi" }));
    state = step.state;
    assert.match(step.reply, /[\u0900-\u097F]/);
  });
});

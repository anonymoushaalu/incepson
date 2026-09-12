// Zero knowledge of Hedera or x402. This module never reaches settlement
// code directly -- see docs/PLAN.md section 3, "the enforcement boundary".
// The only spending
// affordance is the request_payment tool call below; the broker decides
// whether it actually settles.
import OpenAI from "openai";
import { env } from "../config.js";

export interface RequestPaymentArgs {
  service: string;
  amount_hbar: number;
  reason: string;
}

export type RequestPaymentFn = (args: RequestPaymentArgs) => Promise<{
  decision: string;
  code: string;
  explanation: string;
}>;

const requestPaymentTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "request_payment",
    description:
      "Request payment for access to a paid data service. The payment engine decides autonomously whether to allow, escalate to human approval, or deny this request -- you will be told the outcome, not asked to authorize it yourself.",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string", description: "Hostname of the service being paid, e.g. gas-oracle.local" },
        amount_hbar: { type: "number", description: "Amount to pay, in HBAR" },
        reason: { type: "string", description: "Why this payment is being requested" },
      },
      required: ["service", "amount_hbar", "reason"],
    },
  },
};

export async function runAgentTask(
  userTask: string,
  requestPayment: RequestPaymentFn
): Promise<{ transcript: string[] }> {
  const client = new OpenAI({ apiKey: env.openaiApiKey });
  const transcript: string[] = [];

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: "developer",
      content:
        "You are a research agent. You may call request_payment to pay for data from services you learn about. " +
        "You do not decide whether a payment is allowed -- a separate system does that and will tell you the outcome.",
    },
    { role: "user", content: userTask },
  ];

  for (let turn = 0; turn < 6; turn++) {
    const completion = await client.chat.completions.create({
      model: env.openaiModel,
      messages,
      tools: [requestPaymentTool],
    });

    const message = completion.choices[0].message;
    messages.push(message);
    if (message.content) transcript.push(message.content);

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) break;

    for (const call of toolCalls) {
      if (call.type !== "function" || call.function.name !== "request_payment") continue;
      const args = JSON.parse(call.function.arguments) as RequestPaymentArgs;
      const outcome = await requestPayment(args);
      transcript.push(`[request_payment ${args.service} ${args.amount_hbar} HBAR] -> ${outcome.decision} (${outcome.code}): ${outcome.explanation}`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(outcome),
      });
    }
  }

  return { transcript };
}

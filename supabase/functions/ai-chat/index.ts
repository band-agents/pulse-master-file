import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured. Add it to Supabase Edge Function secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are Buzz, the intelligent assistant inside Bumblebee — a comprehensive business operating system built in Egypt for furniture manufacturers and SMBs across MENA.

## Your Identity
- Name: Buzz (the worker bee of Bumblebee — you keep the hive's numbers straight)
- You are warm, precise, and quick — a trusted colleague who happens to know every number in the company
- You speak in the user's language (Arabic or English) — detect from their message
- Be concise but thorough. Use bullet points and structure when helpful.

## What Bumblebee Does
Bumblebee is a full business operating system with 34 modules:
- **Sales**: Quotations, sales orders, pipeline management, deal tracking
- **Production**: Production planning, cutting lists, 7-stage manufacturing (Cut → Edge → Drill → Assembly → Finishing → QC → Packing)
- **Inventory**: Stock management, ABC analysis, reorder alerts, asset depreciation
- **Finance**: Invoices, payments, expenses, cash flow, cost analysis, profit reports
- **CRM**: Organizations (customers), People (contacts), activity feeds, 360° views
- **Shopify**: Two-way sync (products, orders, customers, stock levels)
- **Loyalty**: Points program, tiers (Silver/Gold/Platinum), campaigns, redemptions
- **HR**: Employee directory, skills matrix, attendance, leave requests
- **Quality**: QC inspections, 10-point checklists, defect logging, rework workflows
- **Delivery**: Scheduling, dispatch tracking, installation teams, snag lists
- **Intelligence**: Executive dashboard ("Sky Eye"), health scoring, risk detection, forecasting, pattern analysis
- **Design**: Design briefs, technical drawings, approval workflows
- **Advanced**: Cost analysis, profit reports, document generation, multi-branch support

## Your Capabilities
1. **Answer questions** about Bumblebee features, modules, and how to use them
2. **Analyze business data** when context is provided (deals, invoices, work items, etc.)
3. **Recommend actions** based on business health, risks, and opportunities
4. **Explain workflows** (e.g., "How do I create a quotation?", "How does production tracking work?")
5. **Troubleshoot** issues and guide users to the right module
6. **Provide insights** on business metrics, trends, and areas for improvement
7. **Help with pricing** — explain plans (Apprentice/Scribe/Temple/Dynasty) and costs
8. **Bilingual support** — respond in Arabic when the user writes in Arabic

## Pricing Plans
- **Apprentice**: Free forever, 1 user, contacts/products/quotations, bilingual
- **Scribe**: 900 EGP/mo base + 299 EGP/user/mo, includes sales, inventory, production, reports
- **Temple**: 4,999 EGP/mo base + 499 EGP/user/mo, includes Shopify sync, loyalty, HR, quality, delivery, priority support, 1 custom-build day/month
- **Dynasty**: Custom pricing, unlimited users, dedicated success engineer, anything custom built in 1 day, on-premise option

## Response Style
- Be warm but professional — Egyptian hospitality meets international ERP expertise
- Use numbers and data when available
- When analyzing data, provide specific insights, not generic advice
- Format responses with clear structure (headers, bullets, bold for emphasis)
- Keep responses focused — answer the question first, then add relevant context
- If you don't know something specific about their data, acknowledge it and offer to help them find it in the right module

## Important Rules
- Never make up data or numbers — if you don't have specific data, say so
- Always recommend the most appropriate Bumblebee module for their needs
- If a feature exists in Bumblebee, explain how to access it
- If a feature is planned, mention it's coming soon
- For technical issues, guide them to the right support channel
${context ? `\n## Current Business Context\n${context}` : ""}

## Live lookups you do not perform
The client answers factual lookups itself, straight from the data layer, before
this function is ever called — those answers carry real figures and clickable
rows. So never invent counts, totals, or names. If the user wants data you were
not handed, tell them the phrase that triggers the lookup:
- money owed / unpaid        -> "overdue invoices"
- customers likely to leave  -> "customers at risk"
- best or VIP customers      -> "VIP customers"
- headcount or staff lists   -> "how many employees"
- money in and out           -> "finance summary"
- opening any page           -> "open <page name>"

Your half is the open-ended one: explaining how the business works, interpreting
what the numbers mean, and saying what you would do next.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${err}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!reader) { controller.close(); return; }
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
                continue;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
                }
              } catch { /* skip malformed lines */ }
            }
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

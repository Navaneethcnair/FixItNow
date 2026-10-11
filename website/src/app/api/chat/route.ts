import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const { message, jobContext, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    const problemTitle = jobContext?.problem_title || 'Reported Maintenance Issue';
    const trade = jobContext?.trade_required || 'repair';
    const severity = jobContext?.severity || 'moderate';
    const description = jobContext?.description || 'General repair issue';
    const dimension = jobContext?.dimension || 'N/A';
    const location = jobContext?.location || 'Nearby location';
    const solutionSteps = Array.isArray(jobContext?.solution_steps) ? jobContext.solution_steps.join('\n- ') : '';
    const tools = jobContext?.worker_instructions || 'Standard repair tools';

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const systemPrompt = `You are FixItNow AI Assistant, an expert handyman, repair engineer, and blue-collar service advisor.

ANALYZED ISSUE CONTEXT:
- Problem Title: ${problemTitle}
- Category / Trade: ${trade}
- Severity: ${severity}
- Observed Description: ${description}
- Estimated Size / Dimensions: ${dimension}
- Location: ${location}
- Recommended Resolution Plan:
- ${solutionSteps}
- Required Tools & Materials: ${tools}

FORMATTING & STRUCTURE RULES:
1. Provide highly structured, clean responses with bold headings (**Header**).
2. Use bullet points (- item) or numbered lists (1. step) for steps, tools, costs, and safety steps.
3. Use bolding for key terms, costs in INR (₹), or tool names.
4. Keep paragraphs short and concise. Do NOT send long unstructured walls of text.`;

        // Format conversation history for Gemini
        const chat = model.startChat({
          history: (history || []).map((h: { role: string; content: string }) => ({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          })),
        });

        const fullPrompt = `${systemPrompt}\n\nUser Question: ${message}`;
        const result = await chat.sendMessage(fullPrompt);
        const responseText = result.response.text();

        if (responseText) {
          return NextResponse.json({ reply: responseText });
        }
      } catch (geminiError) {
        console.warn('Gemini API chat error, using dynamic fallback:', geminiError);
      }
    }

    // Dynamic Intelligent Fallback Response (Structured with bold text and clear lists)
    const lower = message.toLowerCase();
    let reply = '';

    if (lower.includes('contain') || lower.includes('temporary') || lower.includes('emergency')) {
      reply = `**Emergency Containment Steps for ${problemTitle}:**\n\n` +
        `1. **Shut Off Main Control:** Immediately turn off the main water valve or electrical breaker connected to the fixture.\n` +
        `2. **Clear Surrounding Area:** Move furniture, appliances, or cables away from liquid or exposed areas.\n` +
        `3. **Apply Temporary Seal:** Wrap waterproof repair tape or silicone sealant firmly around joint fractures to prevent leaks.\n` +
        `4. **Secure Professional Help:** Book a certified ${trade} worker below for permanent structural repair.`;
    } else if (lower.includes('tools') || lower.includes('material') || lower.includes('exact tools')) {
      reply = `**Required Tools & Materials Checklist:**\n\n` +
        `• **Primary Tools:** ${tools}\n` +
        `• **Safety Gear:** Insulated rubber gloves, safety goggles, and heavy-duty work boots.\n` +
        `• **Replacement Fittings:** Heavy-duty joint connectors, PVC solvent sealant, and Teflon thread tape.`;
    } else if (lower.includes('cost') || lower.includes('price') || lower.includes('charges') || lower.includes('estimate')) {
      reply = `**Estimated Cost & Labor Charges Breakdown:**\n\n` +
        `• **Technician Labor:** ₹300 – ₹550 / hr (based on local worker experience)\n` +
        `• **Spare Parts & Sealants:** ₹450 – ₹1,200 (estimated replacement fittings)\n` +
        `• **Total Estimated Service Budget:** ₹750 – ₹1,750\n\n` +
        `*Tip: Browse verified ${trade} profiles listed on this page to compare rates and book directly!*`;
    } else if (lower.includes('safety') || lower.includes('precaution') || lower.includes('hazard')) {
      reply = `**Important Safety Precautions:**\n\n` +
        `• **Isolate Utilities:** Never touch active wiring or pressurized water fittings without isolating the main supply.\n` +
        `• **Use Protective Equipment:** Always wear eye protection and gloves when handling cracked materials or adhesives.\n` +
        `• **Avoid Forced Pressure:** Do not force stuck components; use proper leverage tools or call a specialist.\n` +
        `• **Urgent Severity:** For ${severity} issues, professional intervention is strongly advised.`;
    } else {
      reply = `**AI Assessment Summary for ${problemTitle}:**\n\n` +
        `• **Trade Category:** ${trade.toUpperCase()}\n` +
        `• **Severity Rating:** ${severity.toUpperCase()}\n` +
        `• **Key Resolution Steps:**\n` +
        (solutionSteps ? `- ${solutionSteps}\n\n` : `1. Inspect damaged components.\n2. Apply sealants and replace damaged fittings.\n\n`) +
        `• **Tools Required:** ${tools}\n\n` +
        `Feel free to ask me any further questions about tools, costs, or DIY steps!`;
    }

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process chat message' }, { status: 500 });
  }
}

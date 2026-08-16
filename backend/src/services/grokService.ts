import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface EvaluateParams {
  calibrationBase64: string;
  answerPagesBase64: string[];
  rubric: any;
}

export async function evaluateWithGrok({
  calibrationBase64,
  answerPagesBase64,
  rubric,
}: EvaluateParams) {
  const content: any[] = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: calibrationBase64,
      },
    },
    {
      type: "text",
      text: "Above is the student's handwriting calibration sample. Use this as a reference to accurately read this student's handwriting style.",
    },
  ];

  // Add all answer pages
  answerPagesBase64.forEach((pageBase64, index) => {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: pageBase64,
      },
    });
    content.push({
      type: "text",
      text: `--- Answer Script Page ${index + 1} ---`,
    });
  });

  content.push({
    type: "text",
    text: `Now do the following tasks carefully:

1. Transcribe the handwritten answer script accurately using the calibration sample as reference.
2. Evaluate the answers strictly against the given rubric.
3. Return ONLY valid JSON in this exact format:

{
  "transcription": "full transcribed text here...",
  "evaluation": [
    {
      "question_number": 1,
      "student_answer_summary": "...",
      "criteria_scores": [
        { "criterion": "...", "awarded": 3, "max": 3, "note": "optional" }
      ],
      "total_awarded": 9,
      "feedback": "..."
    }
  ],
  "marks_awarded": 87,
  "confidence_score": 0.91,
  "flagged_sections": [
    { "page": 2, "reason": "Handwriting unclear" }
  ]
}

Rubric:
${JSON.stringify(rubric, null, 2)}
`,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    temperature: 0.2,
    system:
      "You are an expert exam evaluator. You accurately transcribe handwritten student answers and evaluate them fairly against the given rubric. Always return only valid JSON.",
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Clean markdown if present
  const cleanJson = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("Failed to parse Claude response:", text);
    throw new Error("Claude returned invalid JSON");
  }
}
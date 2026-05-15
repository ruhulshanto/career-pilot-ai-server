UPDATE "ai_feedbacks"
SET "provider" = 'GROQ'
WHERE "provider" IN ('OPENAI', 'GEMINI', 'OPENROUTER');

-- CreateTable
CREATE TABLE "chatbot_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chatbot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatbot_messages_sessionId_createdAt_idx" ON "chatbot_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "chatbot_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

const fs = require('fs');
const p = 'D:/Shanto/my_Projects/New folder/ai-carrer-platform/backend/.prisma/client/index.d.ts';
let content = fs.readFileSync(p, 'utf8');

function replaceAllSafe(str, search, replacement) {
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return str.replace(new RegExp(escaped, 'g'), replacement);
}

// 1. Replace scalar field 'messages' with 'legacyMessages' in the ChatbotSession scalars block
content = content.replace(
  /scalars:\s*\{([^}]*)\}/s,
  (match, inner) => {
    if (inner.includes('ChatbotSession')) {
      return match.replace(/\bmessages\b/, 'legacyMessages');
    }
    return match;
  }
);

// 2. FieldRef for messages -> legacyMessages
content = replaceAllSafe(
  content,
  'readonly messages: FieldRef<"ChatbotSession", \'Json\'>',
  'readonly legacyMessages: FieldRef<"ChatbotSession", \'Json\'>'
);

// 3. Replace JsonFilter and JsonWithAggregatesFilter for messages field
content = content.replace(
  /messages\?\s*JsonFilter<"ChatbotSession">/g,
  'legacyMessages?: Prisma.InputJsonFilter'
);
content = content.replace(
  /messages\?\s*JsonWithAggregatesFilter<"ChatbotSession">/g,
  'legacyMessages?: Prisma.InputJsonFilter'
);

// 4. Go through lines and fix ChatbotSession-related type blocks
const lines = content.split('\n');
let braceDepth = 0;
let currentTypeName = '';
let inChatbotSessionType = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect start of a ChatbotSession type
  const typeMatch = line.match(/export type (ChatbotSession\w*)/);
  if (typeMatch) {
    currentTypeName = typeMatch[1];
    inChatbotSessionType = true;
    braceDepth = 0;
  }

  if (inChatbotSessionType) {
    for (const ch of line) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    if (braceDepth <= 0 && line.includes('}')) {
      inChatbotSessionType = false;
      currentTypeName = '';
    }

    // Replace 'messages' field references with 'legacyMessages', but keep 'chatbotSessions' intact
    if (lines[i].includes('messages') && !lines[i].includes('chatbotSessions') && !lines[i].includes('ChatbotMessage')) {
      lines[i] = lines[i].replace(/\bmessages\b/g, 'legacyMessages');
    }
  }
}

content = lines.join('\n');

// 5. Final fix: any remaining 'messages' in ChatbotSession contexts that escaped line-based processing
// These are multi-line patterns that span across lines
content = content.replace(
  /(ChatbotSession\w*[^{]*\{[^}]*?)(\bmessages\b)([^{}]*\})/gs,
  (match, prefix, field, suffix) => {
    if (!prefix.includes('chatbotSessions') && !prefix.includes('ChatbotMessage')) {
      return prefix + 'legacyMessages' + suffix;
    }
    return match;
  }
);

// 6. Safety: fix any leftover JsonFilter/JsonWithAggregatesFilter for messages
content = content.replace(
  /legacyMessages\?\s*JsonFilter/g,
  'legacyMessages?: Prisma.InputJsonFilter'
);
content = content.replace(
  /legacyMessages\?\s*JsonWithAggregatesFilter/g,
  'legacyMessages?: Prisma.InputJsonFilter'
);

console.log('Final length:', content.length);
fs.writeFileSync(p, content);
console.log('File written successfully');

// Verification: check that no problematic 'messages' fields remain in ChatbotSession context
const verifyLines = content.split('\n');
let issueCount = 0;
for (const line of verifyLines) {
  if (line.includes('messages:') && line.includes('ChatbotSession')) {
    console.log('POTENTIAL ISSUE:', line.trim().substring(0, 120));
    issueCount++;
  }
}
if (issueCount === 0) {
  console.log('Verification passed: no problematic messages fields remain.');
} else {
  console.log('Warning:', issueCount, 'potential issues found.');
}